import type { Interaction } from "discord.js";
import type { ExtendedClient } from "../client/ExtendedClient.js";
import type { Event } from "@fluxcore/types";
import { isOnCooldown, setCooldown } from "@fluxcore/systems/cooldown";
import {
  handleTempVoiceButton,
  handleTempVoiceModal,
  handleTempVoiceUserSelect,
  handleTempVoiceStringSelect,
} from "../systems/tempVoice/interactions.js";
import { handleMusicButton } from "../systems/music/interactions.js";
import { handleActionsAutocomplete } from "../commands/admin/actions.js";
import { handlePlayAutocomplete } from "../commands/music/play.js";
import { handleRolePanelAutocomplete } from "../commands/general/rolepanel.js";
import { MU_PREFIX } from "@fluxcore/systems/music/constants";
import { handleRolePanelButton, handleRolePanelDropdown } from "@fluxcore/systems/rolePanel/handler";
import { errorEmbed, warnEmbed, logger } from "@fluxcore/utils";

const event: Event<"interactionCreate"> = {
  name: "interactionCreate",
  async execute(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "actions") {
        await handleActionsAutocomplete(interaction);
      } else if (interaction.commandName === "play") {
        await handlePlayAutocomplete(interaction);
      } else if (interaction.commandName === "rolepanel") {
        await handleRolePanelAutocomplete(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("rp_")) {
        const parts = interaction.customId.split("_");
        const panelId = parseInt(parts[1], 10);
        const roleId = parts[2];
        await handleRolePanelButton(interaction, panelId, roleId);
        return;
      }
      if (interaction.customId.startsWith(MU_PREFIX)) {
        await handleMusicButton(interaction);
      } else {
        await handleTempVoiceButton(interaction);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleTempVoiceModal(interaction);
      return;
    }

    if (interaction.isUserSelectMenu()) {
      await handleTempVoiceUserSelect(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("rpd_")) {
        const panelId = parseInt(interaction.customId.split("_")[1], 10);
        await handleRolePanelDropdown(interaction, panelId, interaction.values);
        return;
      }
      await handleTempVoiceStringSelect(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command found: ${interaction.commandName}`);
      return;
    }

    if (command.cooldown) {
      const { onCooldown, remainingMs } = isOnCooldown(
        interaction.commandName,
        interaction.user.id,
      );
      if (onCooldown) {
        const seconds = Math.ceil(remainingMs / 1000);
        await interaction.reply({
          embeds: [
            warnEmbed(
              "Cooldown",
              `Please wait **${seconds}s** before using \`/${interaction.commandName}\` again.`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    try {
      await command.execute(interaction);

      if (command.cooldown) {
        setCooldown(
          interaction.commandName,
          interaction.user.id,
          command.cooldown,
        );
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error));
      logger.error(
        `Error executing command "${interaction.commandName}"`,
        err,
      );

      const reply = {
        embeds: [
          errorEmbed("Error", "There was an error executing this command."),
        ],
        ephemeral: true,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch {
        logger.error(
          `Failed to send error reply for command "${interaction.commandName}"`,
        );
      }
    }
  },
};

export default event;
