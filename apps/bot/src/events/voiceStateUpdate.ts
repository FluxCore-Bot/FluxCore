import type { VoiceState, VoiceChannel, Client } from "discord.js";
import type { Event } from "@fluxcore/types";
import { getConfigByHubChannel } from "@fluxcore/systems/tempVoice/config";
import { getRulesForEvent } from "@fluxcore/systems/actions/cache";
import { processEvent } from "../systems/actions/executor.js";
import { buildVoiceContext } from "../systems/actions/eventBridge.js";
import {
  createTempChannel,
  isTrackedChannel,
  untrackChannel,
} from "../systems/tempVoice/manager.js";
import { getLogConfig, isIgnored } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatVoiceEvent } from "@fluxcore/systems/logging/formatter";
import { logger } from "@fluxcore/utils";

const event: Event<"voiceStateUpdate"> = {
  name: "voiceStateUpdate",
  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild;
    const client = guild.client as Client;

    // User joined a channel
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const config = getConfigByHubChannel(newState.channelId);
      if (config) {
        const member = newState.member;
        if (!member) return;
        await createTempChannel(member, guild, config);
      }

      // Action system: voiceJoin
      if (getRulesForEvent(guild.id, "voiceJoin").length > 0) {
        const ctx = buildVoiceContext("voiceJoin", newState);
        processEvent(client, ctx).catch((e) =>
          logger.error("Action event processing failed for voiceJoin", e instanceof Error ? e : new Error(String(e))),
        );
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

      // Action system: voiceLeave
      if (getRulesForEvent(guild.id, "voiceLeave").length > 0) {
        const ctx = buildVoiceContext("voiceLeave", oldState);
        processEvent(client, ctx).catch((e) =>
          logger.error("Action event processing failed for voiceLeave", e instanceof Error ? e : new Error(String(e))),
        );
      }
    }

    // Logging system — voice state changes
    if (!newState.member?.user.bot) {
      const voiceLogConfig = await getLogConfig(guild.id, "voice");
      if (voiceLogConfig?.enabled && !isIgnored(voiceLogConfig, newState.channelId ?? oldState.channelId ?? undefined)) {
        const joined = newState.channelId && newState.channelId !== oldState.channelId;
        const left = oldState.channelId && oldState.channelId !== newState.channelId;

        if (joined && left) {
          // Channel switch
          const embed = formatVoiceEvent("switch", newState, oldState.channelId);
          await sendLogEmbed(guild, voiceLogConfig.channelId, embed);
          await createLogEntry({
            guildId: guild.id,
            category: "voice",
            eventType: "voiceSwitch",
            targetId: newState.member?.id,
            content: { fromChannel: oldState.channelId, toChannel: newState.channelId },
          });
        } else if (joined) {
          const embed = formatVoiceEvent("join", newState);
          await sendLogEmbed(guild, voiceLogConfig.channelId, embed);
          await createLogEntry({
            guildId: guild.id,
            category: "voice",
            eventType: "voiceJoin",
            targetId: newState.member?.id,
            content: { channelId: newState.channelId },
          });
        } else if (left) {
          const embed = formatVoiceEvent("leave", oldState, oldState.channelId);
          await sendLogEmbed(guild, voiceLogConfig.channelId, embed);
          await createLogEntry({
            guildId: guild.id,
            category: "voice",
            eventType: "voiceLeave",
            targetId: newState.member?.id ?? oldState.member?.id,
            content: { channelId: oldState.channelId },
          });
        }
      }
    }
  },
};

export default event;
