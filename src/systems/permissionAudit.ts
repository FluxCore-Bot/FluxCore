import {
  type Client,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "../utils/logger.js";

const REQUIRED_PERMISSIONS = [
  { flag: PermissionFlagsBits.SendMessages, name: "SendMessages", usedBy: "all commands" },
  { flag: PermissionFlagsBits.EmbedLinks, name: "EmbedLinks", usedBy: "all commands" },
  { flag: PermissionFlagsBits.KickMembers, name: "KickMembers", usedBy: "/kick" },
  { flag: PermissionFlagsBits.BanMembers, name: "BanMembers", usedBy: "/ban" },
  { flag: PermissionFlagsBits.ModerateMembers, name: "ModerateMembers", usedBy: "/timeout" },
  { flag: PermissionFlagsBits.ManageMessages, name: "ManageMessages", usedBy: "/clear, /embed" },
  { flag: PermissionFlagsBits.ReadMessageHistory, name: "ReadMessageHistory", usedBy: "/clear" },
];

export function auditPermissions(client: Client<true>): void {
  logger.info("Running startup permission audit...");

  for (const guild of client.guilds.cache.values()) {
    const botMember = guild.members.me;
    if (!botMember) {
      logger.warn(`[${guild.name}] Could not resolve bot member — skipping audit`);
      continue;
    }

    const botPerms = botMember.permissions;
    const missing = REQUIRED_PERMISSIONS.filter(
      (p) => !botPerms.has(p.flag),
    );

    if (missing.length === 0) {
      logger.info(`[${guild.name}] All permissions OK`);
    } else {
      const details = missing
        .map((p) => `  - ${p.name} (needed by ${p.usedBy})`)
        .join("\n");
      logger.warn(
        `[${guild.name}] Missing ${missing.length} permission(s):\n${details}`,
      );
    }
  }
}
