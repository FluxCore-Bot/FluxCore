import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { resolveTemplate } from "@fluxcore/systems/actions/templateEngine";
import type { ActionConfig, ActionType, EventContext } from "@fluxcore/systems/actions/types";
import { EVENT_TYPES, MAX_TEMPLATE_LENGTH } from "@fluxcore/systems/actions/constants";
import { logger } from "@fluxcore/utils";

type ActionExecutor = (
  client: Client,
  context: EventContext,
  config: ActionConfig,
) => Promise<void>;

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

executors.set("sendDM", async (_client, ctx, config) => {
  if (!ctx.member || !config.message) return;
  const resolved = resolveTemplate(config.message, ctx);
  try {
    await ctx.member.user.send(resolved);
  } catch {
    // User may have DMs disabled — silently skip
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

function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost") return true;
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
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

  if (isPrivateHost(url.hostname)) {
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

  const BLOCKED_HEADERS = new Set([
    "host", "cookie", "set-cookie", "transfer-encoding",
    "connection", "proxy-authorization", "te", "trailer",
    "upgrade",
  ]);
  const userHeaders = config.webhook.headers ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  for (const [key, value] of Object.entries(userHeaders)) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(config.webhook.url, {
      method: config.webhook.method ?? "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
});

// --- Set Nickname ---

executors.set("setNickname", async (_client, ctx, config) => {
  if (!ctx.member || !config.nickname) return;
  const resolved = resolveTemplate(config.nickname, ctx);
  await ctx.member.setNickname(resolved.slice(0, 32));
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
  const channel = await client.channels.fetch(ctx.channelId);
  if (!channel?.isTextBased() || !("messages" in channel)) return;
  try {
    const message = await (channel as TextChannel).messages.fetch(
      ctx.extra["message.id"],
    );
    await message.react(config.emoji);
  } catch {
    // Message may have been deleted or emoji may be invalid
  }
});

export function getExecutor(actionType: ActionType): ActionExecutor | undefined {
  return executors.get(actionType);
}
