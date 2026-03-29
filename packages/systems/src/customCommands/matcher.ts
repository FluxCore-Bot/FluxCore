import type { CustomCommand } from "./types.js";

/**
 * Check if a message content matches a custom command's trigger.
 */
export function matchesTrigger(cmd: CustomCommand, content: string): boolean {
  switch (cmd.triggerType) {
    case "command":
      return content.toLowerCase() === `!${cmd.name.toLowerCase()}`;
    case "keyword":
      return content.toLowerCase().includes(cmd.name.toLowerCase());
    case "startsWith":
      return content.toLowerCase().startsWith(cmd.name.toLowerCase());
    case "regex": {
      try {
        return new RegExp(cmd.name, "i").test(content);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Check if the member/channel is allowed to trigger this command.
 */
export function isAllowed(
  cmd: CustomCommand,
  memberRoleIds: string[],
  channelId: string,
): boolean {
  // Check channel restrictions
  if (cmd.allowedChannels.length > 0 && !cmd.allowedChannels.includes(channelId)) {
    return false;
  }

  // Check role restrictions
  if (cmd.allowedRoles.length > 0) {
    const hasAllowedRole = cmd.allowedRoles.some((roleId) =>
      memberRoleIds.includes(roleId),
    );
    if (!hasAllowedRole) return false;
  }

  return true;
}
