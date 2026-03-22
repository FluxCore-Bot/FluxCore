import type { ButtonInteraction } from "discord.js";
import { MusicButtonIds } from "@fluxcore/systems/music/constants";
import { getMusicSettings } from "@fluxcore/systems/music/config";
import { getQueue, destroyQueue } from "./queue.js";
import { queueEmbed } from "./embeds.js";
import { buildNowPlayingPanel } from "./panel.js";
import { requireSameVoiceChannelButton, requireDjOrPermissionButton } from "./guards.js";
import { successEmbed, errorEmbed, logger } from "@fluxcore/utils";
import type { LoopMode } from "@fluxcore/systems/music/types";

export async function handleMusicButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const queue = getQueue(guildId);
  if (!queue || !queue.current) {
    await interaction.reply({
      embeds: [errorEmbed("Nothing Playing", "There is nothing currently playing.")],
      ephemeral: true,
    });
    return;
  }

  if (!(await requireSameVoiceChannelButton(interaction))) return;

  const settings = getMusicSettings(guildId);

  try {
    switch (interaction.customId) {
      case MusicButtonIds.PAUSE_RESUME: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        if (!queue.player) return;
        const paused = !queue.player.paused;
        await queue.player.setPaused(paused);
        const panel = buildNowPlayingPanel(queue);
        await interaction.update({ ...panel });
        break;
      }

      case MusicButtonIds.SKIP: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        // Defer the update — the track start event will resend the panel
        await interaction.deferUpdate();
        await queue.skip();
        break;
      }

      case MusicButtonIds.STOP: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        await interaction.deferUpdate();
        await destroyQueue(guildId);
        break;
      }

      case MusicButtonIds.LOOP: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        const modes: LoopMode[] = ["off", "track", "queue"];
        const currentIndex = modes.indexOf(queue.loopMode);
        queue.setLoop(modes[(currentIndex + 1) % modes.length]);
        const panel = buildNowPlayingPanel(queue);
        await interaction.update({ ...panel });
        break;
      }

      case MusicButtonIds.SHUFFLE: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        if (queue.tracks.length < 2) {
          await interaction.reply({
            embeds: [errorEmbed("Cannot Shuffle", "Need at least 2 tracks in the queue to shuffle.")],
            ephemeral: true,
          });
          return;
        }
        queue.shuffle();
        await interaction.reply({
          embeds: [successEmbed("Shuffled", `Shuffled **${queue.tracks.length}** tracks in the queue.`)],
          ephemeral: true,
        });
        break;
      }

      case MusicButtonIds.VOL_DOWN: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        const newVol = Math.max(0, queue.volume - 10);
        await queue.setVolume(newVol);
        const panel = buildNowPlayingPanel(queue);
        await interaction.update({ ...panel });
        break;
      }

      case MusicButtonIds.VOL_UP: {
        if (!(await requireDjOrPermissionButton(interaction, settings))) return;
        const newVol = Math.min(100, queue.volume + 10);
        await queue.setVolume(newVol);
        const panel = buildNowPlayingPanel(queue);
        await interaction.update({ ...panel });
        break;
      }

      case MusicButtonIds.QUEUE: {
        await interaction.reply({
          embeds: [queueEmbed(queue, 1)],
          ephemeral: true,
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    logger.error(
      "Error handling music button interaction",
      error instanceof Error ? error : new Error(String(error)),
    );
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed("Error", "An error occurred while processing this action.")],
          ephemeral: true,
        });
      }
    } catch {
      // ignore
    }
  }
}
