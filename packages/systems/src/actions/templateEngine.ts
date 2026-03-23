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

/**
 * Escapes template variable syntax in a string to prevent injection.
 * Replaces `{` with a zero-width space prefix so patterns like `{user.id}`
 * in user-generated content won't be resolved as template variables.
 */
function escapeTemplateVars(value: string): string {
  return value.replace(/\{/g, "\u200B{");
}

export function resolveTemplate(
  template: string,
  context: EventContext,
): string {
  let result = template;

  // Resolve event-specific variables first, escaping user-controlled values
  // to prevent template injection (e.g. message.content containing "{user.id}")
  if (context.extra) {
    for (const [key, value] of Object.entries(context.extra)) {
      const variable = `{${key}}`;
      if (result.includes(variable)) {
        result = result.replaceAll(variable, escapeTemplateVars(value));
      }
    }
  }

  // Then resolve core template variables
  for (const [variable, resolver] of Object.entries(VARIABLE_MAP)) {
    if (result.includes(variable)) {
      result = result.replaceAll(variable, resolver(context));
    }
  }

  if (result.length > MAX_TEMPLATE_LENGTH) {
    result = result.slice(0, MAX_TEMPLATE_LENGTH);
  }
  return result;
}
