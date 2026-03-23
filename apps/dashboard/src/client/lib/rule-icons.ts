import type { ActionConfig } from "./schemas";

export const ACTION_ICONS: Record<string, string> = {
  sendMessage: "chat",
  sendEmbed: "dashboard_customize",
  sendDM: "mail",
  addRole: "person_add",
  removeRole: "person_remove",
  logToChannel: "receipt_long",
  sendWebhook: "webhook",
  setNickname: "badge",
  createThread: "forum",
  addReaction: "add_reaction",
};

export const EVENT_ICONS: Record<string, string> = {
  memberJoin: "person_add",
  memberLeave: "person_remove",
  memberBanned: "gavel",
  memberUnbanned: "lock_open",
  memberTimeout: "timer",
  messageCreated: "chat",
  messageDeleted: "delete",
  reactionAdded: "add_reaction",
  reactionRemoved: "remove",
  roleAdded: "shield_person",
  roleRemoved: "shield",
  channelCreated: "add_circle",
  channelDeleted: "remove_circle",
  voiceJoin: "mic",
  voiceLeave: "mic_off",
  nicknameChanged: "badge",
  threadCreated: "forum",
  boostStart: "rocket_launch",
  boostEnd: "rocket",
};

export function getActionPreview(action: ActionConfig): string | null {
  switch (action.type) {
    case "sendMessage":
    case "sendDM":
      return action.message
        ? action.message.slice(0, 50) + (action.message.length > 50 ? "..." : "")
        : null;
    case "sendEmbed":
      return action.embed?.title ? `Embed: ${action.embed.title}` : null;
    case "addRole":
    case "removeRole":
      return action.roleId ? `Role ID: ${action.roleId.slice(0, 12)}...` : null;
    case "setNickname":
      return action.nickname ?? null;
    case "createThread":
      return action.threadName ?? null;
    case "addReaction":
      return action.emoji ?? null;
    case "sendWebhook":
      return action.webhook?.url ? "Webhook configured" : null;
    case "logToChannel":
      return action.channelId ? "Channel configured" : null;
    default:
      return null;
  }
}
