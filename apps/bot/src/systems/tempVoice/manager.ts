import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type OverwriteResolvable,
  type VoiceChannel,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
} from "discord.js";
import type {
  ActiveTempChannel,
  TempVoiceGuildConfig,
} from "@fluxcore/systems/tempVoice/types";
import { getGuildConfigs } from "@fluxcore/systems/tempVoice/config";
import { loadUserSettings } from "@fluxcore/systems/tempVoice/persistence";
import { ButtonIds, DEFAULT_NAME_TEMPLATE } from "@fluxcore/systems/tempVoice/constants";
import { logger } from "@fluxcore/utils";

const activeChannels = new Map<string, ActiveTempChannel>();

// ── Queries ──

export function isTrackedChannel(channelId: string): boolean {
  return activeChannels.has(channelId);
}

export function getActiveChannel(channelId: string): ActiveTempChannel | undefined {
  return activeChannels.get(channelId);
}

export function isChannelOwner(channelId: string, userId: string): boolean {
  return activeChannels.get(channelId)?.ownerId === userId;
}

// ── Channel Creation ──

export async function createTempChannel(
  member: GuildMember,
  guild: Guild,
  config: TempVoiceGuildConfig,
): Promise<VoiceChannel | null> {
  const saved = await loadUserSettings(guild.id, member.id, config.id);

  const template = config.nameTemplate || DEFAULT_NAME_TEMPLATE;
  const defaultName = template.replace("{user}", member.displayName);
  const name = saved?.channelName ?? defaultName;

  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ViewChannel,
      ],
    },
  ];

  if (saved && (saved.isLocked || saved.isHidden || saved.isTextClosed)) {
    const everyoneDeny: bigint[] = [];
    if (saved.isLocked) everyoneDeny.push(PermissionFlagsBits.Connect);
    if (saved.isHidden) everyoneDeny.push(PermissionFlagsBits.ViewChannel);
    if (saved.isTextClosed) everyoneDeny.push(PermissionFlagsBits.SendMessages);
    permissionOverwrites.push({
      id: guild.roles.everyone.id,
      deny: everyoneDeny,
    });
  }

  if (saved?.bannedUserIds.length) {
    for (const bannedId of saved.bannedUserIds) {
      permissionOverwrites.push({
        id: bannedId,
        deny: [PermissionFlagsBits.Connect],
      });
    }
  }

  if (saved?.hiddenFromUserIds.length) {
    for (const hiddenId of saved.hiddenFromUserIds) {
      permissionOverwrites.push({
        id: hiddenId,
        deny: [PermissionFlagsBits.ViewChannel],
      });
    }
  }

  try {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: config.categoryId,
      userLimit: saved?.userLimit ?? 0,
      permissionOverwrites,
    });

    await member.voice.setChannel(channel);

    const tracked: ActiveTempChannel = {
      channelId: channel.id,
      guildId: guild.id,
      ownerId: member.id,
      configId: config.id,
      panelMessageId: null,
      isLocked: saved?.isLocked ?? false,
      isHidden: saved?.isHidden ?? false,
      isTextClosed: saved?.isTextClosed ?? false,
      bannedUserIds: saved?.bannedUserIds ?? [],
      hiddenFromUserIds: saved?.hiddenFromUserIds ?? [],
    };
    activeChannels.set(channel.id, tracked);

    await sendManagementPanel(channel, member);

    logger.info(
      `Created temp channel "${channel.name}" for ${member.user.tag} in ${guild.name} (config #${config.id})${saved ? " (restored settings)" : ""}`,
    );
    return channel;
  } catch (error) {
    logger.error(
      `Failed to create temp channel for ${member.user.tag}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return null;
  }
}

// ── Channel Deletion ──

export function untrackChannel(channelId: string): void {
  activeChannels.delete(channelId);
}

// ── Panel Embed & Buttons ──

export function buildPanelEmbed(
  owner: GuildMember,
  channel: VoiceBasedChannel,
): EmbedBuilder {
  const tracked = activeChannels.get(channel.id);
  const lockStatus = tracked?.isLocked ? "Locked" : "Unlocked";
  const visibilityStatus = tracked?.isHidden ? "Hidden" : "Visible";
  const textStatus = tracked?.isTextClosed ? "Closed" : "Open";
  const userLimit = (channel as VoiceChannel).userLimit || "None";

  const statusParts = [lockStatus, visibilityStatus, `Text: ${textStatus}`];
  const bannedCount = tracked?.bannedUserIds.length ?? 0;
  const hiddenFromCount = tracked?.hiddenFromUserIds.length ?? 0;
  if (bannedCount > 0) statusParts.push(`Banned: ${bannedCount}`);
  if (hiddenFromCount > 0) statusParts.push(`Hidden From: ${hiddenFromCount}`);

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Voice Channel Controls")
    .setDescription(
      "This is your temporary voice channel.\nUse the buttons below to manage it.",
    )
    .addFields(
      { name: "Owner", value: `${owner}`, inline: true },
      { name: "User Limit", value: `${userLimit}`, inline: true },
      { name: "Status", value: statusParts.join(" | "), inline: false },
    )
    .setTimestamp();
}

export function buildPanelButtons(
  tracked: ActiveTempChannel,
): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1: Channel Settings
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ButtonIds.RENAME)
      .setLabel("Rename")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📝"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.LIMIT)
      .setLabel("Limit")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔢"),
    tracked.isLocked
      ? new ButtonBuilder()
          .setCustomId(ButtonIds.UNLOCK)
          .setLabel("Unlock")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🔓")
      : new ButtonBuilder()
          .setCustomId(ButtonIds.LOCK)
          .setLabel("Lock")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒"),
    tracked.isHidden
      ? new ButtonBuilder()
          .setCustomId(ButtonIds.UNHIDE)
          .setLabel("Unhide")
          .setStyle(ButtonStyle.Success)
          .setEmoji("👀")
      : new ButtonBuilder()
          .setCustomId(ButtonIds.HIDE)
          .setLabel("Hide")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🫥"),
    tracked.isTextClosed
      ? new ButtonBuilder()
          .setCustomId(ButtonIds.OPEN_TEXT)
          .setLabel("Open Chat")
          .setStyle(ButtonStyle.Success)
          .setEmoji("💬")
      : new ButtonBuilder()
          .setCustomId(ButtonIds.CLOSE_TEXT)
          .setLabel("Close Chat")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("💬"),
  );

  // Row 2: User Management
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ButtonIds.KICK)
      .setLabel("Kick")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🦶"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.BAN)
      .setLabel("Ban")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔨"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.HIDE_FROM)
      .setLabel("Hide From")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🫣"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.INVITE)
      .setLabel("Invite")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✉️"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.TRANSFER)
      .setLabel("Transfer")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👑"),
  );

  // Row 3: Recovery & Config
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ButtonIds.UNBAN)
      .setLabel("Unban")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🔓"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.UNHIDE_FROM)
      .setLabel("Unhide From")
      .setStyle(ButtonStyle.Success)
      .setEmoji("👁️"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.CONFIG)
      .setLabel("Config")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⚙️"),
  );

  // Row 4: Ownership
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ButtonIds.CLAIM)
      .setLabel("Claim")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🏠"),
    new ButtonBuilder()
      .setCustomId(ButtonIds.DELETE)
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️"),
  );

  return [row1, row2, row3, row4];
}

async function sendManagementPanel(
  channel: VoiceChannel,
  owner: GuildMember,
): Promise<void> {
  const tracked = activeChannels.get(channel.id);
  if (!tracked) return;

  try {
    const embed = buildPanelEmbed(owner, channel);
    const components = buildPanelButtons(tracked);
    const message = await channel.send({
      content: `${owner}`,
      embeds: [embed],
      components,
    });
    tracked.panelMessageId = message.id;
  } catch (error) {
    logger.warn(
      `Failed to send management panel in ${channel.name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function updatePanel(
  channel: VoiceChannel,
  owner: GuildMember,
): Promise<void> {
  const tracked = activeChannels.get(channel.id);
  if (!tracked || !tracked.panelMessageId) return;

  try {
    const message = await channel.messages.fetch(tracked.panelMessageId);
    const embed = buildPanelEmbed(owner, channel);
    const components = buildPanelButtons(tracked);
    await message.edit({
      content: `${owner}`,
      embeds: [embed],
      components,
    });
  } catch {
    await sendManagementPanel(channel, owner);
  }
}

// ── Startup Reconciliation ──

export async function reconcileOnStartup(guild: Guild): Promise<void> {
  const configs = getGuildConfigs(guild.id);
  if (configs.length === 0) return;

  const reconciledChannelIds = new Set<string>();

  for (const config of configs) {
    const hubChannel = guild.channels.cache.get(config.hubChannelId);
    if (!hubChannel) {
      logger.warn(
        `[${guild.name}] Hub channel ${config.hubChannelId} (config #${config.id}) no longer exists`,
      );
      continue;
    }

    const categoryId = config.categoryId;
    if (!categoryId) continue;

    const category = guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) continue;

    const voiceChannels = guild.channels.cache.filter(
      (ch) =>
        ch.parentId === categoryId &&
        ch.type === ChannelType.GuildVoice &&
        ch.id !== config.hubChannelId &&
        !reconciledChannelIds.has(ch.id),
    );

    for (const [, channel] of voiceChannels) {
      const vc = channel as VoiceChannel;
      reconciledChannelIds.add(vc.id);

      if (vc.members.size === 0) {
        try {
          await vc.delete("Temp voice cleanup after restart");
          logger.info(`[${guild.name}] Cleaned up orphan temp channel: ${vc.name}`);
        } catch (error) {
          logger.warn(
            `[${guild.name}] Failed to clean up orphan channel ${vc.name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else {
        const overwrites = vc.permissionOverwrites.cache;
        const bannedUserIds: string[] = [];
        const hiddenFromUserIds: string[] = [];
        let detectedOwnerId: string | null = null;
        let isLocked = false;
        let isHidden = false;
        let isTextClosed = false;

        for (const [id, overwrite] of overwrites) {
          if (overwrite.type === OverwriteType.Role) {
            if (id === vc.guild.roles.everyone.id) {
              isLocked = overwrite.deny.has(PermissionFlagsBits.Connect);
              isHidden = overwrite.deny.has(PermissionFlagsBits.ViewChannel);
              isTextClosed = overwrite.deny.has(PermissionFlagsBits.SendMessages);
            }
            continue;
          }

          if (overwrite.type === OverwriteType.Member) {
            if (overwrite.allow.has(PermissionFlagsBits.ManageChannels)) {
              detectedOwnerId = id;
              continue;
            }
            if (overwrite.deny.has(PermissionFlagsBits.Connect)) {
              bannedUserIds.push(id);
            }
            if (overwrite.deny.has(PermissionFlagsBits.ViewChannel)) {
              hiddenFromUserIds.push(id);
            }
          }
        }

        const ownerId = detectedOwnerId ?? vc.members.first()!.id;

        activeChannels.set(vc.id, {
          channelId: vc.id,
          guildId: guild.id,
          ownerId,
          configId: config.id,
          panelMessageId: null,
          isLocked,
          isHidden,
          isTextClosed,
          bannedUserIds,
          hiddenFromUserIds,
        });
        logger.info(
          `[${guild.name}] Re-tracked temp channel: ${vc.name} (config #${config.id}, owner: ${ownerId}, banned: ${bannedUserIds.length}, hiddenFrom: ${hiddenFromUserIds.length})`,
        );
      }
    }
  }
}
