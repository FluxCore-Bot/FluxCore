import type { Event } from "@fluxcore/types";
import type { AuditLogEvent, DMChannel, GuildChannel } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatChannelEvent } from "@fluxcore/systems/logging/formatter";
import { getAntiRaidConfig } from "@fluxcore/systems/antiraid/config";
import { recordNukeAction } from "@fluxcore/systems/antiraid/tracker";
import { quarantineExecutor, lockdownGuild } from "@fluxcore/systems/antiraid/actions";
import { createRaidEvent } from "@fluxcore/systems/antiraid/persistence";

const event: Event<"channelDelete"> = {
  name: "channelDelete",
  async execute(channel: DMChannel | GuildChannel) {
    if (!("guild" in channel) || !channel.guild) return;

    const guildChannel = channel as GuildChannel;

    // === Anti-Nuke Detection ===
    try {
      const antiRaidConfig = await getAntiRaidConfig(guildChannel.guild.id);
      if (antiRaidConfig.enabled && antiRaidConfig.antiNukeEnabled) {
        const auditLogs = await guildChannel.guild.fetchAuditLogs({
          type: 12 as unknown as AuditLogEvent, // ChannelDelete
          limit: 1,
        }).catch(() => null);

        const entry = auditLogs?.entries.first();
        if (entry?.executor && !entry.executor.bot) {
          const isNuke = recordNukeAction(
            guildChannel.guild.id,
            entry.executor.id,
            antiRaidConfig.antiNukeThreshold,
          );

          if (isNuke) {
            await quarantineExecutor(guildChannel.guild, entry.executor.id, "Mass channel deletion detected");
            await createRaidEvent(guildChannel.guild.id, "nuke_attempt", {
              executorId: entry.executor.id,
              action: "quarantine",
              reason: "Mass channel deletion",
            });

            if (antiRaidConfig.lockdownOnRaid) {
              await lockdownGuild(guildChannel.guild, "Anti-nuke: mass channel deletion detected");
            }

            logger.warn(`Anti-nuke: Mass channel deletion detected by ${entry.executor.id} in guild ${guildChannel.guild.id}`);
          }
        }
      }
    } catch (error) {
      logger.error(
        `Anti-nuke error in channelDelete for guild ${guildChannel.guild.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // === Logging ===
    const config = await getLogConfig(guildChannel.guild.id, "channel");
    if (!config?.enabled) return;

    const embed = formatChannelEvent("delete", guildChannel);
    await sendLogEmbed(guildChannel.guild, config.channelId, embed);

    await createLogEntry({
      guildId: guildChannel.guild.id,
      category: "channel",
      eventType: "channelDelete",
      targetId: guildChannel.id,
      content: {
        name: guildChannel.name,
        type: guildChannel.type,
      },
    });
  },
};

export default event;
