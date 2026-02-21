import dotenv from "dotenv";

dotenv.config();

export interface Config {
  token: string;
  clientId: string;
  guildId: string | undefined;
  logLevel: "debug" | "info" | "warn" | "error";
}

function loadConfig(): Config {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID || undefined;
  const validLevels: Config["logLevel"][] = ["debug", "info", "warn", "error"];
  const rawLogLevel = process.env.LOG_LEVEL || "info";
  if (!validLevels.includes(rawLogLevel as Config["logLevel"])) {
    throw new Error(
      `Invalid LOG_LEVEL: "${rawLogLevel}". Must be one of: ${validLevels.join(", ")}`,
    );
  }
  const logLevel = rawLogLevel as Config["logLevel"];

  if (!token) {
    throw new Error("Missing required environment variable: DISCORD_TOKEN");
  }
  if (!clientId) {
    throw new Error("Missing required environment variable: CLIENT_ID");
  }

  return { token, clientId, guildId, logLevel };
}

export const config = loadConfig();
