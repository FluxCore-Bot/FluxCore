import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
  type Message,
  type Collection,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  checkPermissions,
  checkBotPermissions,
  logger,
} from "@fluxcore/utils";

const URL_REGEX = /https?:\/\/\S+/i;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages with optional filters")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((option) =>
      option.setName("user").setDescription("Filter by user"),
    )
    .addBooleanOption((option) =>
      option.setName("bots").setDescription("Only delete bot messages"),
    )
    .addStringOption((option) =>
      option.setName("contains").setDescription("Only messages containing this text"),
    )
    .addStringOption((option) =>
      option
        .setName("has")
        .setDescription("Filter by content type")
        .addChoices(
          { name: "Links", value: "links" },
          { name: "Attachments", value: "attachments" },
          { name: "Embeds", value: "embeds" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "Moderation",
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ])) ||
      !(await checkBotPermissions(interaction, [
        PermissionFlagsBits.ManageMessages,
      ]))
    ) {
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const userFilter = interaction.options.getUser("user");
    const botsOnly = interaction.options.getBoolean("bots") ?? false;
    const containsText = interaction.options.getString("contains");
    const hasFilter = interaction.options.getString("has");

    const channel = interaction.channel as TextChannel | null;
    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({
        embeds: [errorEmbed("Error", "This command can only be used in text channels.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const hasAnyFilter = userFilter || botsOnly || containsText || hasFilter;

    try {
      // Fetch extra messages for headroom when filtering
      const fetchAmount = hasAnyFilter ? Math.min(amount * 2, 100) : amount;
      const fetched: Collection<string, Message> = await channel.messages.fetch({ limit: fetchAmount });

      const now = Date.now();
      let filtered = [...fetched.values()].filter(
        (msg) => now - msg.createdTimestamp < FOURTEEN_DAYS_MS,
      );

      if (userFilter) {
        filtered = filtered.filter((msg) => msg.author.id === userFilter.id);
      }
      if (botsOnly) {
        filtered = filtered.filter((msg) => msg.author.bot);
      }
      if (containsText) {
        const lower = containsText.toLowerCase();
        filtered = filtered.filter((msg) => msg.content.toLowerCase().includes(lower));
      }
      if (hasFilter === "links") {
        filtered = filtered.filter((msg) => URL_REGEX.test(msg.content));
      } else if (hasFilter === "attachments") {
        filtered = filtered.filter((msg) => msg.attachments.size > 0);
      } else if (hasFilter === "embeds") {
        filtered = filtered.filter((msg) => msg.embeds.length > 0);
      }

      // Limit to requested amount
      const toDelete = filtered.slice(0, amount);

      if (toDelete.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed("No Messages", "No messages matched the given filters.")],
        });
        return;
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      await interaction.editReply({
        embeds: [
          successEmbed(
            "Messages Purged",
            `Successfully deleted **${deleted.size}** message${deleted.size === 1 ? "" : "s"}.`,
          ),
        ],
      });
    } catch (error) {
      logger.error(
        `Failed to purge messages in ${channel.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      await interaction.editReply({
        embeds: [errorEmbed("Purge Failed", "Failed to delete messages.")],
      });
    }
  },
};

export default command;
