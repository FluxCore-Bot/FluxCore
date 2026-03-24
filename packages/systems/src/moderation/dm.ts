import type { GuildMember, User } from "discord.js";
import { logger } from "@fluxcore/utils";

export async function dmOnPunishment(
  target: GuildMember | User,
  guildName: string,
  action: string,
  reason?: string,
  duration?: string,
): Promise<boolean> {
  try {
    const user = "user" in target ? target.user : target;
    let message = `You have been **${action}** in **${guildName}**.`;
    if (duration) message += `\n**Duration:** ${duration}`;
    if (reason) message += `\n**Reason:** ${reason}`;
    await user.send(message);
    return true;
  } catch {
    // User has DMs closed — fail silently
    return false;
  }
}
