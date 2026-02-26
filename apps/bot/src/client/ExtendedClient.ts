import { Client, Collection, GatewayIntentBits } from "discord.js";
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
    });
  }
}
