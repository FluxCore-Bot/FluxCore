import type { GuildMember } from "discord.js";

/** Supported event types that admins can listen to */
export type ActionEventType =
  | "memberJoin"
  | "memberLeave"
  | "memberBanned"
  | "memberUnbanned"
  | "messageDeleted"
  | "roleAdded"
  | "roleRemoved"
  | "channelCreated"
  | "channelDeleted"
  | "voiceJoin"
  | "voiceLeave"
  | "messageCreated"
  | "reactionAdded"
  | "reactionRemoved"
  | "nicknameChanged"
  | "memberTimeout"
  | "threadCreated"
  | "boostStart"
  | "boostEnd";

/** Supported action types that can be triggered */
export type ActionType =
  | "sendMessage"
  | "sendEmbed"
  | "sendDM"
  | "addRole"
  | "removeRole"
  | "logToChannel"
  | "sendWebhook"
  | "setNickname"
  | "createThread"
  | "addReaction";

/** Embed configuration for sendEmbed actions */
export interface ActionEmbedConfig {
  title?: string;
  description?: string;
  color?: number;
  footer?: string;
}

/** Webhook configuration for sendWebhook actions */
export interface ActionWebhookConfig {
  url: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  bodyTemplate?: string;
}

/** A single action configuration within a rule */
export interface ActionConfig {
  type: ActionType;
  channelId?: string;
  roleId?: string;
  message?: string;
  embed?: ActionEmbedConfig;
  webhook?: ActionWebhookConfig;
  nickname?: string;
  threadName?: string;
  emoji?: string;
}

/** Filter conditions for when the rule should fire */
export interface ActionConditions {
  channelIds?: string[];
  roleIds?: string[];
  userIds?: string[];
  excludeChannelIds?: string[];
  excludeRoleIds?: string[];
  excludeUserIds?: string[];
}

/** Full rule as used in memory */
export interface ActionRule {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  eventType: ActionEventType;
  actions: ActionConfig[];
  conditions: ActionConditions;
  priority: number;
  createdBy: string;
}

/** Context object built from a Discord event */
export interface EventContext {
  eventType: ActionEventType;
  guildId: string;
  guildName?: string;
  userId?: string;
  userName?: string;
  userTag?: string;
  userMention?: string;
  channelId?: string;
  channelName?: string;
  channelMention?: string;
  roleId?: string;
  roleName?: string;
  roleMention?: string;
  memberCount?: number;
  timestamp: string;
  member?: GuildMember;
  /** Event-specific key-value data resolved by the template engine */
  extra?: Record<string, string>;
}

// --- Step-based execution model (v2) ---

/** Operators for step condition evaluation */
export type StepConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "hasRole"
  | "notHasRole"
  | "inList"
  | "notInList";

/** Fields that can be tested in a condition step */
export type StepConditionField =
  | "channelId"
  | "channelName"
  | "userId"
  | "userName"
  | "roleId"
  | "roleName"
  | "messageContent"
  | "memberCount";

/** Configuration for a condition evaluation */
export interface StepConditionConfig {
  field: StepConditionField;
  operator: StepConditionOperator;
  value: string;
}

/** A step that executes an action */
export interface ActionStep {
  id: string;
  type: "action";
  action: ActionConfig;
  next: string | null;
}

/** A step that branches based on a condition */
export interface ConditionStep {
  id: string;
  type: "condition";
  condition: StepConditionConfig;
  thenNext: string | null;
  elseNext: string | null;
}

/** A step that waits before continuing */
export interface DelayStep {
  id: string;
  type: "delay";
  delayMs: number;
  next: string | null;
}

/** Union of all step types */
export type RuleStep = ActionStep | ConditionStep | DelayStep;

/** V2 storage format for steps-based rules */
export interface StepsPayload {
  _v: 2;
  steps: RuleStep[];
  entryStepId: string;
}

/** Full rule as used in memory */
export interface ActionRule {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  eventType: ActionEventType;
  actions: ActionConfig[];
  /** Step-based execution graph (v2). If present, executor uses this instead of actions. */
  steps?: RuleStep[];
  /** Entry point for step-based execution */
  entryStepId?: string;
  conditions: ActionConditions;
  priority: number;
  createdBy: string;
}

/** Convert a flat actions array to steps format */
export function actionsToSteps(actions: ActionConfig[]): {
  steps: RuleStep[];
  entryStepId: string;
} {
  if (actions.length === 0) {
    return { steps: [], entryStepId: "" };
  }
  const steps: RuleStep[] = actions.map((action, i) => ({
    id: `step_${i}`,
    type: "action" as const,
    action,
    next: i < actions.length - 1 ? `step_${i + 1}` : null,
  }));
  return { steps, entryStepId: "step_0" };
}

/** Convert steps back to flat actions array (for legacy compat, only if all steps are linear actions) */
export function stepsToActions(steps: RuleStep[], entryStepId: string): ActionConfig[] | null {
  if (steps.length === 0) return [];
  const actions: ActionConfig[] = [];
  let currentId: string | null = entryStepId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) return null; // cycle
    visited.add(currentId);
    const step = steps.find((s) => s.id === currentId);
    if (!step) return null;
    if (step.type !== "action") return null; // non-linear
    actions.push(step.action);
    currentId = step.next;
  }
  return actions;
}

/** Guild-level action system settings */
export interface ActionGuildSettings {
  maxRules: number;
  globalEnabled: boolean;
  logChannelId: string | null;
}
