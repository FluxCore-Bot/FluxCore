/**
 * Available template variables for custom command responses.
 */
export const TEMPLATE_VARIABLES: Record<string, string> = {
  "{user}": "Mention the user who triggered the command",
  "{username}": "Display name of the user",
  "{userId}": "User ID",
  "{server}": "Server name",
  "{channel}": "Channel mention",
  "{channelName}": "Channel name",
  "{memberCount}": "Server member count",
};

/**
 * Replace template variables in a string with actual values.
 */
export function replaceVariables(
  text: string,
  context: {
    userId: string;
    username: string;
    serverName: string;
    channelId: string;
    channelName: string;
    memberCount: number;
  },
): string {
  return text
    .replace(/\{user\}/g, `<@${context.userId}>`)
    .replace(/\{username\}/g, context.username)
    .replace(/\{userId\}/g, context.userId)
    .replace(/\{server\}/g, context.serverName)
    .replace(/\{channel\}/g, `<#${context.channelId}>`)
    .replace(/\{channelName\}/g, context.channelName)
    .replace(/\{memberCount\}/g, String(context.memberCount));
}
