import type { Event } from "@fluxcore/types";
import type { AuditLogEvent, Role } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatRoleEvent } from "@fluxcore/systems/logging/formatter";
import { getAntiRaidConfig } from "@fluxcore/systems/antiraid/config";
import { recordNukeAction } from "@fluxcore/systems/antiraid/tracker";
import { quarantineExecutor, lockdownGuild } from "@fluxcore/systems/antiraid/actions";
import { createRaidEvent } from "@fluxcore/systems/antiraid/persistence";

const event: Event<"roleDelete"> = {
  name: "roleDelete",
  async execute(role: Role) {
    // === Anti-Nuke Detection ===
    try {
      const antiRaidConfig = await getAntiRaidConfig(role.guild.id);
      if (antiRaidConfig.enabled && antiRaidConfig.antiNukeEnabled) {
        const auditLogs = await role.guild.fetchAuditLogs({
          type: 32 as unknown as AuditLogEvent, // RoleDelete
          limit: 1,
        }).catch(() => null);

        const entry = auditLogs?.entries.first();
        if (entry?.executor && !entry.executor.bot) {
          const isNuke = recordNukeAction(
            role.guild.id,
            entry.executor.id,
            antiRaidConfig.antiNukeThreshold,
          );

          if (isNuke) {
            await quarantineExecutor(role.guild, entry.executor.id, "Mass role deletion detected");
            await createRaidEvent(role.guild.id, "nuke_attempt", {
              executorId: entry.executor.id,
              action: "quarantine",
              reason: "Mass role deletion",
            });

            if (antiRaidConfig.lockdownOnRaid) {
              await lockdownGuild(role.guild, "Anti-nuke: mass role deletion detected");
            }

            logger.warn(`Anti-nuke: Mass role deletion detected by ${entry.executor.id} in guild ${role.guild.id}`);
          }
        }
      }
    } catch (error) {
      logger.error(
        `Anti-nuke error in roleDelete for guild ${role.guild.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // === Logging ===
    const config = await getLogConfig(role.guild.id, "role");
    if (!config?.enabled) return;

    const embed = formatRoleEvent("delete", role);
    await sendLogEmbed(role.guild, config.channelId, embed);

    await createLogEntry({
      guildId: role.guild.id,
      category: "role",
      eventType: "roleDelete",
      targetId: role.id,
      content: {
        name: role.name,
        color: role.hexColor,
      },
    });
  },
};

export default event;
