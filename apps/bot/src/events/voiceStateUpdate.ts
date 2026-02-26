import type { VoiceState, VoiceChannel } from "discord.js";
import type { Event } from "@fluxcore/types";
import { getGuildConfig } from "@fluxcore/systems/tempVoice/config";
import {
  createTempChannel,
  isTrackedChannel,
  untrackChannel,
} from "../systems/tempVoice/manager.js";
import { logger } from "@fluxcore/utils";

const event: Event<"voiceStateUpdate"> = {
  name: "voiceStateUpdate",
  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild;

    // User joined a channel
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const config = getGuildConfig(guild.id);
      if (config && newState.channelId === config.hubChannelId) {
        const member = newState.member;
        if (!member) return;
        await createTempChannel(member, guild);
      }
    }

    // User left a channel
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      if (isTrackedChannel(oldState.channelId)) {
        const channel = oldState.channel as VoiceChannel | null;
        if (channel && channel.members.size === 0) {
          untrackChannel(channel.id);
          try {
            await channel.delete("Temp voice channel empty");
            logger.debug(`Deleted empty temp channel: ${channel.name}`);
          } catch (error) {
            logger.warn(
              `Failed to delete temp channel ${channel.name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }
    }
  },
};

export default event;
