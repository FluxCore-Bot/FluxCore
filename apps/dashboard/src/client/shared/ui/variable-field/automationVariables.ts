import type { RealDataKey, VariableDescriptor, VariableGroup } from "./types";

const REAL_KEYS: Record<string, RealDataKey> = {
  "{user}": "userMention",
  "{user.name}": "userName",
  "{user.tag}": "userTag",
  "{user.id}": "userId",
  "{guild}": "serverName",
  "{guild.memberCount}": "memberCount",
};

const GROUPS: Record<string, VariableGroup> = {
  "{user}": "user", "{user.name}": "user", "{user.tag}": "user", "{user.id}": "user",
  "{channel}": "channel", "{channel.name}": "channel", "{channel.id}": "channel",
  "{role}": "role", "{role.name}": "role", "{role.id}": "role",
  "{guild}": "server", "{guild.memberCount}": "server",
  "{message.content}": "message", "{message.id}": "message", "{message.url}": "message",
  "{emoji}": "event", "{emoji.name}": "event", "{ban.reason}": "event",
  "{old.nickname}": "event", "{new.nickname}": "event", "{boost.since}": "event",
  "{timeout.until}": "event", "{voice.channel}": "event", "{voice.channel.name}": "event",
  "{thread.name}": "event", "{thread.id}": "event", "{timestamp}": "misc",
};

const SAMPLES: Record<string, string> = {
  "{user}": "@Ada", "{user.name}": "Ada", "{user.tag}": "Ada#0001", "{user.id}": "123456789012345678",
  "{channel}": "#general", "{channel.name}": "general", "{channel.id}": "112233445566778899",
  "{role}": "@Members", "{role.name}": "Members", "{role.id}": "223344556677889900",
  "{guild}": "Acme", "{guild.memberCount}": "1,234", "{timestamp}": "just now",
  "{message.content}": "Hello world", "{message.id}": "334455667788990011", "{message.url}": "https://discord.com/channels/…",
  "{emoji}": "🎉", "{emoji.name}": "tada", "{ban.reason}": "Spamming",
  "{old.nickname}": "OldNick", "{new.nickname}": "NewNick", "{boost.since}": "2 days ago",
  "{timeout.until}": "in 1 hour", "{voice.channel}": "General VC", "{voice.channel.name}": "General VC",
  "{thread.name}": "help-thread", "{thread.id}": "445566778899001122",
};

export function buildAutomationVariables(
  constants: { eventTypeVariables: Record<string, string[]>; templateVariables: Record<string, string> },
  eventType: string,
): VariableDescriptor[] {
  const tokens = constants.eventTypeVariables[eventType] ?? [];
  return tokens.map((token) => ({
    token,
    description: constants.templateVariables[token] ?? token,
    example: SAMPLES[token] ?? token,
    group: GROUPS[token] ?? "misc",
    realKey: REAL_KEYS[token],
  }));
}
