import { EmbedBuilder, type Client } from "discord.js";
import { resolveTemplate } from "@fluxcore/systems/actions/templateEngine";
import type { ActionConfig, ActionType, EventContext } from "@fluxcore/systems/actions/types";
import { EVENT_TYPES } from "@fluxcore/systems/actions/constants";

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
    await ctx.member.send(resolved);
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

export function getExecutor(actionType: ActionType): ActionExecutor | undefined {
  return executors.get(actionType);
}
