import type { MessageReaction, PartialMessageReaction, User, PartialUser } from "discord.js";
import type { Event } from "@fluxcore/types";
import { handleRolePanelReaction } from "@fluxcore/systems/rolePanel/handler";
import { handleStarboardReaction } from "@fluxcore/systems/starboard/handler";
import { logger } from "@fluxcore/utils";

const event: Event<"messageReactionRemove"> = {
  name: "messageReactionRemove",
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

      await Promise.allSettled([
        handleRolePanelReaction(reaction, user, false),
        handleStarboardReaction(reaction, user),
      ]);
    } catch (error) {
      logger.error(
        "Error handling messageReactionRemove",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  },
};

export default event;
