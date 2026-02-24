import { Client, Collection, GatewayIntentBits } from "discord.js";
import type { Command } from "../types/index.js";

export class ExtendedClient extends Client {
  public commands: Collection<string, Command> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Privileged: required for moderation commands
        GatewayIntentBits.GuildVoiceStates, // Required for temp voice channels
      ],
    });
  }
}
