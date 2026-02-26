import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

// In a monorepo, turbo runs each package from its own directory (e.g. apps/bot/).
// Search for .env at both the local dir and the workspace root (2 levels up).
dotenv.config({ path: [".env", "../../.env", "../../.env.dev"] });

export interface Config {
  token: string;
  clientId: string;
  guildId: string | undefined;
  logLevel: "debug" | "info" | "warn" | "error";
  dashboardPort: number;
  dashboardClientSecret: string | undefined;
  dashboardCallbackUrl: string;
  dashboardSessionSecret: string;
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

  const dashboardPort = Number(process.env.DASHBOARD_PORT) || 3000;
  const dashboardClientSecret = process.env.DASHBOARD_CLIENT_SECRET || undefined;
  const dashboardCallbackUrl =
    process.env.DASHBOARD_CALLBACK_URL || `http://localhost:${dashboardPort}/auth/callback`;
  const dashboardSessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  const resolvedSessionSecret =
    dashboardSessionSecret || randomBytes(32).toString("hex");

  return {
    token,
    clientId,
    guildId,
    logLevel,
    dashboardPort,
    dashboardClientSecret,
    dashboardCallbackUrl,
    dashboardSessionSecret: resolvedSessionSecret,
  };
}

export const config = loadConfig();
