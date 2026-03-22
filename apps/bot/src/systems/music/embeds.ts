import { EmbedBuilder } from "discord.js";
import type { QueueTrack } from "@fluxcore/systems/music/types";
import type { GuildMusicQueue } from "./queue.js";

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function progressBar(current: number, total: number, length = 15): string {
  if (total <= 0) return "▬".repeat(length);
  const filled = Math.round((current / total) * length);
  return "▓".repeat(filled) + "▬".repeat(length - filled);
}

export function nowPlayingEmbed(track: QueueTrack, positionMs: number): EmbedBuilder {
  const positionSec = Math.floor(positionMs / 1000);
  const bar = progressBar(positionSec, track.duration);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Now Playing")
    .setDescription(
      `**[${track.title}](${track.url})**\n\n` +
        `${bar}\n` +
        `\`${formatDuration(positionSec)} / ${formatDuration(track.duration)}\``,
    )
    .setFooter({ text: `Requested by ${track.requester}` });

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

export function trackAddedEmbed(track: QueueTrack, position: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Added to Queue")
    .setDescription(
      `**[${track.title}](${track.url})**\n` +
        `Duration: \`${formatDuration(track.duration)}\`\n` +
        `Position: #${position}`,
    )
    .setFooter({ text: `Requested by ${track.requester}` });

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

export function queueEmbed(queue: GuildMusicQueue, page: number): EmbedBuilder {
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(queue.tracks.length / perPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * perPage;
  const pageItems = queue.tracks.slice(start, start + perPage);

  let description = "";

  if (queue.current) {
    description += `**Now Playing:**\n[${queue.current.title}](${queue.current.url}) — \`${formatDuration(queue.current.duration)}\`\n\n`;
  }

  if (pageItems.length === 0) {
    description += "The queue is empty.";
  } else {
    description += "**Up Next:**\n";
    description += pageItems
      .map(
        (track, i) =>
          `\`${start + i + 1}.\` [${track.title}](${track.url}) — \`${formatDuration(track.duration)}\` — <@${track.requester}>`,
      )
      .join("\n");
  }

  const totalDuration = queue.tracks.reduce((acc, t) => acc + t.duration, 0);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Music Queue")
    .setDescription(description)
    .setFooter({
      text: `Page ${safePage}/${totalPages} • ${queue.tracks.length} track(s) • Total: ${formatDuration(totalDuration)} • Loop: ${queue.loopMode}`,
    });
}
