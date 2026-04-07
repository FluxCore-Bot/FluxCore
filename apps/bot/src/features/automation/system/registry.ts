import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { lookup } from "node:dns/promises";
import { resolveTemplate } from "@fluxcore/systems/actions/templateEngine";
import type { ActionConfig, ActionType, EventContext } from "@fluxcore/systems/actions/types";
import { EVENT_TYPES, MAX_TEMPLATE_LENGTH } from "@fluxcore/systems/actions/constants";
import { logger } from "@fluxcore/utils";

type ActionExecutor = (
  client: Client,
  context: EventContext,
  config: ActionConfig,
) => Promise<void>;

/**
 * Validates that a moderator-supplied emoji is either a single Unicode
 * emoji cluster or a Discord custom-emoji literal `<:name:id>` /
 * `<a:name:id>`. Anything else is rejected to avoid hitting the Discord
 * API with garbage values.
 */
const CUSTOM_EMOJI_REGEX = /^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/;
// Matches strings whose code points all belong to the Unicode "Emoji"
// property (single emoji or ZWJ sequence). Length cap of 64 covers
// flag/family ZWJ sequences while preventing pathological inputs.
const UNICODE_EMOJI_REGEX =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Component}))*$/u;

function isValidEmoji(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return false;
  }
  if (CUSTOM_EMOJI_REGEX.test(value)) return true;
  return UNICODE_EMOJI_REGEX.test(value);
}

const executors = new Map<ActionType, ActionExecutor>();

executors.set("sendMessage", async (client, ctx, config) => {
  if (!config.channelId || !config.message) return;
  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;
  const resolved = resolveTemplate(config.message, ctx);
  await channel.send({
    content: resolved,
    allowedMentions: { users: ctx.userId ? [ctx.userId] : [] },
  });
});

executors.set("sendEmbed", async (client, ctx, config) => {
  if (!config.channelId || !config.embed) return;
  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;

  const embed = new EmbedBuilder().setTimestamp();
  if (config.embed.title) {
    embed.setTitle(resolveTemplate(config.embed.title, ctx));
  }
  if (config.embed.description) {
    embed.setDescription(resolveTemplate(config.embed.description, ctx));
  }
  if (config.embed.color !== undefined) {
    embed.setColor(config.embed.color);
  }
  if (config.embed.footer) {
    embed.setFooter({ text: resolveTemplate(config.embed.footer, ctx) });
  }
  await channel.send({ embeds: [embed] });
});

executors.set("sendDM", async (client, ctx, config) => {
  if (!config.message) return;
  const resolved = resolveTemplate(config.message, ctx);
  try {
    // Prefer ctx.member.user if available, otherwise fetch the user directly
    if (ctx.member) {
      await ctx.member.user.send(resolved);
    } else if (ctx.userId) {
      const user = await client.users.fetch(ctx.userId);
      await user.send(resolved);
    }
  } catch (err) {
    logger.warn(`sendDM failed for user ${ctx.userId ?? "unknown"}: ${err instanceof Error ? err.message : String(err)}`);
  }
});

executors.set("addRole", async (_client, ctx, config) => {
  if (!ctx.member || !config.roleId) return;
  await ctx.member.roles.add(config.roleId);
});

executors.set("removeRole", async (_client, ctx, config) => {
  if (!ctx.member || !config.roleId) return;
  await ctx.member.roles.remove(config.roleId);
});

executors.set("logToChannel", async (client, ctx, config) => {
  if (!config.channelId) return;
  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;

  const eventInfo = EVENT_TYPES[ctx.eventType];
  const embed = new EmbedBuilder()
    .setTitle(`Event: ${eventInfo?.label ?? ctx.eventType}`)
    .setColor(0x5865f2)
    .setTimestamp()
    .addFields(
      { name: "Event", value: ctx.eventType, inline: true },
      {
        name: "User",
        value: ctx.userMention ?? ctx.userName ?? "N/A",
        inline: true,
      },
      {
        name: "Channel",
        value: ctx.channelMention ?? ctx.channelName ?? "N/A",
        inline: true,
      },
    );

  if (ctx.roleName) {
    embed.addFields({ name: "Role", value: ctx.roleName, inline: true });
  }

  await channel.send({ embeds: [embed] });
});

// --- Webhook ---

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

function isPrivateIP(address: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(address));
}

async function isPrivateHost(hostname: string): Promise<boolean> {
  if (hostname === "localhost") return true;
  // Check hostname string first (catches IP literals)
  if (isPrivateIP(hostname)) return true;
  // Resolve DNS and check the actual IP to prevent DNS rebinding
  try {
    const { address } = await lookup(hostname);
    return isPrivateIP(address);
  } catch {
    // DNS resolution failed — block to be safe
    return true;
  }
}

executors.set("sendWebhook", async (_client, ctx, config) => {
  if (!config.webhook?.url) return;

  let url: URL;
  try {
    url = new URL(config.webhook.url);
  } catch {
    logger.warn(`Invalid webhook URL in action config: ${config.webhook.url}`);
    return;
  }

  if (url.protocol !== "https:") {
    logger.warn(`Webhook URL must use HTTPS: ${config.webhook.url}`);
    return;
  }

  if (await isPrivateHost(url.hostname)) {
    logger.warn(`Webhook URL points to private/internal host: ${url.hostname}`);
    return;
  }

  let body = config.webhook.bodyTemplate ?? JSON.stringify({
    event: ctx.eventType,
    guild: ctx.guildName,
    user: ctx.userName,
    channel: ctx.channelName,
    timestamp: ctx.timestamp,
  });
  body = resolveTemplate(body, ctx);

  if (body.length > MAX_TEMPLATE_LENGTH) {
    body = body.slice(0, MAX_TEMPLATE_LENGTH);
  }

  // Strict allowlist: only headers that are safe for the bot to forward on
  // behalf of a guild admin. Denylists are unsafe — any new sensitive
  // header (Authorization, X-Api-Key, X-Forwarded-*, Cookie, etc.) would
  // silently leak. Add to this set only after a security review.
  const ALLOWED_HEADERS = new Set([
    "accept",
    "accept-language",
    "cache-control",
    "user-agent",
    "x-idempotency-key",
    "x-request-id",
  ]);
  const ALLOWED_PREFIX = "x-fluxcore-";

  const userHeaders = config.webhook.headers ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  for (const [key, value] of Object.entries(userHeaders)) {
    const lower = key.toLowerCase();
    if (lower === "content-type") continue; // we set this ourselves
    if (ALLOWED_HEADERS.has(lower) || lower.startsWith(ALLOWED_PREFIX)) {
      headers[key] = value;
    } else {
      logger.warn(
        `sendWebhook: dropped non-allowlisted header "${key}" for guild ${ctx.guildId ?? "unknown"}`,
      );
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(config.webhook.url, {
      method: config.webhook.method ?? "POST",
      headers,
      body,
      signal: controller.signal,
    });
    // Consume response body to release the connection
    await response.text();
  } finally {
    clearTimeout(timeout);
  }
});

// --- Set Nickname ---

executors.set("setNickname", async (client, ctx, config) => {
  if (!config.nickname) return;
  try {
    // Fetch member from guild if not in context
    let member = ctx.member;
    if (!member && ctx.userId && ctx.guildId) {
      const guild = await client.guilds.fetch(ctx.guildId);
      member = await guild.members.fetch(ctx.userId);
    }
    if (!member) return;
    const resolved = resolveTemplate(config.nickname, ctx);
    await member.setNickname(resolved.slice(0, 32));
  } catch (err) {
    logger.warn(`setNickname failed for user ${ctx.userId ?? "unknown"}: ${err instanceof Error ? err.message : String(err)}`);
  }
});

// --- Create Thread ---

executors.set("createThread", async (client, ctx, config) => {
  if (!config.channelId || !config.threadName) return;
  const channel = await client.channels.fetch(config.channelId);
  if (!channel?.isTextBased() || !("threads" in channel)) return;
  const resolved = resolveTemplate(config.threadName, ctx);
  await (channel as TextChannel).threads.create({
    name: resolved.slice(0, 100),
  });
});

// --- Add Reaction ---

executors.set("addReaction", async (client, ctx, config) => {
  if (!config.emoji || !ctx.extra?.["message.id"] || !ctx.channelId) return;
  if (!isValidEmoji(config.emoji)) {
    logger.warn(
      `addReaction skipped: invalid emoji "${config.emoji}" for guild ${ctx.guildId ?? "unknown"}`,
    );
    return;
  }
  const channel = await client.channels.fetch(ctx.channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) return;
  try {
    const message = await (channel as TextChannel).messages.fetch(
      ctx.extra["message.id"],
    );
    await message.react(config.emoji);
  } catch (err) {
    logger.warn(`addReaction failed (emoji: ${config.emoji}, message: ${ctx.extra?.["message.id"] ?? "unknown"}): ${err instanceof Error ? err.message : String(err)}`);
  }
});

export function getExecutor(actionType: ActionType): ActionExecutor | undefined {
  return executors.get(actionType);
}
