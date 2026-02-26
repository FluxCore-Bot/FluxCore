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
  color: z.number(),
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
  conditions: ActionConditionsSchema,
  priority: z.number(),
  createdBy: z.string(),
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

// --- TempVoice ---
export const TempVoiceConfigSchema = z
  .object({
    hubChannelId: z.string(),
    categoryId: z.string().nullable(),
    nameTemplate: z.string(),
  })
  .nullable();
export type TempVoiceConfig = z.infer<typeof TempVoiceConfigSchema>;

export const TempVoiceFormSchema = z.object({
  hubChannelId: z.string().min(1, "Hub channel is required"),
  categoryId: z.string().nullable(),
  nameTemplate: z.string().max(100),
});
export type TempVoiceFormData = z.infer<typeof TempVoiceFormSchema>;
