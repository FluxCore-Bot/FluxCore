import type { Event } from "@fluxcore/types";
import type { GuildMember } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberJoin } from "@fluxcore/systems/logging/formatter";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { buildWelcomeEmbed } from "@fluxcore/systems/welcome/builder";

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
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
