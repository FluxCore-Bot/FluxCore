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

/**
 * Every executor THROWS rather than returning when it cannot do its job.
 *
 * processEvent cannot distinguish "returned because there was nothing to do"
 * from "succeeded", so a silent return was written to the ActionLog as
 * `success: true`. A moderator whose auto-role rule never fired saw
 * "214 executions, 100% success" and had nothing to debug with. Throwing lets
 * the caller's existing catch record the real reason.
 */
function required<T>(value: T | undefined | null, actionType: string, field: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${actionType}: ${field} is required`);
  }
  return value;
}

/** Fetches a sendable text channel, or throws explaining which one failed. */
async function sendableChannel(client: Client, channelId: string, actionType: string) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("send" in channel)) {
    throw new Error(
      `${actionType}: channel ${channelId} is missing, not a text channel, or not visible to the bot`,
    );
  }
  return channel;
}

/**
 * Resolves the member to act on. Reaction, ban and message contexts often
 * carry no member object, which is why addRole/removeRole silently did nothing
 * on the single most common automation people build ("react here, get a role").
 */
async function resolveMember(client: Client, ctx: EventContext, actionType: string) {
  if (ctx.member) return ctx.member;
  if (!ctx.userId || !ctx.guildId) {
    throw new Error(`${actionType}: no member in context and no user/guild to resolve one from`);
  }
  try {
    const guild = await client.guilds.fetch(ctx.guildId);
    return await guild.members.fetch(ctx.userId);
  } catch (err) {
    throw new Error(
      `${actionType}: could not resolve member ${ctx.userId} in guild ${ctx.guildId} (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

const executors = new Map<ActionType, ActionExecutor>();

executors.set("sendMessage", async (client, ctx, config) => {
  const channelId = required(config.channelId, "sendMessage", "channelId");
  const message = required(config.message, "sendMessage", "message");
  const channel = await sendableChannel(client, channelId, "sendMessage");
  const resolved = resolveTemplate(message, ctx);
  await channel.send({
    content: resolved,
    allowedMentions: { users: ctx.userId ? [ctx.userId] : [] },
  });
});

executors.set("sendEmbed", async (client, ctx, config) => {
  const channelId = required(config.channelId, "sendEmbed", "channelId");
  const embedConfig = required(config.embed, "sendEmbed", "embed");
  const channel = await sendableChannel(client, channelId, "sendEmbed");

  const embed = new EmbedBuilder().setTimestamp();
  if (embedConfig.title) {
    embed.setTitle(resolveTemplate(embedConfig.title, ctx));
  }
  if (embedConfig.description) {
    embed.setDescription(resolveTemplate(embedConfig.description, ctx));
  }
  if (embedConfig.color !== undefined) {
    embed.setColor(embedConfig.color);
  }
  if (embedConfig.footer) {
    embed.setFooter({ text: resolveTemplate(embedConfig.footer, ctx) });
  }
  await channel.send({ embeds: [embed] });
});

executors.set("sendDM", async (client, ctx, config) => {
  const message = required(config.message, "sendDM", "message");
  const resolved = resolveTemplate(message, ctx);
  // A closed DM is a real, reportable failure — the moderator needs to know
  // their welcome DM is not arriving, not see it logged as a success.
  if (ctx.member) {
    await ctx.member.user.send(resolved);
    return;
  }
  const userId = required(ctx.userId, "sendDM", "a user to DM");
  const user = await client.users.fetch(userId);
  await user.send(resolved);
});

executors.set("addRole", async (client, ctx, config) => {
  const roleId = required(config.roleId, "addRole", "roleId");
  const member = await resolveMember(client, ctx, "addRole");
  await member.roles.add(roleId);
});

executors.set("removeRole", async (client, ctx, config) => {
  const roleId = required(config.roleId, "removeRole", "roleId");
  const member = await resolveMember(client, ctx, "removeRole");
  await member.roles.remove(roleId);
});

executors.set("logToChannel", async (client, ctx, config) => {
  const channelId = required(config.channelId, "logToChannel", "channelId");
  const channel = await sendableChannel(client, channelId, "logToChannel");

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

const MAX_WEBHOOK_REDIRECTS = 3;
const MAX_WEBHOOK_RESPONSE_BYTES = 64 * 1024;

/** Throws unless the URL is https and does not resolve to a private address. */
async function assertSafeWebhookTarget(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`sendWebhook: "${raw}" is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`sendWebhook: URL must use HTTPS, got ${url.protocol.replace(":", "")}`);
  }
  if (await isPrivateHost(url.hostname)) {
    throw new Error(`sendWebhook: ${url.hostname} resolves to a private/internal address`);
  }
  return url;
}

/**
 * Reads at most `MAX_WEBHOOK_RESPONSE_BYTES` and then cancels the stream.
 * `await response.text()` buffers whatever the remote chooses to send, so a
 * hostile or broken endpoint could stream until the bot ran out of memory. We
 * only read at all to release the connection; the content is never used.
 */
async function drainCapped(response: { body?: unknown; text?: () => Promise<string> }): Promise<void> {
  const body = response.body as
    | { getReader(): { read(): Promise<{ done: boolean; value?: { length: number } }>; cancel(): unknown } }
    | null
    | undefined;
  if (!body?.getReader) {
    await response.text?.();
    return;
  }
  const reader = body.getReader();
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value?.length ?? 0;
      if (read >= MAX_WEBHOOK_RESPONSE_BYTES) break;
    }
  } finally {
    await reader.cancel();
  }
}

executors.set("sendWebhook", async (_client, ctx, config) => {
  const rawUrl = required(config.webhook?.url, "sendWebhook", "webhook.url");
  let url = await assertSafeWebhookTarget(rawUrl);

  let body = config.webhook?.bodyTemplate ?? JSON.stringify({
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

  const userHeaders = config.webhook?.headers ?? {};
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

  // Redirects are followed BY HAND so every hop is re-checked against the
  // private-address rules. With fetch's automatic following, the SSRF guard ran
  // once against the original hostname and a public host answering
  // "302 -> http://169.254.169.254/" walked straight into the cloud metadata
  // service.
  for (let hop = 0; ; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: config.webhook?.method ?? "POST",
        headers,
        body,
        signal: controller.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await drainCapped(response);
      if (!location) {
        throw new Error(`sendWebhook: ${response.status} redirect with no Location header`);
      }
      if (hop >= MAX_WEBHOOK_REDIRECTS) {
        throw new Error(`sendWebhook: too many redirects (>${MAX_WEBHOOK_REDIRECTS})`);
      }
      url = await assertSafeWebhookTarget(new URL(location, url).toString());
      continue;
    }

    await drainCapped(response);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`sendWebhook: ${url.hostname} responded ${response.status}`);
    }
    return;
  }
});

// --- Set Nickname ---

executors.set("setNickname", async (client, ctx, config) => {
  const nickname = required(config.nickname, "setNickname", "nickname");
  const member = await resolveMember(client, ctx, "setNickname");
  const resolved = resolveTemplate(nickname, ctx);
  await member.setNickname(resolved.slice(0, 32));
});

// --- Create Thread ---

executors.set("createThread", async (client, ctx, config) => {
  const channelId = required(config.channelId, "createThread", "channelId");
  const threadName = required(config.threadName, "createThread", "threadName");
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("threads" in channel)) {
    throw new Error(
      `createThread: channel ${channelId} is missing, not visible to the bot, or does not support threads`,
    );
  }
  const resolved = resolveTemplate(threadName, ctx);
  await (channel as TextChannel).threads.create({
    name: resolved.slice(0, 100),
  });
});

// --- Add Reaction ---

executors.set("addReaction", async (client, ctx, config) => {
  const emoji = required(config.emoji, "addReaction", "emoji");
  if (!isValidEmoji(emoji)) {
    throw new Error(`addReaction: "${emoji}" is not a valid unicode or custom emoji`);
  }
  const messageId = required(ctx.extra?.["message.id"], "addReaction", "a triggering message");
  const channelId = required(ctx.channelId, "addReaction", "a channel in the event context");
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    throw new Error(`addReaction: channel ${channelId} is missing or not visible to the bot`);
  }
  const message = await (channel as TextChannel).messages.fetch(messageId);
  await message.react(emoji);
});

export function getExecutor(actionType: ActionType): ActionExecutor | undefined {
  return executors.get(actionType);
}
