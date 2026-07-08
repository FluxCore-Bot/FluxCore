import type { PreviewRealData, RealDataKey, VariableDescriptor } from "./types";

export const welcomeVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{user.tag}", labelKey: "variables.userTag", example: "Ada#0001", group: "user", realKey: "userTag" },
  { token: "{user.name}", labelKey: "variables.userName", example: "Ada", group: "user", realKey: "userName" },
  { token: "{user.id}", labelKey: "variables.userId", example: "123456789012345678", group: "user", realKey: "userId" },
  { token: "{user.avatar}", labelKey: "variables.userAvatar", example: "https://cdn.discordapp.com/embed/avatars/0.png", group: "user", realKey: "userAvatar" },
  { token: "{server}", labelKey: "variables.server", example: "Acme", group: "server", realKey: "serverName" },
  { token: "{server.id}", labelKey: "variables.serverId", example: "987654321098765432", group: "server", realKey: "serverId" },
  { token: "{membercount}", labelKey: "variables.memberCount", example: "1,234", group: "server", realKey: "memberCount" },
  { token: "{server.icon}", labelKey: "variables.serverIcon", example: "https://cdn.discordapp.com/embed/avatars/0.png", group: "server", realKey: "serverIcon" },
];

export const customCommandVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.entries.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{username}", labelKey: "variables.entries.username", example: "Ada", group: "user", realKey: "userName" },
  { token: "{userId}", labelKey: "variables.entries.userId", example: "123456789012345678", group: "user", realKey: "userId" },
  { token: "{server}", labelKey: "variables.entries.server", example: "Acme", group: "server", realKey: "serverName" },
  { token: "{channel}", labelKey: "variables.entries.channel", example: "#general", group: "channel" },
  { token: "{channelName}", labelKey: "variables.entries.channelName", example: "general", group: "channel" },
  { token: "{memberCount}", labelKey: "variables.entries.memberCount", example: "1,234", group: "server", realKey: "memberCount" },
];

export const levelingVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "@Ada", group: "user", realKey: "userMention" },
  { token: "{level}", labelKey: "variables.level", example: "5", group: "event" },
];

export const tempvoiceVariables: VariableDescriptor[] = [
  { token: "{user}", labelKey: "variables.user", example: "Ada", group: "user", realKey: "userName" },
];

export function knownTokenSet(descriptors: VariableDescriptor[]): Set<string> {
  return new Set(descriptors.map((d) => d.token));
}

export function buildRealData(
  guild: { id: string; name: string; icon: string | null } | undefined,
  user: { userId: string; username: string; avatar: string | null } | undefined,
): PreviewRealData {
  const serverName = guild?.name ?? "My Server";
  const serverId = guild?.id ?? "987654321098765432";
  const serverIcon =
    guild?.icon && guild.id
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  const userName = user?.username ?? "User";
  const userId = user?.userId ?? "123456789012345678";
  const userAvatar =
    user?.avatar && user.userId
      ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  return {
    userMention: `@${userName}`,
    userName,
    userTag: userName,
    userId,
    userAvatar,
    serverName,
    serverId,
    serverIcon,
    memberCount: "1,234",
  };
}

export function buildTokenValues(
  descriptors: VariableDescriptor[],
  real: PreviewRealData,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of descriptors) {
    const value: string = d.realKey ? real[d.realKey as RealDataKey] : d.example;
    map.set(d.token, value);
  }
  return map;
}
