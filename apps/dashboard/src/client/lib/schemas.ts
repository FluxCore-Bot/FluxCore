import { z } from "zod";

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
  type: z.string(),
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
