import type { Message, GuildMember, TextChannel } from "discord.js";
import type { Event } from "@fluxcore/types";
import { getLevelSettings } from "@fluxcore/systems/leveling/config";
import { getUserLevel, addXp } from "@fluxcore/systems/leveling/persistence";
import { applyMultipliers } from "@fluxcore/systems/leveling/xp";
import { XP_RANDOMNESS } from "@fluxcore/systems/leveling/constants";
import { checkAndGrantRewards } from "@fluxcore/systems/leveling/rewards";
import { logger } from "@fluxcore/utils";

function isExcluded(
  settings: { noXpChannels: string[]; noXpRoles: string[] },
  channelId: string,
  member: GuildMember | null,
): boolean {
  if (settings.noXpChannels.includes(channelId)) return true;
  if (member && settings.noXpRoles.some((roleId) => member.roles.cache.has(roleId))) return true;
  return false;
}

async function handleLevelUp(
  message: Message,
  settings: { announceEnabled: boolean; announceChannel: string | null; announceMessage: string },
  newLevel: number,
): Promise<void> {
  if (!settings.announceEnabled) return;

  const text = settings.announceMessage
    .replace("{user}", `<@${message.author.id}>`)
    .replace("{level}", String(newLevel))
    .replace("{username}", message.author.displayName);

  try {
    if (settings.announceChannel === "dm") {
      await message.author.send(text);
    } else if (settings.announceChannel) {
      const channel = message.guild?.channels.cache.get(settings.announceChannel);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send(text);
      }
    } else {
      await message.channel.send(text);
    }
  } catch (error) {
    logger.debug(
      `Failed to send level-up announcement for ${message.author.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

const event: Event<"messageCreate"> = {
  name: "messageCreate",
  async execute(message: Message) {
    if (!message.guild || message.author.bot) return;

    const settings = await getLevelSettings(message.guild.id);
    if (!settings.enabled) return;

    const member = message.member;
    if (!member) return;

    // Check exclusions
    if (isExcluded(settings, message.channelId, member)) return;

    // Cooldown check
    const userLevel = await getUserLevel(message.guild.id, message.author.id);
    if (userLevel?.lastMessageXp) {
      const elapsed = Date.now() - userLevel.lastMessageXp.getTime();
      if (elapsed < settings.xpCooldownSeconds * 1000) return;
    }

    // Calculate XP with randomness and multipliers
    let xpGain = settings.xpPerMessage + Math.floor(Math.random() * XP_RANDOMNESS);
    xpGain = applyMultipliers(xpGain, settings, message.channelId, member);

    // Grant XP
    const result = await addXp(message.guild.id, message.author.id, xpGain);

    // Level up?
    if (result.leveledUp) {
      await handleLevelUp(message, settings, result.newLevel);
      await checkAndGrantRewards(message.guild, message.author.id, result.newLevel);
    }
  },
};

export default event;
