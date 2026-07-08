import type { TFunction } from "i18next";
import type { ActionConfig } from "../../../shared/lib/schemas";

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

/**
 * Build a short preview string for an action. Accepts a translator (rules
 * namespace) because it is called from multiple components; user-facing
 * template strings are resolved here rather than hardcoded in English.
 */
export function getActionPreview(action: ActionConfig, t: TFunction): string | null {
  switch (action.type) {
    case "sendMessage":
    case "sendDM":
      return action.message
        ? action.message.slice(0, 50) + (action.message.length > 50 ? "..." : "")
        : null;
    case "sendEmbed":
      return action.embed?.title ? t("actionPreview.embed", { title: action.embed.title }) : null;
    case "addRole":
    case "removeRole":
      return action.roleId ? t("actionPreview.roleId", { id: action.roleId.slice(0, 12) }) : null;
    case "setNickname":
      return action.nickname ?? null;
    case "createThread":
      return action.threadName ?? null;
    case "addReaction":
      return action.emoji ?? null;
    case "sendWebhook":
      return action.webhook?.url ? t("actionPreview.webhookConfigured") : null;
    case "logToChannel":
      return action.channelId ? t("actionPreview.channelConfigured") : null;
    default:
      return null;
  }
}
