import type { Event } from "@fluxcore/types";
import type { GuildMember } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberJoin } from "@fluxcore/systems/logging/formatter";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { buildWelcomeEmbed } from "@fluxcore/systems/welcome/builder";
import { getAntiRaidConfig } from "@fluxcore/systems/antiraid/config";
import { recordJoin } from "@fluxcore/systems/antiraid/tracker";
import { executeRaidAction, lockdownGuild } from "@fluxcore/systems/antiraid/actions";
import { createRaidEvent } from "@fluxcore/systems/antiraid/persistence";

async function handleAntiRaid(member: GuildMember): Promise<boolean> {
  const config = await getAntiRaidConfig(member.guild.id);
  if (!config.enabled) return false;

  // Check if member has a whitelisted role (unlikely on join, but possible via other bots)
  const hasWhitelistedRole = config.whitelistedRoleIds.some((roleId) =>
    member.roles.cache.has(roleId),
  );
  if (hasWhitelistedRole) return false;

  // Account age check
  if (config.accountAgeMinDays > 0) {
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
    if (accountAgeDays < config.accountAgeMinDays) {
      const success = await executeRaidAction(
        member,
        config.accountAgeAction,
        `Account too new (${Math.floor(accountAgeDays)} days < ${config.accountAgeMinDays} minimum)`,
      );
      await createRaidEvent(member.guild.id, "account_age", {
        userIds: [member.id],
        action: config.accountAgeAction,
        ageDays: Math.floor(accountAgeDays),
      });
      logger.info(
        `Anti-raid: Account age filter triggered for ${member.id} in guild ${member.guild.id} (${Math.floor(accountAgeDays)} days, action: ${config.accountAgeAction}, success: ${success})`,
      );
      return true;
    }
  }

  // Join rate check
  const isRaid = recordJoin(member.guild.id, config.joinThreshold, config.joinWindow);
  if (isRaid) {
    // Execute action on this member
    await executeRaidAction(member, config.joinAction, "Join rate spike detected");

    await createRaidEvent(member.guild.id, "join_spike", {
      userIds: [member.id],
      action: config.joinAction,
      count: config.joinThreshold,
    });

    // Trigger lockdown if configured
    if (config.lockdownOnRaid) {
      const lockedCount = await lockdownGuild(member.guild, "Automatic raid lockdown");
      await createRaidEvent(member.guild.id, "lockdown", {
        action: "activate",
        reason: "Automatic raid lockdown triggered by join spike",
        count: lockedCount,
      });
    }

    logger.warn(
      `Anti-raid: Join spike detected in guild ${member.guild.id} (${config.joinThreshold} joins in ${config.joinWindow}s)`,
    );
    return true;
  }

  return false;
}

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
    // === Anti-Raid Detection ===
    if (!member.user.bot) {
      try {
        const blocked = await handleAntiRaid(member);
        if (blocked) return; // Member was actioned, skip welcome
      } catch (error) {
        logger.error(
          `Anti-raid error in guild ${member.guild.id}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    // === Logging ===
    if (!member.user.bot) {
      const config = await getLogConfig(member.guild.id, "member");
      if (config?.enabled) {
        const embed = formatMemberJoin(member);
        await sendLogEmbed(member.guild, config.channelId, embed);

        const accountAge = Math.floor(
          (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
        );

        await createLogEntry({
          guildId: member.guild.id,
          category: "member",
          eventType: "memberJoin",
          targetId: member.id,
          content: {
            tag: member.user.tag,
            accountAgeDays: accountAge,
            memberCount: member.guild.memberCount,
          },
        });
      }
    }

    // === Welcome & Farewell ===
    const welcomeConfig = await getWelcomeConfig(member.guild.id);
    if (!welcomeConfig) return;

    // Auto-role (skip bots)
    if (welcomeConfig.autoRoleIds.length > 0 && !member.user.bot) {
      const botMember = member.guild.members.me;
      const rolesToAdd = welcomeConfig.autoRoleIds.filter((id) => {
        const role = member.guild.roles.cache.get(id);
        if (!role) return false;
        // Skip if bot role is below target role in hierarchy
        if (botMember && role.position >= botMember.roles.highest.position) return false;
        return true;
      });
      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, "Auto-role on join").catch((err) => {
          logger.error(`Failed to assign auto-roles in guild ${member.guild.id}`, err instanceof Error ? err : new Error(String(err)));
        });
      }
    }

    // Welcome channel message
    if (welcomeConfig.welcomeEnabled && welcomeConfig.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcomeConfig.welcomeChannelId);
      if (channel?.isTextBased()) {
        const embed = buildWelcomeEmbed(welcomeConfig.welcomeMessage, member);
        await channel.send({ embeds: [embed] }).catch((err) => {
          logger.error(`Failed to send welcome message in guild ${member.guild.id}`, err instanceof Error ? err : new Error(String(err)));
        });
      }
    }

    // Welcome DM (skip bots, silently fail)
    if (welcomeConfig.dmEnabled && !member.user.bot) {
      const embed = buildWelcomeEmbed(welcomeConfig.dmMessage, member);
      await member.send({ embeds: [embed] }).catch(() => {});
    }
  },
};

export default event;
