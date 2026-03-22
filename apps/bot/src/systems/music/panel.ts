import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type TextChannel,
  type Client,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { MusicButtonIds } from "@fluxcore/systems/music/constants";
import type { GuildMusicQueue } from "./queue.js";
import { formatDuration, progressBar } from "./embeds.js";

function buildPanelEmbed(queue: GuildMusicQueue, positionMs: number): EmbedBuilder {
  const track = queue.current;
  if (!track) {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Music Player")
      .setDescription("No track currently playing.")
      .setFooter({ text: "Use /play to start playing music" });
  }

  const positionSec = Math.floor(positionMs / 1000);
  const bar = progressBar(positionSec, track.duration);
  const isPaused = queue.player?.paused ?? false;

  const loopLabels = { off: "Off", track: "Track", queue: "Queue" } as const;

  const embed = new EmbedBuilder()
    .setColor(isPaused ? 0xfee75c : 0x5865f2)
    .setTitle(isPaused ? "⏸️ Paused" : "🎵 Now Playing")
    .setDescription(
      `**[${track.title}](${track.url})**\n\n` +
        `${bar}\n` +
        `\`${formatDuration(positionSec)} / ${formatDuration(track.duration)}\``,
    )
    .setFooter({
      text: `Volume: ${queue.volume}% • Loop: ${loopLabels[queue.loopMode]} • Queue: ${queue.tracks.length} track(s) • Requested by ${track.requester}`,
    });

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

function buildPanelButtons(queue: GuildMusicQueue): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const isPaused = queue.player?.paused ?? false;
  const hasQueue = queue.tracks.length > 0;
  const hasTrack = !!queue.current;

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.PAUSE_RESUME)
      .setEmoji(isPaused ? "▶️" : "⏸️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasTrack),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.SKIP)
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasTrack),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.STOP)
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasTrack),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.LOOP)
      .setEmoji(queue.loopMode === "track" ? "🔂" : "🔁")
      .setStyle(queue.loopMode !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!hasTrack),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.SHUFFLE)
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasQueue),
  );

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.VOL_DOWN)
      .setEmoji("🔉")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasTrack || queue.volume <= 0),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.VOL_UP)
      .setEmoji("🔊")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasTrack || queue.volume >= 100),
    new ButtonBuilder()
      .setCustomId(MusicButtonIds.QUEUE)
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasTrack && !hasQueue),
  );

  return [row1, row2];
}

export function buildNowPlayingPanel(queue: GuildMusicQueue): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
} {
  const positionMs = queue.getPositionMs();
  return {
    embeds: [buildPanelEmbed(queue, positionMs)],
    components: buildPanelButtons(queue),
  };
}

export async function sendNowPlayingPanel(
  queue: GuildMusicQueue,
  channel: TextChannel,
): Promise<void> {
  try {
    const panel = buildNowPlayingPanel(queue);
    const msg = await channel.send({ ...panel });
    queue.panelMessageId = msg.id;
  } catch {
    // ignore send failures
  }
}

export async function deleteNowPlayingPanel(
  queue: GuildMusicQueue,
  client: Client,
): Promise<void> {
  if (!queue.panelMessageId) return;
  try {
    const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
    const msg = await channel?.messages.fetch(queue.panelMessageId).catch(() => null);
    await msg?.delete().catch(() => {});
  } catch {
    // ignore
  }
  queue.panelMessageId = null;
}

export async function updateNowPlayingPanel(
  queue: GuildMusicQueue,
  client: Client,
): Promise<void> {
  const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
  if (!channel) return;

  // Delete old panel and send fresh one to keep it at the bottom
  await deleteNowPlayingPanel(queue, client);
  await sendNowPlayingPanel(queue, channel);

  // Start periodic progress refresh
  startProgressRefresh(queue, client);
}

const PROGRESS_REFRESH_INTERVAL_MS = 5_000;
const progressTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

export function startProgressRefresh(queue: GuildMusicQueue, client: Client): void {
  stopProgressRefresh(queue.guildId);

  const timer = setInterval(async () => {
    if (!queue.current || !queue.player || queue.player.paused) return;
    if (!queue.panelMessageId) {
      stopProgressRefresh(queue.guildId);
      return;
    }

    try {
      const channel = client.channels.cache.get(queue.textChannelId) as TextChannel | undefined;
      if (!channel) return;
      const msg = await channel.messages.fetch(queue.panelMessageId).catch(() => null);
      if (!msg) {
        queue.panelMessageId = null;
        stopProgressRefresh(queue.guildId);
        return;
      }
      const panel = buildNowPlayingPanel(queue);
      await msg.edit({ ...panel });
    } catch {
      // ignore edit failures
    }
  }, PROGRESS_REFRESH_INTERVAL_MS);

  progressTimers.set(queue.guildId, timer);
}

export function stopProgressRefresh(guildId: string): void {
  const timer = progressTimers.get(guildId);
  if (timer) {
    clearInterval(timer);
    progressTimers.delete(guildId);
  }
}

export function stopAllProgressRefresh(): void {
  for (const [guildId] of progressTimers) {
    stopProgressRefresh(guildId);
  }
}
