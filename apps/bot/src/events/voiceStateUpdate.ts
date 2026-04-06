import type { VoiceState, VoiceChannel, Client } from "discord.js";
import type { Event } from "@fluxcore/types";
import { getConfigByHubChannel } from "@fluxcore/systems/tempVoice/config";
import { getRulesForEvent } from "@fluxcore/systems/actions/cache";
import { processEvent } from "../features/automation/system/executor.js";
import { buildVoiceContext } from "../features/automation/system/eventBridge.js";
import {
  createTempChannel,
  isTrackedChannel,
  untrackChannel,
} from "../features/tempvoice/system/manager.js";
import { getLogConfig, isIgnored } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatVoiceEvent } from "@fluxcore/systems/logging/formatter";
import { getLevelSettings } from "@fluxcore/systems/leveling/config";
import { addVoiceXp } from "@fluxcore/systems/leveling/persistence";
import { checkAndGrantRewards } from "@fluxcore/systems/leveling/rewards";
import { logger } from "@fluxcore/utils";

// Track voice join times for XP calculation
const voiceSessions = new Map<string, { guildId: string; joinedAt: number }>();

function shouldGrantVoiceXp(state: VoiceState): boolean {
  if (!state.channel) return false;
  // Must not be muted or deafened
  if (state.selfDeaf || state.serverDeaf || state.selfMute || state.serverMute) return false;
  // Must have at least 2 non-bot members in the channel
  const nonBotMembers = state.channel.members.filter((m) => !m.user.bot);
  return nonBotMembers.size >= 2;
}

async function grantVoiceXp(state: VoiceState, minutes: number): Promise<void> {
  const guildId = state.guild.id;
  const userId = state.member?.id;
  if (!userId) return;

  try {
    const settings = await getLevelSettings(guildId);
    if (!settings.enabled || !settings.voiceXpEnabled) return;

    const xpAmount = minutes * settings.voiceXpPerMinute;
    if (xpAmount <= 0) return;

    const result = await addVoiceXp(guildId, userId, xpAmount, minutes);

    if (result.leveledUp) {
      await checkAndGrantRewards(state.guild, userId, result.newLevel);
    }
  } catch (error) {
    logger.debug(
      `Failed to grant voice XP for ${userId} in ${guildId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

const event: Event<"voiceStateUpdate"> = {
  name: "voiceStateUpdate",
  async execute(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild;
    const client = guild.client as Client;

    // Voice XP tracking — join
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      if (newState.member && !newState.member.user.bot && shouldGrantVoiceXp(newState)) {
        voiceSessions.set(`${guild.id}:${newState.member.id}`, {
          guildId: guild.id,
          joinedAt: Date.now(),
        });
      }
    }

    // Voice XP tracking — leave
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const key = `${guild.id}:${oldState.member?.id}`;
      const session = voiceSessions.get(key);
      if (session && oldState.member && !oldState.member.user.bot) {
        voiceSessions.delete(key);
        const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
        if (minutes > 0) {
          grantVoiceXp(oldState, minutes).catch((e) =>
            logger.debug(`Voice XP grant failed: ${e instanceof Error ? e.message : String(e)}`),
          );
        }
      }
    }

    // Voice XP tracking — mute/deafen state change (stop tracking)
    if (newState.channelId && newState.channelId === oldState.channelId) {
      const key = `${guild.id}:${newState.member?.id}`;
      if (shouldGrantVoiceXp(newState)) {
        if (!voiceSessions.has(key) && newState.member && !newState.member.user.bot) {
          voiceSessions.set(key, { guildId: guild.id, joinedAt: Date.now() });
        }
      } else {
        const session = voiceSessions.get(key);
        if (session && newState.member) {
          voiceSessions.delete(key);
          const minutes = Math.floor((Date.now() - session.joinedAt) / 60_000);
          if (minutes > 0) {
            grantVoiceXp(newState, minutes).catch((e) =>
              logger.debug(`Voice XP grant failed: ${e instanceof Error ? e.message : String(e)}`),
            );
          }
        }
      }
    }

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
