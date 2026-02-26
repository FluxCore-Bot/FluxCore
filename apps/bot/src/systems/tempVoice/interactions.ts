import {
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type UserSelectMenuInteraction,
  type StringSelectMenuInteraction,
  type VoiceChannel,
  type GuildMember,
  type Guild,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import {
  ButtonIds,
  SelectIds,
  ModalIds,
  InputIds,
  TV_PREFIX,
} from "@fluxcore/systems/tempVoice/constants";
import { getActiveChannel, updatePanel, untrackChannel } from "./manager.js";
import { persistChannelState } from "@fluxcore/systems/tempVoice/persistence";
import { errorEmbed, successEmbed, logger } from "@fluxcore/utils";

// ── Validation Helpers ──

function validateOwner(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): {
  tracked: NonNullable<ReturnType<typeof getActiveChannel>>;
  channel: VoiceChannel;
  member: GuildMember;
} | null {
  const channelId = interaction.channelId;
  if (!channelId) return null;

  const tracked = getActiveChannel(channelId);
  if (!tracked) return null;

  if (tracked.ownerId !== interaction.user.id) {
    interaction
      .reply({
        embeds: [
          errorEmbed(
            "Not Allowed",
            "Only the channel owner can use these controls.",
          ),
        ],
        ephemeral: true,
      })
      .catch(() => {});
    return null;
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return null;

  return {
    tracked,
    channel: channel as VoiceChannel,
    member: interaction.member as GuildMember,
  };
}

function validateTrackedChannel(
  interaction: ButtonInteraction,
): {
  tracked: NonNullable<ReturnType<typeof getActiveChannel>>;
  channel: VoiceChannel;
  member: GuildMember;
} | null {
  const channelId = interaction.channelId;
  if (!channelId) return null;

  const tracked = getActiveChannel(channelId);
  if (!tracked) return null;

  const channel = interaction.guild?.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return null;

  return {
    tracked,
    channel: channel as VoiceChannel,
    member: interaction.member as GuildMember,
  };
}

// ── Helpers ──

async function buildUserSelectOptions(
  guild: Guild,
  userIds: string[],
): Promise<StringSelectMenuOptionBuilder[]> {
  const ids = userIds.slice(0, 25);
  const options: StringSelectMenuOptionBuilder[] = [];

  for (const userId of ids) {
    let label: string;
    try {
      const member = await guild.members.fetch(userId);
      label = member.displayName;
    } catch {
      label = "Unknown User";
    }
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(userId)
        .setDescription(`ID: ${userId}`),
    );
  }

  return options;
}

// ── Button Handler ──

export async function handleTempVoiceButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith(TV_PREFIX)) return;

  // Claim is available to any channel member, not just the owner
  if (interaction.customId === ButtonIds.CLAIM) {
    await handleClaim(interaction);
    return;
  }

  const ctx = validateOwner(interaction);
  if (!ctx) return;

  const { tracked, channel, member } = ctx;

  switch (interaction.customId) {
    case ButtonIds.RENAME: {
      const modal = new ModalBuilder()
        .setCustomId(ModalIds.RENAME)
        .setTitle("Rename Channel")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId(InputIds.CHANNEL_NAME)
              .setLabel("New channel name")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("My Awesome Channel")
              .setMaxLength(100)
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case ButtonIds.LIMIT: {
      const modal = new ModalBuilder()
        .setCustomId(ModalIds.LIMIT)
        .setTitle("Set User Limit")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId(InputIds.USER_LIMIT)
              .setLabel("User limit (0 = unlimited, max 99)")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("0")
              .setMaxLength(2)
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      break;
    }

    case ButtonIds.LOCK: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        Connect: false,
      });
      tracked.isLocked = true;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed("Channel Locked", "No one else can join this channel."),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.UNLOCK: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        Connect: null,
      });
      tracked.isLocked = false;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed("Channel Unlocked", "Anyone can now join this channel."),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.HIDE: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        ViewChannel: false,
      });
      tracked.isHidden = true;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Channel Hidden",
            "This channel is now invisible to others.",
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.UNHIDE: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        ViewChannel: null,
      });
      tracked.isHidden = false;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Channel Visible",
            "This channel is now visible to everyone.",
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.CLOSE_TEXT: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        SendMessages: false,
      });
      tracked.isTextClosed = true;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Text Chat Closed",
            "Others can no longer send messages in this channel.",
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.OPEN_TEXT: {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        SendMessages: null,
      });
      tracked.isTextClosed = false;
      await updatePanel(channel, member);
      await persistChannelState(tracked, channel);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Text Chat Opened",
            "Everyone can now send messages in this channel.",
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.KICK: {
      const selectRow =
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(SelectIds.KICK)
            .setPlaceholder("Select a user to kick")
            .setMinValues(1)
            .setMaxValues(1),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription("Select a user to kick from the voice channel."),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.INVITE: {
      const selectRow =
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(SelectIds.INVITE)
            .setPlaceholder("Select a user to invite")
            .setMinValues(1)
            .setMaxValues(1),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(
              "Select a user to invite. They will receive a DM with an invite link.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.TRANSFER: {
      const selectRow =
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(SelectIds.TRANSFER)
            .setPlaceholder("Select the new owner")
            .setMinValues(1)
            .setMaxValues(1),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(
              "Select a user to transfer channel ownership to.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.BAN: {
      const selectRow =
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(SelectIds.BAN)
            .setPlaceholder("Select a user to ban")
            .setMinValues(1)
            .setMaxValues(1),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(
              "Select a user to ban from this voice channel. They will be disconnected and unable to rejoin.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.HIDE_FROM: {
      const selectRow =
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(SelectIds.HIDE_FROM)
            .setPlaceholder("Select a user to hide from")
            .setMinValues(1)
            .setMaxValues(1),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(
              "Select a user to hide this channel from. They will be disconnected and unable to see the channel.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.UNBAN: {
      if (tracked.bannedUserIds.length === 0) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "No Banned Users",
              "There are no banned users in this channel.",
            ),
          ],
          ephemeral: true,
        });
        break;
      }

      const guild = interaction.guild!;
      const options = await buildUserSelectOptions(
        guild,
        tracked.bannedUserIds,
      );
      const selectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(SelectIds.UNBAN)
            .setPlaceholder("Select a user to unban")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(
              "Select a user to unban from this voice channel.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.UNHIDE_FROM: {
      if (tracked.hiddenFromUserIds.length === 0) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "No Hidden Users",
              "There are no users hidden from this channel.",
            ),
          ],
          ephemeral: true,
        });
        break;
      }

      const guild = interaction.guild!;
      const options = await buildUserSelectOptions(
        guild,
        tracked.hiddenFromUserIds,
      );
      const selectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(SelectIds.UNHIDE_FROM)
            .setPlaceholder("Select a user to unhide from")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options),
        );
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(
              "Select a user to make this channel visible to again.",
            ),
        ],
        components: [selectRow],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.CONFIG: {
      const ownerDisplay = `<@${tracked.ownerId}>`;
      const lockStatus = tracked.isLocked ? "🔒 Locked" : "🔓 Unlocked";
      const visibilityStatus = tracked.isHidden ? "🫥 Hidden" : "👀 Visible";
      const textStatus = tracked.isTextClosed ? "💬 Closed" : "💬 Open";
      const userLimit =
        (channel as VoiceChannel).userLimit || "Unlimited";

      const bannedList =
        tracked.bannedUserIds.length > 0
          ? tracked.bannedUserIds.map((id) => `<@${id}>`).join(", ")
          : "None";

      const hiddenFromList =
        tracked.hiddenFromUserIds.length > 0
          ? tracked.hiddenFromUserIds.map((id) => `<@${id}>`).join(", ")
          : "None";

      const configEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⚙️ Channel Configuration")
        .addFields(
          { name: "Channel Name", value: channel.name, inline: true },
          { name: "Owner", value: ownerDisplay, inline: true },
          { name: "User Limit", value: `${userLimit}`, inline: true },
          { name: "Lock Status", value: lockStatus, inline: true },
          { name: "Visibility", value: visibilityStatus, inline: true },
          { name: "Text Chat", value: textStatus, inline: true },
          {
            name: `Banned Users (${tracked.bannedUserIds.length})`,
            value: bannedList,
            inline: false,
          },
          {
            name: `Hidden From (${tracked.hiddenFromUserIds.length})`,
            value: hiddenFromList,
            inline: false,
          },
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [configEmbed],
        ephemeral: true,
      });
      break;
    }

    case ButtonIds.DELETE: {
      untrackChannel(channel.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Deleting...",
            "This channel will be deleted momentarily.",
          ),
        ],
        ephemeral: true,
      });
      try {
        await channel.delete("Owner requested deletion");
      } catch (error) {
        logger.warn(
          `Failed to delete channel on owner request: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      break;
    }
  }
}

// ── Claim Handler (any channel member) ──

async function handleClaim(interaction: ButtonInteraction): Promise<void> {
  const ctx = validateTrackedChannel(interaction);
  if (!ctx) return;

  const { tracked, channel, member } = ctx;

  if (tracked.ownerId === interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed("Already Owner", "You already own this channel.")],
      ephemeral: true,
    });
    return;
  }

  const ownerInChannel = channel.members.has(tracked.ownerId);
  if (ownerInChannel) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Owner Present",
          "The channel owner is still in the channel. You cannot claim it.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  tracked.ownerId = interaction.user.id;
  tracked.bannedUserIds = tracked.bannedUserIds.filter(
    (id) => id !== interaction.user.id,
  );
  tracked.hiddenFromUserIds = tracked.hiddenFromUserIds.filter(
    (id) => id !== interaction.user.id,
  );
  await updatePanel(channel, member);
  await interaction.reply({
    embeds: [
      successEmbed(
        "Ownership Claimed",
        "You are now the owner of this channel.",
      ),
    ],
    ephemeral: true,
  });
}

// ── User Select Menu Handler ──

export async function handleTempVoiceUserSelect(
  interaction: UserSelectMenuInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith(TV_PREFIX)) return;

  const channelId = interaction.channelId;
  if (!channelId) return;

  const tracked = getActiveChannel(channelId);
  if (!tracked || tracked.ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Error",
          "This channel is no longer tracked or you are not the owner.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  const vc = channel as VoiceChannel;

  const selectedUserId = interaction.values[0];
  const guild = interaction.guild!;

  switch (interaction.customId) {
    case SelectIds.KICK: {
      const targetMember = vc.members.get(selectedUserId);
      if (!targetMember) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Not Found",
              "That user is not in the voice channel.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      if (selectedUserId === interaction.user.id) {
        await interaction.reply({
          embeds: [errorEmbed("Error", "You cannot kick yourself.")],
          ephemeral: true,
        });
        return;
      }
      try {
        await targetMember.voice.disconnect("Kicked by channel owner");
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Kicked",
              `${targetMember} has been disconnected from the channel.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed("Error", "Failed to kick the user from the channel."),
          ],
          ephemeral: true,
        });
      }
      break;
    }

    case SelectIds.INVITE: {
      const targetUser = await guild.members
        .fetch(selectedUserId)
        .catch(() => null);
      if (!targetUser) {
        await interaction.reply({
          embeds: [errorEmbed("Not Found", "Could not find that user.")],
          ephemeral: true,
        });
        return;
      }
      try {
        const invite = await vc.createInvite({
          maxAge: 3600,
          maxUses: 1,
          unique: true,
        });
        const inviteEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Voice Channel Invite")
          .setDescription(
            `**${interaction.user.displayName}** has invited you to join their voice channel **${vc.name}** in **${guild.name}**!`,
          )
          .addFields({ name: "Join Link", value: invite.url })
          .setTimestamp();

        await targetUser.send({ embeds: [inviteEmbed] });
        await interaction.reply({
          embeds: [
            successEmbed(
              "Invite Sent",
              `An invite has been sent to ${targetUser} via DM.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Failed to Send",
              "Could not send the invite. The user may have DMs disabled.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }

    case SelectIds.TRANSFER: {
      const newOwner = await guild.members
        .fetch(selectedUserId)
        .catch(() => null);
      if (!newOwner) {
        await interaction.reply({
          embeds: [errorEmbed("Not Found", "Could not find that user.")],
          ephemeral: true,
        });
        return;
      }
      if (selectedUserId === interaction.user.id) {
        await interaction.reply({
          embeds: [
            errorEmbed("Error", "You already own this channel."),
          ],
          ephemeral: true,
        });
        return;
      }

      tracked.ownerId = newOwner.id;
      tracked.bannedUserIds = tracked.bannedUserIds.filter(
        (id) => id !== newOwner.id,
      );
      tracked.hiddenFromUserIds = tracked.hiddenFromUserIds.filter(
        (id) => id !== newOwner.id,
      );
      await updatePanel(vc, newOwner);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Ownership Transferred",
            `${newOwner} is now the owner of this channel.`,
          ),
        ],
        ephemeral: true,
      });
      break;
    }

    case SelectIds.BAN: {
      if (selectedUserId === interaction.user.id) {
        await interaction.reply({
          embeds: [errorEmbed("Error", "You cannot ban yourself.")],
          ephemeral: true,
        });
        return;
      }
      if (selectedUserId === interaction.client.user?.id) {
        await interaction.reply({
          embeds: [errorEmbed("Error", "You cannot ban the bot.")],
          ephemeral: true,
        });
        return;
      }
      if (tracked.bannedUserIds.includes(selectedUserId)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Already Banned",
              "That user is already banned from this channel.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        await vc.permissionOverwrites.edit(selectedUserId, {
          Connect: false,
        });

        const targetInChannel = vc.members.get(selectedUserId);
        if (targetInChannel) {
          await targetInChannel.voice.disconnect(
            "Banned from temp voice channel",
          );
        }

        tracked.bannedUserIds.push(selectedUserId);

        const targetUser = await guild.members
          .fetch(selectedUserId)
          .catch(() => null);
        const displayName = targetUser
          ? `${targetUser}`
          : `<@${selectedUserId}>`;

        await updatePanel(vc, interaction.member as GuildMember);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Banned",
              `${displayName} has been banned from this channel.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "Failed to ban the user from this channel.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }

    case SelectIds.HIDE_FROM: {
      if (selectedUserId === interaction.user.id) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "You cannot hide the channel from yourself.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      if (selectedUserId === interaction.client.user?.id) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "You cannot hide the channel from the bot.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      if (tracked.hiddenFromUserIds.includes(selectedUserId)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Already Hidden",
              "This channel is already hidden from that user.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        await vc.permissionOverwrites.edit(selectedUserId, {
          ViewChannel: false,
        });

        const targetInChannel = vc.members.get(selectedUserId);
        if (targetInChannel) {
          await targetInChannel.voice.disconnect(
            "Hidden from temp voice channel",
          );
        }

        tracked.hiddenFromUserIds.push(selectedUserId);

        const targetUser = await guild.members
          .fetch(selectedUserId)
          .catch(() => null);
        const displayName = targetUser
          ? `${targetUser}`
          : `<@${selectedUserId}>`;

        await updatePanel(vc, interaction.member as GuildMember);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Hidden",
              `This channel is now hidden from ${displayName}.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "Failed to hide the channel from that user.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }
  }
}

// ── Modal Handler ──

export async function handleTempVoiceModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith(TV_PREFIX)) return;

  const channelId = interaction.channelId;
  if (!channelId) return;

  const tracked = getActiveChannel(channelId);
  if (!tracked || tracked.ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Error",
          "This channel is no longer tracked or you are not the owner.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  const vc = channel as VoiceChannel;
  const member = interaction.member as GuildMember;

  switch (interaction.customId) {
    case ModalIds.RENAME: {
      const newName = interaction.fields
        .getTextInputValue(InputIds.CHANNEL_NAME)
        .trim();
      if (!newName) {
        await interaction.reply({
          embeds: [errorEmbed("Invalid Name", "Channel name cannot be empty.")],
          ephemeral: true,
        });
        return;
      }
      try {
        await vc.setName(newName);
        await updatePanel(vc, member);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "Channel Renamed",
              `Channel renamed to **${newName}**.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "Failed to rename the channel. You may be rate limited — try again in a few minutes.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }

    case ModalIds.LIMIT: {
      const raw = interaction.fields
        .getTextInputValue(InputIds.USER_LIMIT)
        .trim();
      const limit = parseInt(raw, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Invalid Limit",
              "Please enter a number between 0 and 99.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      try {
        await vc.setUserLimit(limit);
        await updatePanel(vc, member);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Limit Updated",
              limit === 0
                ? "User limit removed (unlimited)."
                : `User limit set to **${limit}**.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [errorEmbed("Error", "Failed to update the user limit.")],
          ephemeral: true,
        });
      }
      break;
    }
  }
}

// ── String Select Menu Handler ──

export async function handleTempVoiceStringSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith(TV_PREFIX)) return;

  const channelId = interaction.channelId;
  if (!channelId) return;

  const tracked = getActiveChannel(channelId);
  if (!tracked || tracked.ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Error",
          "This channel is no longer tracked or you are not the owner.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild?.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  const vc = channel as VoiceChannel;

  const selectedUserId = interaction.values[0];

  switch (interaction.customId) {
    case SelectIds.UNBAN: {
      if (!tracked.bannedUserIds.includes(selectedUserId)) {
        await interaction.reply({
          embeds: [
            errorEmbed("Error", "That user is not in the ban list."),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        await vc.permissionOverwrites.edit(selectedUserId, {
          Connect: null,
        });

        tracked.bannedUserIds = tracked.bannedUserIds.filter(
          (id) => id !== selectedUserId,
        );

        const targetUser = await interaction.guild!.members
          .fetch(selectedUserId)
          .catch(() => null);
        const displayName = targetUser
          ? `${targetUser}`
          : `<@${selectedUserId}>`;

        await updatePanel(vc, interaction.member as GuildMember);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Unbanned",
              `${displayName} has been unbanned from this channel.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "Failed to unban the user from this channel.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }

    case SelectIds.UNHIDE_FROM: {
      if (!tracked.hiddenFromUserIds.includes(selectedUserId)) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "That user is not in the hidden-from list.",
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      try {
        await vc.permissionOverwrites.edit(selectedUserId, {
          ViewChannel: null,
        });

        tracked.hiddenFromUserIds = tracked.hiddenFromUserIds.filter(
          (id) => id !== selectedUserId,
        );

        const targetUser = await interaction.guild!.members
          .fetch(selectedUserId)
          .catch(() => null);
        const displayName = targetUser
          ? `${targetUser}`
          : `<@${selectedUserId}>`;

        await updatePanel(vc, interaction.member as GuildMember);
        await persistChannelState(tracked, vc);
        await interaction.reply({
          embeds: [
            successEmbed(
              "User Unhidden",
              `This channel is now visible to ${displayName} again.`,
            ),
          ],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "Error",
              "Failed to unhide the channel from that user.",
            ),
          ],
          ephemeral: true,
        });
      }
      break;
    }
  }
}
