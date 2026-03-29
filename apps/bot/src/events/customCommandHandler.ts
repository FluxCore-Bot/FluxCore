import type { Message } from "discord.js";
import type { Event } from "@fluxcore/types";
import { getCustomCommands } from "@fluxcore/systems/customCommands/persistence";
import { matchesTrigger, isAllowed } from "@fluxcore/systems/customCommands/matcher";
import { executeCustomCommand } from "@fluxcore/systems/customCommands/executor";
import { isOnCooldown, setCooldown } from "@fluxcore/systems";
import { logger } from "@fluxcore/utils";

const event: Event<"messageCreate"> = {
  name: "messageCreate",
  async execute(message: Message) {
    if (!message.guild || message.author.bot) return;
    if (!message.member) return;

    let commands: Awaited<ReturnType<typeof getCustomCommands>>;
    try {
      commands = await getCustomCommands(message.guild.id);
    } catch (error) {
      logger.debug(
        `Failed to fetch custom commands for guild ${message.guild.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    if (commands.length === 0) return;

    const memberRoleIds = message.member.roles.cache.map((r) => r.id);

    for (const cmd of commands) {
      if (!cmd.enabled) continue;
      if (!matchesTrigger(cmd, message.content)) continue;
      if (!isAllowed(cmd, memberRoleIds, message.channelId)) continue;

      // Check cooldown
      if (cmd.cooldown > 0) {
        const cooldownKey = `cc_${cmd.id}`;
        const { onCooldown } = isOnCooldown(cooldownKey, message.author.id);
        if (onCooldown) continue;
      }

      await executeCustomCommand(cmd, message);

      // Set cooldown after execution
      if (cmd.cooldown > 0) {
        setCooldown(`cc_${cmd.id}`, message.author.id, cmd.cooldown);
      }

      // Only first match
      break;
    }
  },
};

export default event;
