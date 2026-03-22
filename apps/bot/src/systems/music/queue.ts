import type { Client, TextChannel } from "discord.js";
import type { Player } from "shoukaku";
import type { QueueTrack, LoopMode } from "@fluxcore/systems/music/types";
import { getShoukaku } from "./shoukaku.js";
import { getMusicSettings, upsertMusicSettings } from "@fluxcore/systems/music/config";
import { logger } from "@fluxcore/utils";

export class GuildMusicQueue {
  public readonly guildId: string;
  public readonly textChannelId: string;
  public readonly voiceChannelId: string;
  public tracks: QueueTrack[] = [];
  public current: QueueTrack | null = null;
  public loopMode: LoopMode = "off";
  public volume: number;
  public player: Player | null = null;
  public client: Client | null = null;
  public panelMessageId: string | null = null;

  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(guildId: string, textChannelId: string, voiceChannelId: string, volume: number) {
    this.guildId = guildId;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;
    this.volume = volume;
  }

  add(track: QueueTrack): number {
    this.tracks.push(track);
    return this.tracks.length;
  }

  remove(index: number): QueueTrack | null {
    if (index < 0 || index >= this.tracks.length) return null;
    return this.tracks.splice(index, 1)[0];
  }

  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  clear(): void {
    this.tracks = [];
  }

  setLoop(mode: LoopMode): void {
    this.loopMode = mode;
  }

  async setVolume(vol: number): Promise<void> {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this.player) {
      await this.player.setGlobalVolume(this.volume);
    }
  }

  async playNext(): Promise<QueueTrack | null> {
    this.clearDisconnectTimer();

    if (this.loopMode === "track" && this.current) {
      return this.playTrack(this.current);
    }

    if (this.loopMode === "queue" && this.current) {
      this.tracks.push(this.current);
    }

    const next = this.tracks.shift();
    if (!next) {
      this.current = null;
      this.startDisconnectTimer();
      return null;
    }

    return this.playTrack(next);
  }

  async playTrack(track: QueueTrack): Promise<QueueTrack | null> {
    if (!this.player) return null;

    const shoukaku = getShoukaku();
    const node = shoukaku.getIdealNode();
    if (!node) {
      logger.error("No available Lavalink node");
      return null;
    }

    const result = await node.rest.resolve(track.url);
    if (!result?.data || result.loadType === "empty" || result.loadType === "error") {
      logger.warn(`Failed to resolve track: ${track.url}`);
      // Skip to next to avoid infinite loop when looping a broken track
      const prevLoop = this.loopMode;
      this.loopMode = "off";
      const next = await this.playNext();
      this.loopMode = prevLoop;
      return next;
    }

    const lavalinkTrack =
      result.loadType === "track"
        ? result.data
        : result.loadType === "playlist"
          ? result.data.tracks[0]
          : result.loadType === "search"
            ? (result.data as { encoded: string; info: { title: string; length: number; uri?: string; artworkUrl?: string; identifier: string; isSeekable: boolean; author: string; isStream: boolean; position: number; sourceName: string }; pluginInfo: unknown }[])[0]
            : null;

    if (!lavalinkTrack) {
      logger.warn(`No playable track found for: ${track.url}`);
      const prevLoop = this.loopMode;
      this.loopMode = "off";
      const next = await this.playNext();
      this.loopMode = prevLoop;
      return next;
    }

    await this.player.playTrack({ track: { encoded: lavalinkTrack.encoded } });
    await this.player.setGlobalVolume(this.volume);
    this.current = track;
    return track;
  }

  async skip(): Promise<QueueTrack | null> {
    const prevLoop = this.loopMode;
    if (this.loopMode === "track") {
      this.loopMode = "off";
    }
    const next = await this.playNext();
    if (prevLoop === "track" && next) {
      this.loopMode = prevLoop;
    }
    return next;
  }

  async stop(): Promise<void> {
    this.clear();
    this.current = null;
    this.loopMode = "off";
    if (this.player) {
      await this.player.stopTrack();
    }
    this.clearDisconnectTimer();
  }

  async destroy(): Promise<void> {
    this.clearDisconnectTimer();
    if (this.panelMessageId && this.client) {
      try {
        const channel = this.client.channels.cache.get(this.textChannelId) as TextChannel | undefined;
        const msg = await channel?.messages.fetch(this.panelMessageId).catch(() => null);
        await msg?.delete().catch(() => {});
      } catch {
        // ignore
      }
      this.panelMessageId = null;
    }
    const shoukaku = getShoukaku();
    if (shoukaku) {
      await shoukaku.leaveVoiceChannel(this.guildId);
    }
    this.player = null;
    this.client = null;
    queues.delete(this.guildId);
  }

  startDisconnectTimer(): void {
    this.clearDisconnectTimer();
    const settings = getMusicSettings(this.guildId);
    if (settings.twentyFourSeven) return;
    if (settings.autoDisconnectSecs <= 0) return;

    this.disconnectTimer = setTimeout(async () => {
      logger.debug(`Auto-disconnecting from guild ${this.guildId}`);
      await this.destroy();
    }, settings.autoDisconnectSecs * 1000);
  }

  clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }
}

const queues: Map<string, GuildMusicQueue> = new Map();

export function getQueue(guildId: string): GuildMusicQueue | undefined {
  return queues.get(guildId);
}

export async function createQueue(
  guildId: string,
  textChannelId: string,
  voiceChannelId: string,
  client: Client,
): Promise<GuildMusicQueue> {
  const existing = queues.get(guildId);
  if (existing) return existing;

  const settings = getMusicSettings(guildId);
  const queue = new GuildMusicQueue(guildId, textChannelId, voiceChannelId, settings.defaultVolume);

  const shoukaku = getShoukaku();
  const player = await shoukaku.joinVoiceChannel({
    guildId,
    channelId: voiceChannelId,
    shardId: 0,
    deaf: true,
  });

  queue.player = player;
  queue.client = client;
  queues.set(guildId, queue);

  await upsertMusicSettings(guildId, { lastChannelId: voiceChannelId });

  return queue;
}

export async function destroyQueue(guildId: string): Promise<void> {
  const queue = queues.get(guildId);
  if (queue) {
    await queue.destroy();
  }
}

export function getAllQueues(): Map<string, GuildMusicQueue> {
  return queues;
}
