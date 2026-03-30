import { z } from "zod";
import type {
  ActionConfig as SharedActionConfig,
  ActionConditions as SharedActionConditions,
  RuleStep as SharedRuleStep,
  ActionGuildSettings as SharedActionGuildSettings,
} from "@fluxcore/systems/actions/types";

// --- Auth ---
export const UserSchema = z.object({
  userId: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

// --- Guilds ---
export const GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
});
export type Guild = z.infer<typeof GuildSchema>;

export const GuildListSchema = z.array(GuildSchema);

// --- Channels ---
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.number(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelListSchema = z.array(ChannelSchema);

// --- Roles ---
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type Role = z.infer<typeof RoleSchema>;

export const RoleListSchema = z.array(RoleSchema);

// --- Action Constants ---
export const EventTypeInfoSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const ActionTypeInfoSchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const ActionFieldDescriptorSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["channel", "role", "text", "textarea", "color", "select"]),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  maxLength: z.number().optional(),
});
export type ActionFieldDescriptor = z.infer<typeof ActionFieldDescriptorSchema>;

export const ConstantsSchema = z.object({
  eventTypes: z.record(z.string(), EventTypeInfoSchema),
  actionTypes: z.record(z.string(), ActionTypeInfoSchema),
  maxActionsPerRule: z.number(),
  actionTypeFields: z.record(
    z.string(),
    z.array(ActionFieldDescriptorSchema),
  ),
  eventTypeVariables: z.record(z.string(), z.array(z.string())),
  templateVariables: z.record(z.string(), z.string()),
});
export type Constants = z.infer<typeof ConstantsSchema>;

// --- Action Config ---
export const ActionConfigSchema = z.object({
  type: z.string().min(1, "Action type is required"),
  channelId: z.string().optional(),
  roleId: z.string().optional(),
  message: z.string().optional(),
  embed: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      color: z.number().optional(),
      footer: z.string().optional(),
    })
    .optional(),
  webhook: z
    .object({
      url: z.string(),
      method: z.enum(["POST", "PUT"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      bodyTemplate: z.string().optional(),
    })
    .optional(),
  nickname: z.string().optional(),
  threadName: z.string().optional(),
  emoji: z.string().optional(),
});
export type ActionConfig = z.infer<typeof ActionConfigSchema>;

// --- Step-based execution model (v2) ---
export const StepConditionConfigSchema = z.object({
  field: z.enum([
    "channelId", "channelName", "userId", "userName",
    "roleId", "roleName", "messageContent", "memberCount",
  ]),
  operator: z.enum([
    "equals", "notEquals", "contains", "notContains",
    "startsWith", "endsWith", "greaterThan", "lessThan",
    "hasRole", "notHasRole", "inList", "notInList",
  ]),
  value: z.string(),
});
export type StepConditionConfig = z.infer<typeof StepConditionConfigSchema>;

export const ActionStepSchema = z.object({
  id: z.string(),
  type: z.literal("action"),
  action: ActionConfigSchema,
  next: z.string().nullable(),
});

export const ConditionStepSchema = z.object({
  id: z.string(),
  type: z.literal("condition"),
  condition: StepConditionConfigSchema,
  thenNext: z.string().nullable(),
  elseNext: z.string().nullable(),
});

export const DelayStepSchema = z.object({
  id: z.string(),
  type: z.literal("delay"),
  delayMs: z.number().min(1000).max(300000),
  next: z.string().nullable(),
});

export const RuleStepSchema = z.discriminatedUnion("type", [
  ActionStepSchema,
  ConditionStepSchema,
  DelayStepSchema,
]);
export type RuleStep = z.infer<typeof RuleStepSchema>;

// --- Action Conditions ---
export const ActionConditionsSchema = z.object({
  channelIds: z.array(z.string()).optional(),
  roleIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  excludeChannelIds: z.array(z.string()).optional(),
  excludeRoleIds: z.array(z.string()).optional(),
  excludeUserIds: z.array(z.string()).optional(),
});
export type ActionConditions = z.infer<typeof ActionConditionsSchema>;

// --- Action Rules ---
export const ActionRuleSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  eventType: z.string(),
  actions: z.array(ActionConfigSchema),
  steps: z.array(RuleStepSchema).optional(),
  entryStepId: z.string().optional(),
  conditions: ActionConditionsSchema,
  priority: z.number(),
  createdBy: z.string(),
  lastFired: z.string().nullable().optional(),
});
export type ActionRule = z.infer<typeof ActionRuleSchema>;

export const ActionRuleListSchema = z.array(ActionRuleSchema);

// --- Rule Form ---
export const RuleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
  eventType: z.string().min(1, "Event type is required"),
  actions: z
    .array(ActionConfigSchema)
    .min(1, "At least one action required")
    .max(5, "Max 5 actions"),
  steps: z.array(RuleStepSchema).optional(),
  entryStepId: z.string().optional(),
  conditions: ActionConditionsSchema,
  priority: z.number().min(0).max(100),
  enabled: z.boolean(),
});
export type RuleFormData = z.infer<typeof RuleFormSchema>;

// --- Action Settings ---
export const ActionSettingsSchema = z.object({
  maxRules: z.number(),
  globalEnabled: z.boolean(),
  logChannelId: z.string().nullable(),
});
export type ActionSettings = z.infer<typeof ActionSettingsSchema>;

// --- Type compatibility checks ---
// These ensure Zod schemas stay in sync with the shared TS types in packages/systems.
// If a field is added/removed in types.ts but not updated here, the build will fail.
type AssertAssignable<_Target, _Source extends _Target> = true;
type _CheckActionConfig = AssertAssignable<SharedActionConfig, ActionConfig>;
type _CheckActionConditions = AssertAssignable<SharedActionConditions, ActionConditions>;
type _CheckRuleStep = AssertAssignable<SharedRuleStep, RuleStep>;
type _CheckActionSettings = AssertAssignable<SharedActionGuildSettings, ActionSettings>;

export const ActionSettingsFormSchema = z.object({
  maxRules: z.number().min(1).max(100),
  globalEnabled: z.boolean(),
  logChannelId: z.string().nullable(),
});

// --- Action Logs ---
export const ActionLogSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  ruleId: z.number(),
  ruleName: z.string(),
  eventType: z.string(),
  actionType: z.string(),
  success: z.boolean(),
  error: z.string().nullable(),
  metadata: z.string(),
  executedAt: z.string(),
});
export type ActionLog = z.infer<typeof ActionLogSchema>;

export const ActionLogListSchema = z.array(ActionLogSchema);

// --- Analytics ---
export const AnalyticsSummarySchema = z.object({
  totalRules: z.number(),
  activeRules: z.number(),
  totalExecutions: z.number(),
  successRate: z.number(),
  recentErrors: z.number(),
});

export const ExecutionTrendItemSchema = z.object({
  date: z.string(),
  total: z.number(),
  success: z.number(),
  error: z.number(),
});

export const EventDistributionItemSchema = z.object({
  eventType: z.string(),
  count: z.number(),
});

export const AnalyticsActivityItemSchema = z.object({
  id: z.number(),
  ruleName: z.string(),
  eventType: z.string(),
  actionType: z.string(),
  success: z.boolean(),
  error: z.string().nullable(),
  executedAt: z.string(),
});

export const AnalyticsResponseSchema = z.object({
  summary: AnalyticsSummarySchema,
  executionTrend: z.array(ExecutionTrendItemSchema),
  eventDistribution: z.array(EventDistributionItemSchema),
  recentActivity: z.array(AnalyticsActivityItemSchema),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

// --- Per-Rule Analytics ---
export const RuleAnalyticsLogSchema = z.object({
  id: z.number(),
  actionType: z.string(),
  success: z.boolean(),
  error: z.string().nullable(),
  executedAt: z.string(),
});

export const RuleAnalyticsSchema = z.object({
  totalExecutions: z.number(),
  successRate: z.number(),
  recentLogs: z.array(RuleAnalyticsLogSchema),
});
export type RuleAnalytics = z.infer<typeof RuleAnalyticsSchema>;

// --- TempVoice ---
export const TempVoiceConfigSchema = z.object({
  id: z.number(),
  hubChannelId: z.string(),
  categoryId: z.string().nullable(),
  nameTemplate: z.string(),
});
export type TempVoiceConfig = z.infer<typeof TempVoiceConfigSchema>;

export const TempVoiceConfigListSchema = z.array(TempVoiceConfigSchema);

export const TempVoiceFormSchema = z.object({
  hubChannelId: z.string().min(1, "Hub channel is required"),
  categoryId: z.string().nullable(),
  nameTemplate: z.string().max(100),
});
export type TempVoiceFormData = z.infer<typeof TempVoiceFormSchema>;

// --- Music ---
export const MusicSettingsSchema = z.object({
  guildId: z.string(),
  mode: z.enum(["open", "library"]),
  djRoleId: z.string().nullable(),
  defaultVolume: z.number(),
  maxQueueSize: z.number(),
  autoDisconnectSecs: z.number(),
  twentyFourSeven: z.boolean(),
  lastChannelId: z.string().nullable(),
});
export type MusicSettings = z.infer<typeof MusicSettingsSchema>;

export const MusicSettingsFormSchema = z.object({
  mode: z.enum(["open", "library"]),
  djRoleId: z.string().nullable(),
  defaultVolume: z.number().min(0).max(100),
  maxQueueSize: z.number().min(1).max(500),
  autoDisconnectSecs: z.number().min(0).max(3600),
  twentyFourSeven: z.boolean(),
  lastChannelId: z.string().nullable(),
});
export type MusicSettingsFormData = z.infer<typeof MusicSettingsFormSchema>;

export const MusicAlbumSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string(),
  addedBy: z.string(),
});
export type MusicAlbum = z.infer<typeof MusicAlbumSchema>;

export const MusicAlbumListSchema = z.array(MusicAlbumSchema);

export const MusicTrackSchema = z.object({
  id: z.number(),
  albumId: z.number(),
  title: z.string(),
  sourceUrl: z.string(),
  duration: z.number().nullable(),
  addedBy: z.string(),
});
export type MusicTrack = z.infer<typeof MusicTrackSchema>;

export const MusicTrackListSchema = z.array(MusicTrackSchema);

// --- Logging ---
export const LogGuildConfigSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  category: z.string(),
  channelId: z.string(),
  enabled: z.boolean(),
  ignoredChannels: z.array(z.string()),
  ignoredRoles: z.array(z.string()),
  enabledEvents: z.array(z.string()),
});
export type LogGuildConfig = z.infer<typeof LogGuildConfigSchema>;

export const LogGuildConfigDataSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  enabled: z.boolean().optional(),
  ignoredChannels: z.array(z.string()).optional(),
  ignoredRoles: z.array(z.string()).optional(),
  enabledEvents: z.array(z.string()).optional(),
});
export type LogGuildConfigData = z.infer<typeof LogGuildConfigDataSchema>;

export const LogEntrySchema = z.object({
  id: z.number(),
  guildId: z.string(),
  category: z.string(),
  eventType: z.string(),
  targetId: z.string().nullable(),
  executorId: z.string().nullable(),
  content: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type LogEntryItem = z.infer<typeof LogEntrySchema>;

export const LogEntryListResponseSchema = z.object({
  entries: z.array(LogEntrySchema),
  total: z.number(),
});
export type LogEntryListResponse = z.infer<typeof LogEntryListResponseSchema>;

export const LogConfigResponseSchema = z.object({
  configs: z.array(LogGuildConfigSchema),
  categories: z.array(z.string()),
  eventTypes: z.record(z.string(), z.array(z.string())),
});
export type LogConfigResponse = z.infer<typeof LogConfigResponseSchema>;

// --- Warnings ---
export const WarningSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  userId: z.string(),
  moderatorId: z.string(),
  reason: z.string(),
  createdAt: z.string(),
});
export type Warning = z.infer<typeof WarningSchema>;
export const WarningListSchema = z.object({
  warnings: z.array(WarningSchema),
  total: z.number(),
});

export const WarnPunishmentSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  threshold: z.number(),
  action: z.enum(["timeout", "kick", "ban"]),
  duration: z.number().nullable(),
});
export type WarnPunishment = z.infer<typeof WarnPunishmentSchema>;
export const WarnPunishmentListSchema = z.array(WarnPunishmentSchema);

export const WarnSettingsSchema = z.object({
  guildId: z.string(),
  dmOnWarn: z.boolean(),
  reasonRequired: z.boolean(),
  maxWarnings: z.number(),
});
export type WarnSettings = z.infer<typeof WarnSettingsSchema>;

// --- Moderation ---
export const ModCaseSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  targetId: z.string(),
  moderatorId: z.string(),
  action: z.string(),
  reason: z.string().nullable(),
  duration: z.number().nullable(),
  expiresAt: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type ModCase = z.infer<typeof ModCaseSchema>;
export const ModCaseListSchema = z.object({
  cases: z.array(ModCaseSchema),
  total: z.number(),
});

export const ModSettingsSchema = z.object({
  guildId: z.string(),
  dmOnPunishment: z.boolean(),
  modLogChannelId: z.string().nullable(),
});
export type ModSettings = z.infer<typeof ModSettingsSchema>;

// --- Role Panels ---
export const RolePanelEntrySchema = z.object({
  roleId: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  style: z.number().optional(),
});
export type RolePanelEntryItem = z.infer<typeof RolePanelEntrySchema>;

export const RolePanelSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  messageId: z.string().nullable(),
  name: z.string(),
  type: z.enum(["reaction", "button", "dropdown"]),
  mode: z.enum(["toggle", "unique", "verify"]),
  embed: z.string(),
  roles: z.array(RolePanelEntrySchema),
  maxRoles: z.number().nullable(),
  minRoles: z.number().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RolePanelItem = z.infer<typeof RolePanelSchema>;

export const RolePanelListSchema = z.array(RolePanelSchema);

// --- Leveling ---
export const UserLevelSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  userId: z.string(),
  xp: z.number(),
  level: z.number(),
  messageCount: z.number(),
  voiceMinutes: z.number(),
  lastMessageXp: z.string().nullable(),
  updatedAt: z.string(),
  rank: z.number().optional(),
});
export type UserLevelEntry = z.infer<typeof UserLevelSchema>;

export const LeaderboardResponseSchema = z.object({
  entries: z.array(UserLevelSchema),
  total: z.number(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const LevelRewardSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  level: z.number(),
  roleId: z.string(),
});
export type LevelReward = z.infer<typeof LevelRewardSchema>;

export const LevelRewardListSchema = z.array(LevelRewardSchema);

export const XpMultipliersSchema = z.object({
  channels: z.record(z.string(), z.number()).optional(),
  roles: z.record(z.string(), z.number()).optional(),
});

// --- Giveaways ---
export const GiveawaySchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  messageId: z.string().nullable(),
  hostId: z.string(),
  prize: z.string(),
  winners: z.number(),
  endsAt: z.string(),
  ended: z.boolean(),
  winnerIds: z.array(z.string()),
  entrantIds: z.array(z.string()),
  requiredRoleIds: z.array(z.string()),
  createdAt: z.string(),
});
export type GiveawayItem = z.infer<typeof GiveawaySchema>;

export const GiveawayListResponseSchema = z.object({
  giveaways: z.array(GiveawaySchema),
  total: z.number(),
});
export type GiveawayListResponse = z.infer<typeof GiveawayListResponseSchema>;

export const LevelSettingsSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean(),
  xpPerMessage: z.number(),
  xpCooldownSeconds: z.number(),
  voiceXpPerMinute: z.number(),
  voiceXpEnabled: z.boolean(),
  announceChannel: z.string().nullable(),
  announceMessage: z.string(),
  announceEnabled: z.boolean(),
  noXpChannels: z.array(z.string()),
  noXpRoles: z.array(z.string()),
  xpMultipliers: XpMultipliersSchema,
});

// --- Tickets ---
export const TicketFormFieldSchema = z.object({
  label: z.string(),
  placeholder: z.string().optional(),
  style: z.enum(["short", "paragraph"]),
  required: z.boolean(),
  maxLength: z.number().optional(),
});
export type TicketFormFieldItem = z.infer<typeof TicketFormFieldSchema>;

export const TicketCategorySchema = z.object({
  name: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  staffRoleIds: z.array(z.string()).optional(),
  formFields: z.array(TicketFormFieldSchema).optional(),
});
export type TicketCategoryItem = z.infer<typeof TicketCategorySchema>;

export const TicketPanelSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  messageId: z.string().nullable(),
  name: z.string(),
  embed: z.string(),
  categories: z.array(TicketCategorySchema),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type TicketPanelItem = z.infer<typeof TicketPanelSchema>;

export const TicketPanelListSchema = z.array(TicketPanelSchema);

export const TicketSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  userId: z.string(),
  categoryName: z.string().nullable(),
  panelId: z.number().nullable(),
  status: z.enum(["open", "claimed", "closed"]),
  claimedBy: z.string().nullable(),
  closeReason: z.string().nullable(),
  formResponses: z.record(z.string(), z.string()),
  transcriptUrl: z.string().nullable(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});
export type TicketItem = z.infer<typeof TicketSchema>;

export const TicketListResponseSchema = z.object({
  tickets: z.array(TicketSchema),
  total: z.number(),
});
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>;

export const TicketSettingsSchema = z.object({
  guildId: z.string(),
  staffRoleIds: z.array(z.string()),
  transcriptChannelId: z.string().nullable(),
  maxOpenPerUser: z.number(),
  autoCloseHours: z.number(),
  namingFormat: z.string(),
  ticketCounter: z.number(),
});
export type TicketSettingsItem = z.infer<typeof TicketSettingsSchema>;
export type LevelSettings = z.infer<typeof LevelSettingsSchema>;

// --- Scheduled Messages ---

export const ScheduledMessageEmbedSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  color: z.number().optional(),
  thumbnail: z.string().optional(),
  image: z.string().optional(),
  footer: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional(),
  })).optional(),
});

export const ScheduledMessageContentSchema = z.object({
  type: z.enum(["text", "embed"]),
  content: z.string().optional(),
  embed: ScheduledMessageEmbedSchema.optional(),
});
export type ScheduledMessageContent = z.infer<typeof ScheduledMessageContentSchema>;

export const ScheduledMessageSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  name: z.string(),
  message: ScheduledMessageContentSchema,
  cronExpr: z.string(),
  timezone: z.string(),
  enabled: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.coerce.string(),
});
export type ScheduledMessage = z.infer<typeof ScheduledMessageSchema>;

export const ScheduledMessageListResponseSchema = z.object({
  messages: z.array(ScheduledMessageSchema),
  total: z.number(),
});
export type ScheduledMessageListResponse = z.infer<typeof ScheduledMessageListResponseSchema>;

export const CronPreviewResponseSchema = z.object({
  nextRuns: z.array(z.string()),
});
export type CronPreviewResponse = z.infer<typeof CronPreviewResponseSchema>;
// --- Custom Commands ---
export const CustomCommandEmbedSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  color: z.number().optional(),
  footer: z.string().optional(),
  thumbnail: z.string().optional(),
  image: z.string().optional(),
});

export const CustomCommandResponseSchema = z.object({
  type: z.enum(["text", "embed"]),
  content: z.string().optional(),
  embed: CustomCommandEmbedSchema.optional(),
});
export type CustomCommandResponse = z.infer<typeof CustomCommandResponseSchema>;

export const CustomCommandActionSchema = z.object({
  type: z.enum(["addRole", "removeRole"]),
  roleId: z.string(),
});
export type CustomCommandAction = z.infer<typeof CustomCommandActionSchema>;

export const CustomCommandSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  name: z.string(),
  triggerType: z.enum(["command", "keyword", "startsWith", "regex"]),
  response: CustomCommandResponseSchema,
  actions: z.array(CustomCommandActionSchema),
  enabled: z.boolean(),
  cooldown: z.number(),
  allowedRoles: z.array(z.string()),
  allowedChannels: z.array(z.string()),
  deletesTrigger: z.boolean(),
  dmResponse: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type CustomCommandItem = z.infer<typeof CustomCommandSchema>;

export const CustomCommandListSchema = z.array(CustomCommandSchema);
// --- Suggestions ---
export const SuggestionSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  userId: z.string(),
  messageId: z.string().nullable(),
  content: z.string(),
  status: z.enum(["pending", "approved", "denied", "implemented"]),
  statusReason: z.string().nullable(),
  statusBy: z.string().nullable(),
  upvotes: z.number(),
  downvotes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SuggestionItem = z.infer<typeof SuggestionSchema>;

export const SuggestionListResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
  total: z.number(),
});
export type SuggestionListResponse = z.infer<typeof SuggestionListResponseSchema>;

export const SuggestionSettingsSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean(),
  channelId: z.string().nullable(),
  reviewChannelId: z.string().nullable(),
  dmOnStatusChange: z.boolean(),
  autoThread: z.boolean(),
  anonymousMode: z.boolean(),
});
export type SuggestionSettings = z.infer<typeof SuggestionSettingsSchema>;

// --- Dashboard Permissions ---
export const DashboardRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  position: z.number(),
  isDefault: z.boolean(),
  permissions: z.array(z.string()),
  memberCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DashboardRole = z.infer<typeof DashboardRoleSchema>;

export const DashboardRoleListSchema = z.array(DashboardRoleSchema);

export const DashboardRoleMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  assignedBy: z.string(),
  createdAt: z.string(),
});
export type DashboardRoleMember = z.infer<typeof DashboardRoleMemberSchema>;

export const MyPermissionsSchema = z.object({
  permissions: z.array(z.string()),
  effectivePermissions: z.array(z.string()),
  roles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
  })),
  isOwner: z.boolean(),
});
export type MyPermissions = z.infer<typeof MyPermissionsSchema>;

export const DashboardGuildSettingsSchema = z.object({
  guildId: z.string(),
  auditRetentionDays: z.number(),
  requirePermissions: z.boolean(),
});
export type DashboardGuildSettings = z.infer<typeof DashboardGuildSettingsSchema>;

export const DashboardAuditEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type DashboardAuditEntry = z.infer<typeof DashboardAuditEntrySchema>;

export const DashboardAuditResponseSchema = z.object({
  entries: z.array(DashboardAuditEntrySchema),
  total: z.number(),
  page: z.number(),
  pages: z.number(),
});
export type DashboardAuditResponse = z.infer<typeof DashboardAuditResponseSchema>;
