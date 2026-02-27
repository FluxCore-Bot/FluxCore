import { randomBytes } from "node:crypto";
import { config } from "@fluxcore/config";
import type { OAuthGuild } from "./session.js";

const DISCORD_API = "https://discord.com/api/v10";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export function getAuthorizationUrl(): { url: string; state: string } {
  const state = randomBytes(32).toString("hex");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.dashboardCallbackUrl,
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  return { url: `${DISCORD_API}/oauth2/authorize?${params}`, state };
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.dashboardClientSecret!,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.dashboardCallbackUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status}`);
  }
  return res.json() as Promise<DiscordUser>;
}

export async function fetchGuilds(accessToken: string): Promise<OAuthGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch guilds: ${res.status}`);
  }
  return res.json() as Promise<OAuthGuild[]>;
}
