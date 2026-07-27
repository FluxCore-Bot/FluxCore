import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { Command } from "@fluxcore/types";

export class ExtendedClient extends Client {
  public commands: Collection<string, Command> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Privileged: required for moderation commands
        GatewayIntentBits.GuildVoiceStates, // Required for temp voice channels
        GatewayIntentBits.GuildModeration, // Required for ban/unban action events
        GatewayIntentBits.GuildMessages, // Required for message events
        GatewayIntentBits.MessageContent, // Privileged: required for message content access
        GatewayIntentBits.GuildMessageReactions, // Required for reaction events
      ],
      // Without these, discord.js silently DROPS any event whose primary
      // structure is not already in cache. The bot only caches messages it has
      // seen since its last restart, so reactionAdded / reactionRemoved /
      // messageDeleted never fired for an older message — which breaks every
      // reaction-role automation attached to a pinned rules message, with no
      // error anywhere. Handlers that read a partial must fetch it first.
      partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.Channel,
        Partials.User,
      ],
    });
  }
}
