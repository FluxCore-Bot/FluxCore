import type { Client, TextChannel } from "discord.js";
import type { Player } from "shoukaku";
import type { QueueTrack, LoopMode } from "@fluxcore/systems/music/types";
import { getShoukaku } from "./shoukaku.js";
import { stopProgressRefresh } from "./panel.js";
import { getMusicSettings, upsertMusicSettings } from "@fluxcore/systems/music/config";
import { logger } from "@fluxcore/utils";

interface LavalinkResolvedTrack {
  encoded: string;
  info: {
    title: string;
    length: number;
    uri?: string;
    artworkUrl?: string;
    identifier: string;
    isSeekable: boolean;
    author: string;
    isStream: boolean;
    position: number;
    sourceName: string;
  };
  pluginInfo: unknown;
}

function extractTrack(result: { loadType: string; data: unknown }): LavalinkResolvedTrack | null {
  if (result.loadType === "track") return result.data as LavalinkResolvedTrack;
  if (result.loadType === "playlist") return (result.data as { tracks: LavalinkResolvedTrack[] }).tracks[0] ?? null;
  if (result.loadType === "search") return (result.data as LavalinkResolvedTrack[])[0] ?? null;
  return null;
}

export class GuildMusicQueue {
  public readonly guildId: string;
  public textChannelId: string;
  public readonly voiceChannelId: string;
  public tracks: QueueTrack[] = [];
  public current: QueueTrack | null = null;
  public loopMode: LoopMode = "off";
  public volume: number;
  public player: Player | null = null;
  public client: Client | null = null;
  public panelMessageId: string | null = null;

  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly MAX_SKIP_ATTEMPTS = 10;
  private _playing = false;
  private _lastPositionMs = 0;
  private _lastPositionTimestamp = 0;

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

  /** Sync the cached position from the player (called on playerUpdate events). */
  syncPosition(positionMs: number): void {
    this._lastPositionMs = positionMs;
    this._lastPositionTimestamp = Date.now();
  }

  /** Get interpolated position in ms, accounting for time elapsed since last Lavalink update. */
  getPositionMs(): number {
    if (!this.current) return 0;
    if (this.player?.paused) return this._lastPositionMs;
    const elapsed = Date.now() - this._lastPositionTimestamp;
    const estimated = this._lastPositionMs + elapsed;
    const maxMs = this.current.duration * 1000;
    return Math.min(estimated, maxMs);
  }

  async setVolume(vol: number): Promise<void> {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this.player) {
      await this.player.setGlobalVolume(this.volume);
    }
  }

  async playNext(): Promise<QueueTrack | null> {
    if (this._playing) return this.current;
    this._playing = true;
    try {
      this.clearDisconnectTimer();

      if (this.loopMode === "track" && this.current) {
        return await this.playTrack(this.current);
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

      return await this.playTrack(next);
    } finally {
      this._playing = false;
    }
  }

  async playTrack(track: QueueTrack): Promise<QueueTrack | null> {
    if (!this.player) return null;

    let encoded = track.encoded;

    if (!encoded) {
      const node = this.player.node;
      const result = await node.rest.resolve(track.url);
      if (!result?.data || result.loadType === "empty" || result.loadType === "error") {
        logger.warn(`Failed to resolve track: ${track.url}`);
        return this.skipBrokenTrack();
      }

      const lavalinkTrack = extractTrack(result);
      if (!lavalinkTrack) {
        logger.warn(`No playable track found for: ${track.url}`);
        return this.skipBrokenTrack();
      }

      encoded = lavalinkTrack.encoded;
      track.encoded = encoded;
    }

    // Set current BEFORE playing so the "start" event handler sees it
    // (the event can fire during any subsequent await)
    this.current = track;
    this.syncPosition(0);
    await this.player.playTrack({ track: { encoded } });
    await this.player.setGlobalVolume(this.volume);
    return track;
  }

  private async skipBrokenTrack(): Promise<QueueTrack | null> {
    const prevLoop = this.loopMode;
    this.loopMode = "off";
    try {
      for (let attempt = 0; attempt < GuildMusicQueue.MAX_SKIP_ATTEMPTS; attempt++) {
        const next = this.tracks.shift();
        if (!next) {
          this.current = null;
          this.startDisconnectTimer();
          return null;
        }
        const result = await this.playTrack(next);
        if (result) return result;
      }
      logger.warn(`Skipped ${GuildMusicQueue.MAX_SKIP_ATTEMPTS} broken tracks in guild ${this.guildId}`);
      this.current = null;
      this.startDisconnectTimer();
      return null;
    } finally {
      this.loopMode = prevLoop;
    }
  }

  async skip(): Promise<QueueTrack | null> {
    const prevLoop = this.loopMode;
    if (this.loopMode === "track") {
      this.loopMode = "off";
    }
    const next = await this.playNext();
    if (next && prevLoop === "track") {
      this.loopMode = prevLoop;
    }
    return next;
  }

  async stop(): Promise<void> {
    this.clear();
    this.current = null;
    this.loopMode = "off";
    stopProgressRefresh(this.guildId);
    if (this.player) {
      await this.player.stopTrack();
    }
    this.clearDisconnectTimer();
  }

  async destroy(): Promise<void> {
    this.clearDisconnectTimer();
    stopProgressRefresh(this.guildId);
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
  const shardId = client.shard?.ids[0] ?? 0;
  const player = await shoukaku.joinVoiceChannel({
    guildId,
    channelId: voiceChannelId,
    shardId,
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
