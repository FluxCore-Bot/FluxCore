import type { VoiceChannel } from "discord.js";
import { getPrisma } from "@fluxcore/database";
import type { ActiveTempChannel, SavedTempVoiceSettings } from "./types.js";
import { logger } from "@fluxcore/utils";

export async function loadUserSettings(
  guildId: string,
  userId: string,
  configId: number,
): Promise<SavedTempVoiceSettings | null> {
  try {
    const prisma = getPrisma();
    const row = await prisma.tempVoiceUserSettings.findUnique({
      where: { guildId_userId_configId: { guildId, userId, configId } },
    });
    if (!row) return null;

    return {
      channelName: row.channelName,
      userLimit: row.userLimit,
      isLocked: row.isLocked,
      isHidden: row.isHidden,
      isTextClosed: row.isTextClosed,
      bannedUserIds: JSON.parse(row.bannedUserIds) as string[],
      hiddenFromUserIds: JSON.parse(row.hiddenFromUserIds) as string[],
    };
  } catch (error) {
    logger.error(
      `Failed to load user settings for ${userId} in ${guildId} (config ${configId})`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return null;
  }
}

export async function saveUserSettings(
  guildId: string,
  userId: string,
  configId: number,
  settings: SavedTempVoiceSettings,
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.tempVoiceUserSettings.upsert({
      where: { guildId_userId_configId: { guildId, userId, configId } },
      update: {
        channelName: settings.channelName,
        userLimit: settings.userLimit,
        isLocked: settings.isLocked,
        isHidden: settings.isHidden,
        isTextClosed: settings.isTextClosed,
        bannedUserIds: JSON.stringify(settings.bannedUserIds),
        hiddenFromUserIds: JSON.stringify(settings.hiddenFromUserIds),
      },
      create: {
        guildId,
        userId,
        configId,
        channelName: settings.channelName,
        userLimit: settings.userLimit,
        isLocked: settings.isLocked,
        isHidden: settings.isHidden,
        isTextClosed: settings.isTextClosed,
        bannedUserIds: JSON.stringify(settings.bannedUserIds),
        hiddenFromUserIds: JSON.stringify(settings.hiddenFromUserIds),
      },
    });
  } catch (error) {
    logger.error(
      `Failed to save user settings for ${userId} in ${guildId} (config ${configId})`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export async function persistChannelState(
  tracked: ActiveTempChannel,
  channel: VoiceChannel,
): Promise<void> {
  const settings: SavedTempVoiceSettings = {
    channelName: channel.name,
    userLimit: channel.userLimit,
    isLocked: tracked.isLocked,
    isHidden: tracked.isHidden,
    isTextClosed: tracked.isTextClosed,
    bannedUserIds: [...tracked.bannedUserIds],
    hiddenFromUserIds: [...tracked.hiddenFromUserIds],
  };
  await saveUserSettings(tracked.guildId, tracked.ownerId, tracked.configId, settings);
}
