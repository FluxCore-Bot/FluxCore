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
  dashboardPublicUrl: string;
  botSyncPort: number;
  botSyncSecret: string;
  botSyncUrl: string | undefined;
  lavalinkHost: string;
  lavalinkPort: number;
  lavalinkPassword: string;
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

  const isProduction = process.env.NODE_ENV === "production";
  const dashboardPort = Number(process.env.DASHBOARD_PORT) || 3000;
  const dashboardClientSecret = process.env.DASHBOARD_CLIENT_SECRET || undefined;
  const dashboardCallbackUrl = process.env.DASHBOARD_CALLBACK_URL || "";
  const dashboardSessionSecret = process.env.DASHBOARD_SESSION_SECRET;
  let resolvedSessionSecret: string;
  if (dashboardSessionSecret && dashboardSessionSecret.length >= 32) {
    resolvedSessionSecret = dashboardSessionSecret;
  } else if (isProduction) {
    throw new Error(
      "DASHBOARD_SESSION_SECRET is required in production and must be at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  } else {
    resolvedSessionSecret = randomBytes(32).toString("hex");
    console.warn(
      "[config] DASHBOARD_SESSION_SECRET not set — generated an ephemeral secret for development. " +
        "All sessions will be invalidated on restart.",
    );
  }

  const rawPublicUrl = process.env.DASHBOARD_PUBLIC_URL;
  let dashboardPublicUrl: string;
  if (rawPublicUrl) {
    let parsed: URL;
    try {
      parsed = new URL(rawPublicUrl);
    } catch {
      throw new Error(
        `Invalid DASHBOARD_PUBLIC_URL: "${rawPublicUrl}" is not a valid URL`,
      );
    }
    if (isProduction && parsed.protocol !== "https:") {
      throw new Error(
        "DASHBOARD_PUBLIC_URL must use https:// in production",
      );
    }
    // Strip trailing slash for predictable concatenation
    dashboardPublicUrl = rawPublicUrl.replace(/\/$/, "");
  } else if (isProduction) {
    throw new Error(
      "DASHBOARD_PUBLIC_URL is required in production (e.g. https://dashboard.example.com)",
    );
  } else {
    dashboardPublicUrl = `http://localhost:${dashboardPort}`;
  }

  const botSyncPort = Number(process.env.BOT_SYNC_PORT) || 3001;
  const botSyncSecret =
    process.env.BOT_SYNC_SECRET || randomBytes(32).toString("hex");
  const botSyncUrl = process.env.BOT_SYNC_URL || undefined;

  const lavalinkHost = process.env.LAVALINK_HOST || "lavalink";
  const lavalinkPort = Number(process.env.LAVALINK_PORT) || 2333;
  const lavalinkPassword = process.env.LAVALINK_PASSWORD || "youshallnotpass";

  return {
    token,
    clientId,
    guildId,
    logLevel,
    dashboardPort,
    dashboardClientSecret,
    dashboardCallbackUrl,
    dashboardSessionSecret: resolvedSessionSecret,
    dashboardPublicUrl,
    botSyncPort,
    botSyncSecret,
    botSyncUrl,
    lavalinkHost,
    lavalinkPort,
    lavalinkPassword,
  };
}

export const config = loadConfig();
