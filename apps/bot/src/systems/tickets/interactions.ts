import {
  type ButtonInteraction,
  type ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type TextInputBuilder as TextInputType,
  AttachmentBuilder,
  type TextChannel,
  type APIEmbed,
  type JSONEncodable,
} from "discord.js";
import { infoEmbed, errorEmbed, logger } from "@fluxcore/utils";
import {
  getTicketByChannel,
  getOpenTicketCount,
  createTicket,
  claimTicket,
  closeTicket,
} from "@fluxcore/systems/tickets/persistence";
import { getTicketPanel } from "@fluxcore/systems/tickets/persistence";
import { getTicketSettings, incrementTicketCounter } from "@fluxcore/systems/tickets/config";
import {
  buildTicketWelcomeEmbed,
  buildTicketActionRow,
} from "@fluxcore/systems/tickets/builder";
import { buildTranscriptHtml } from "@fluxcore/systems/tickets/transcript";
import {
  TICKET_BUTTON_PREFIX,
  TICKET_CLAIM_ID,
  TICKET_CLOSE_ID,
  TRANSCRIPT_FETCH_LIMIT,
} from "@fluxcore/systems/tickets/constants";
import type { TicketCategory } from "@fluxcore/types";

export async function handleTicketButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId === TICKET_CLAIM_ID) {
    await handleClaimButton(interaction);
    return;
  }

  if (customId === TICKET_CLOSE_ID) {
    await handleCloseButton(interaction);
    return;
  }

  // Panel button: ticket_{panelId}_{categoryName}
  if (customId.startsWith(TICKET_BUTTON_PREFIX)) {
    await handlePanelButton(interaction);
    return;
  }
}

async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split("_");
  if (parts.length < 3) return;

  const panelId = parseInt(parts[1], 10);
  const categoryName = parts.slice(2).join("_");

  const panel = await getTicketPanel(panelId);
  if (!panel) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This ticket panel no longer exists.")],
      ephemeral: true,
    });
    return;
  }

  const category = panel.categories.find((c) => c.name === categoryName);

  // If category has form fields, show modal
  if (category?.formFields && category.formFields.length > 0) {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_form_${panelId}_${categoryName}`)
      .setTitle(`${category.label} -- New Ticket`);

    for (let i = 0; i < Math.min(category.formFields.length, 5); i++) {
      const field = category.formFields[i];
      const input = new TextInputBuilder()
        .setCustomId(`field_${i}`)
        .setLabel(field.label)
        .setStyle(field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(field.required);

      if (field.placeholder) input.setPlaceholder(field.placeholder);
      if (field.maxLength) input.setMaxLength(field.maxLength);

      modal.addComponents(
        new ActionRowBuilder<TextInputType>().addComponents(input),
      );
    }

    await interaction.showModal(modal);
    return;
  }

  // No form fields — create ticket directly
  await createTicketChannel(interaction, panelId, category ?? null, {});
}

async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;

  const ticket = await getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This channel is not a ticket.")],
      ephemeral: true,
    });
    return;
  }

  if (ticket.claimedBy) {
    await interaction.reply({
      embeds: [errorEmbed("Error", `This ticket is already claimed by <@${ticket.claimedBy}>.`)],
      ephemeral: true,
    });
    return;
  }

  const settings = await getTicketSettings(interaction.guildId);
  const member = interaction.member;
  const memberRoles = member && "cache" in (member.roles ?? {})
    ? (member.roles as { cache: Map<string, unknown> }).cache
    : null;

  const isStaff = settings.staffRoleIds.length === 0 ||
    settings.staffRoleIds.some((roleId) => memberRoles?.has(roleId));

  if (!isStaff) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "You do not have permission to claim tickets.")],
      ephemeral: true,
    });
    return;
  }

  try {
    await claimTicket(ticket.id, interaction.user.id);
    await interaction.reply({
      embeds: [infoEmbed("Ticket Claimed", `<@${interaction.user.id}> has claimed this ticket.`)],
    });
  } catch (error) {
    logger.error(
      `Failed to claim ticket ${ticket.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.reply({
      embeds: [errorEmbed("Error", "Failed to claim the ticket.")],
      ephemeral: true,
    });
  }
}

async function handleCloseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) return;

  const ticket = await getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This channel is not a ticket.")],
      ephemeral: true,
    });
    return;
  }

  if (ticket.status === "closed") {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This ticket is already closed.")],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const settings = await getTicketSettings(interaction.guildId);
    let transcriptUrl: string | undefined;

    // Generate transcript
    try {
      const channel = interaction.channel as TextChannel;
      const messages = await channel.messages.fetch({ limit: TRANSCRIPT_FETCH_LIMIT });
      const transcriptMessages = messages.reverse().map((m) => ({
        author: m.author.displayName ?? m.author.username,
        authorId: m.author.id,
        avatarUrl: m.author.displayAvatarURL({ size: 64 }),
        content: m.content,
        timestamp: m.createdAt,
        attachments: m.attachments.map((a) => a.url),
      }));

      const html = buildTranscriptHtml(
        ticket,
        transcriptMessages,
        interaction.guild?.name ?? "Unknown",
      );

      const attachment = new AttachmentBuilder(Buffer.from(html), {
        name: `transcript-${ticket.id}.html`,
      });

      if (settings.transcriptChannelId) {
        const transcriptChannel = interaction.guild?.channels.cache.get(
          settings.transcriptChannelId,
        );
        if (transcriptChannel?.isTextBased() && "send" in transcriptChannel) {
          const msg = await transcriptChannel.send({
            embeds: [
              infoEmbed(
                "Ticket Transcript",
                `Ticket #${ticket.id} by <@${ticket.userId}>\nClosed by <@${interaction.user.id}>`,
              ),
            ],
            files: [attachment],
          });
          transcriptUrl = msg.url;
        }
      }
    } catch (err) {
      logger.error(
        `Failed to generate transcript for ticket ${ticket.id}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    await closeTicket(ticket.id, undefined, transcriptUrl);

    await interaction.editReply({
      embeds: [
        infoEmbed(
          "Ticket Closed",
          `This ticket has been closed by <@${interaction.user.id}>.${transcriptUrl ? `\n[View Transcript](${transcriptUrl})` : ""}`,
        ),
      ],
    });

    // Delete channel after delay
    setTimeout(async () => {
      try {
        if (interaction.channel && "delete" in interaction.channel) {
          await interaction.channel.delete();
        }
      } catch (err) {
        logger.error(
          `Failed to delete ticket channel ${ticket.channelId}`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }, 5000);
  } catch (error) {
    logger.error(
      `Failed to close ticket ${ticket.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await interaction.editReply({
      embeds: [errorEmbed("Error", "Failed to close the ticket.")],
    });
  }
}

export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split("_");
  // ticket_form_{panelId}_{categoryName}
  if (parts.length < 4 || parts[0] !== "ticket" || parts[1] !== "form") return;

  const panelId = parseInt(parts[2], 10);
  const categoryName = parts.slice(3).join("_");

  const panel = await getTicketPanel(panelId);
  if (!panel) {
    await interaction.reply({
      embeds: [errorEmbed("Error", "This ticket panel no longer exists.")],
      ephemeral: true,
    });
    return;
  }

  const category = panel.categories.find((c) => c.name === categoryName);

  // Collect form responses
  const formResponses: Record<string, string> = {};
  if (category?.formFields) {
    for (let i = 0; i < category.formFields.length; i++) {
      const field = category.formFields[i];
      const value = interaction.fields.getTextInputValue(`field_${i}`);
      formResponses[field.label] = value;
    }
  }

  await createTicketChannel(interaction, panelId, category ?? null, formResponses);
}

async function createTicketChannel(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  panelId: number,
  category: TicketCategory | null,
  formResponses: Record<string, string>,
): Promise<void> {
  const guildId = interaction.guildId;
  const guild = interaction.guild;
  if (!guildId || !guild) {
    await safeReply(interaction, {
      embeds: [errorEmbed("Error", "This can only be used in a server.")],
      ephemeral: true,
    });
    return;
  }

  const settings = await getTicketSettings(guildId);

  // Check open ticket limit
  const openCount = await getOpenTicketCount(guildId, interaction.user.id);
  if (openCount >= settings.maxOpenPerUser) {
    await safeReply(interaction, {
      embeds: [
        errorEmbed(
          "Ticket Limit Reached",
          `You already have ${openCount} open ticket(s). Maximum is ${settings.maxOpenPerUser}.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await safeDeferReply(interaction);

  try {
    // Increment counter and generate channel name
    const ticketNumber = await incrementTicketCounter(guildId);
    const paddedNumber = String(ticketNumber).padStart(4, "0");
    const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "");
    const channelName = settings.namingFormat
      .replace("{number}", paddedNumber)
      .replace("{username}", username);

    // Determine staff roles for this category
    const staffRoleIds = category?.staffRoleIds?.length
      ? category.staffRoleIds
      : settings.staffRoleIds;

    // Build permission overwrites
    const permissionOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id, // ticket creator
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...staffRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ];

    // Add bot to the channel
    if (guild.members.me) {
      permissionOverwrites.push({
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
    });

    // Create ticket record
    await createTicket({
      guildId,
      channelId: channel.id,
      userId: interaction.user.id,
      categoryName: category?.name,
      panelId,
      formResponses,
    });

    // Send welcome embed with action buttons
    const welcomeEmbed = buildTicketWelcomeEmbed(
      interaction.user.id,
      category?.name ?? null,
      formResponses,
    );
    const actionRow = buildTicketActionRow();

    await channel.send({
      content: staffRoleIds.map((r) => `<@&${r}>`).join(" ") || undefined,
      embeds: [welcomeEmbed],
      components: [actionRow],
    });

    await safeEditReply(interaction, {
      embeds: [
        infoEmbed(
          "Ticket Created",
          `Your ticket has been created: <#${channel.id}>`,
        ),
      ],
    });
  } catch (error) {
    logger.error(
      `Failed to create ticket for user ${interaction.user.id}`,
      error instanceof Error ? error : new Error(String(error)),
    );
    await safeEditReply(interaction, {
      embeds: [errorEmbed("Error", "Failed to create the ticket. Please try again.")],
    });
  }
}

// Helper to handle reply differences between Button and Modal interactions
async function safeReply(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  data: { embeds: (APIEmbed | JSONEncodable<APIEmbed>)[]; ephemeral?: boolean },
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(data);
  } else {
    await interaction.reply(data);
  }
}

async function safeDeferReply(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.deferReply({ ephemeral: true });
  }
}

async function safeEditReply(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  data: { embeds: (APIEmbed | JSONEncodable<APIEmbed>)[] },
): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply(data);
  } else {
    await interaction.followUp({ ...data, ephemeral: true });
  }
}
