import type { EventContext } from "./types.js";
import { MAX_TEMPLATE_LENGTH } from "./constants.js";

type VariableResolver = (ctx: EventContext) => string;

const VARIABLE_MAP: Record<string, VariableResolver> = {
  "{user}": (ctx) => ctx.userMention ?? "Unknown User",
  "{user.name}": (ctx) => ctx.userName ?? "Unknown",
  "{user.tag}": (ctx) => ctx.userTag ?? "Unknown#0000",
  "{user.id}": (ctx) => ctx.userId ?? "0",
  "{channel}": (ctx) => ctx.channelMention ?? "Unknown Channel",
  "{channel.name}": (ctx) => ctx.channelName ?? "Unknown",
  "{channel.id}": (ctx) => ctx.channelId ?? "0",
  "{role}": (ctx) => ctx.roleMention ?? "Unknown Role",
  "{role.name}": (ctx) => ctx.roleName ?? "Unknown",
  "{role.id}": (ctx) => ctx.roleId ?? "0",
  "{guild}": (ctx) => ctx.guildName ?? "Unknown Server",
  "{guild.memberCount}": (ctx) => String(ctx.memberCount ?? 0),
  "{timestamp}": (ctx) => ctx.timestamp,
};

export function resolveTemplate(
  template: string,
  context: EventContext,
): string {
  let result = template;
  for (const [variable, resolver] of Object.entries(VARIABLE_MAP)) {
    if (result.includes(variable)) {
      result = result.replaceAll(variable, resolver(context));
    }
  }

  // Resolve event-specific variables from ctx.extra
  if (context.extra) {
    for (const [key, value] of Object.entries(context.extra)) {
      const variable = `{${key}}`;
      if (result.includes(variable)) {
        result = result.replaceAll(variable, value);
      }
    }
  }

  if (result.length > MAX_TEMPLATE_LENGTH) {
    result = result.slice(0, MAX_TEMPLATE_LENGTH);
  }
  return result;
}
