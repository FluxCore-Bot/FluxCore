import type { MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import type { Event } from "@fluxcore/types";
import { handleRolePanelReaction } from "@fluxcore/systems/rolePanel/handler";
import { logger } from "@fluxcore/utils";

const event: Event<"messageReactionAdd"> = {
  name: "messageReactionAdd",
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      // Fetch partial data if needed
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch {
          return; // Message may have been deleted
        }
      }

      await handleRolePanelReaction(reaction, user, true);
    } catch (error) {
      logger.error(
        "Error handling messageReactionAdd",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  },
};

export default event;
