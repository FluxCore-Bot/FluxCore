import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "@fluxcore/types";
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
  warnEmbed,
  checkPermissions,
} from "@fluxcore/utils";
import {
  EVENT_TYPES,
  ACTION_TYPES,
  MAX_ACTIONS_PER_RULE,
  CONDITION_TYPES,
  type ConditionType,
} from "@fluxcore/systems/actions/constants";
import {
  getGuildSettingsOrDefault,
  setGuildSettings,
} from "@fluxcore/systems/actions/config";
import {
  createRule,
  updateRule,
  deleteRule,
  getRuleByName,
  countRules,
  getRecentLogs,
  notifyCacheInvalidation,
} from "@fluxcore/systems/actions/persistence";
import {
  addRuleToCache,
  removeRuleFromCache,
  updateRuleInCache,
  getRulesForGuild,
} from "@fluxcore/systems/actions/cache";
import type {
  ActionConditions,
  ActionConfig,
  ActionEventType,
  ActionType,
} from "@fluxcore/systems/actions/types";

const eventChoices = Object.entries(EVENT_TYPES).map(([value, info]) => ({
  name: info.label,
  value,
}));

const actionChoices = Object.entries(ACTION_TYPES).map(([value, info]) => ({
  name: info.label,
  value,
}));

const conditionChoices = CONDITION_TYPES.map((t) => ({ name: t, value: t }));

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("actions")
    .setDescription("Configure event-driven automated actions")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new action rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Unique name for this rule")
            .setRequired(true)
            .setMaxLength(50),
        )
        .addStringOption((opt) =>
          opt
            .setName("event")
            .setDescription("The event to listen for")
            .setRequired(true)
            .addChoices(...eventChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("action-type")
            .setDescription("The action to perform")
            .setRequired(true)
            .addChoices(...actionChoices),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target channel (for sendMessage/sendEmbed/logToChannel)")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Target role (for addRole/removeRole)"),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Message template (supports {user}, {channel}, {guild}, etc.)")
            .setMaxLength(2000),
        )
        .addStringOption((opt) =>
          opt
            .setName("webhook-url")
            .setDescription("Webhook URL for sendWebhook (HTTPS only)")
            .setMaxLength(500),
        )
        .addStringOption((opt) =>
          opt
            .setName("nickname")
            .setDescription("Nickname template for setNickname")
            .setMaxLength(32),
        )
        .addStringOption((opt) =>
          opt
            .setName("thread-name")
            .setDescription("Thread name template for createThread")
            .setMaxLength(100),
        )
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji for addReaction")
            .setMaxLength(50),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete an action rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable a disabled rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable a rule without deleting it")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all action rules"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View detailed configuration of a rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit properties of a rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("event")
            .setDescription("New event type")
            .addChoices(...eventChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("New message template")
            .setMaxLength(2000),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("New target channel")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("New target role"),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("priority")
            .setDescription("Rule priority (higher = runs first)")
            .setMinValue(0)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add-condition")
        .setDescription("Add a filter condition to a rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Condition type")
            .setRequired(true)
            .addChoices(...conditionChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("Channel/role/user ID to filter on")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-condition")
        .setDescription("Remove a filter condition from a rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Condition type")
            .setRequired(true)
            .addChoices(...conditionChoices),
        )
        .addStringOption((opt) =>
          opt
            .setName("value")
            .setDescription("Channel/role/user ID to remove")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add-action")
        .setDescription("Add another action to a rule")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("action-type")
            .setDescription("The action to add")
            .setRequired(true)
            .addChoices(...actionChoices),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target channel")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Target role"),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Message template")
            .setMaxLength(2000),
        )
        .addStringOption((opt) =>
          opt
            .setName("webhook-url")
            .setDescription("Webhook URL for sendWebhook (HTTPS only)")
            .setMaxLength(500),
        )
        .addStringOption((opt) =>
          opt
            .setName("nickname")
            .setDescription("Nickname template for setNickname")
            .setMaxLength(32),
        )
        .addStringOption((opt) =>
          opt
            .setName("thread-name")
            .setDescription("Thread name template for createThread")
            .setMaxLength(100),
        )
        .addStringOption((opt) =>
          opt
            .setName("emoji")
            .setDescription("Emoji for addReaction")
            .setMaxLength(50),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-action")
        .setDescription("Remove an action from a rule by index")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Rule name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("index")
            .setDescription("Action index (1-based, see /actions view)")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("settings")
        .setDescription("View or update guild action settings")
        .addChannelOption((opt) =>
          opt
            .setName("log-channel")
            .setDescription("Channel to log action executions")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max-rules")
            .setDescription("Maximum rules per guild")
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("Enable or disable the action system globally"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("View recent action execution logs")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Filter by rule name")
            .setAutocomplete(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Number of logs to show (default 10)")
            .setMinValue(1)
            .setMaxValue(25),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "Admin",
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    if (
      !(await checkPermissions(interaction, [
        PermissionFlagsBits.ManageGuild,
      ]))
    )
      return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (sub) {
      case "create":
        await handleCreate(interaction, guildId);
        break;
      case "delete":
        await handleDelete(interaction, guildId);
        break;
      case "enable":
        await handleToggle(interaction, guildId, true);
        break;
      case "disable":
        await handleToggle(interaction, guildId, false);
        break;
      case "list":
        await handleList(interaction, guildId);
        break;
      case "view":
        await handleView(interaction, guildId);
        break;
      case "edit":
        await handleEdit(interaction, guildId);
        break;
      case "add-condition":
        await handleAddCondition(interaction, guildId);
        break;
      case "remove-condition":
        await handleRemoveCondition(interaction, guildId);
        break;
      case "add-action":
        await handleAddAction(interaction, guildId);
        break;
      case "remove-action":
        await handleRemoveAction(interaction, guildId);
        break;
      case "settings":
        await handleSettings(interaction, guildId);
        break;
      case "logs":
        await handleLogs(interaction, guildId);
        break;
    }
  },
};

function buildActionConfig(
  actionType: ActionType,
  channelId: string | undefined,
  roleId: string | undefined,
  message: string | undefined,
  webhookUrl?: string | undefined,
  nickname?: string | undefined,
  threadName?: string | undefined,
  emoji?: string | undefined,
): ActionConfig {
  const config: ActionConfig = { type: actionType };
  if (channelId) config.channelId = channelId;
  if (roleId) config.roleId = roleId;
  if (message) config.message = message;
  if (webhookUrl) config.webhook = { url: webhookUrl };
  if (nickname) config.nickname = nickname;
  if (threadName) config.threadName = threadName;
  if (emoji) config.emoji = emoji;
  return config;
}

async function handleCreate(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const eventType = interaction.options.getString("event", true) as ActionEventType;
  const actionType = interaction.options.getString("action-type", true) as ActionType;
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const message = interaction.options.getString("message");
  const webhookUrl = interaction.options.getString("webhook-url");
  const nickname = interaction.options.getString("nickname");
  const threadName = interaction.options.getString("thread-name");
  const emoji = interaction.options.getString("emoji");

  const settings = getGuildSettingsOrDefault(guildId);
  const count = await countRules(guildId);
  if (count >= settings.maxRules) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Rule Limit Reached",
          `This server has reached the maximum of **${settings.maxRules}** rules. Delete an existing rule first.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const existing = await getRuleByName(guildId, name);
  if (existing) {
    await interaction.reply({
      embeds: [
        errorEmbed("Name Taken", `A rule named **${name}** already exists.`),
      ],
      ephemeral: true,
    });
    return;
  }

  const actionConfig = buildActionConfig(
    actionType,
    channel?.id,
    role?.id,
    message ?? undefined,
    webhookUrl ?? undefined,
    nickname ?? undefined,
    threadName ?? undefined,
    emoji ?? undefined,
  );

  const rule = await createRule({
    guildId,
    name,
    enabled: true,
    eventType,
    actions: [actionConfig],
    conditions: {},
    priority: 0,
    createdBy: interaction.user.id,
  });

  addRuleToCache(rule);
  await notifyCacheInvalidation(guildId);

  const eventInfo = EVENT_TYPES[eventType];
  const actionInfo = ACTION_TYPES[actionType];
  await interaction.reply({
    embeds: [
      successEmbed(
        "Rule Created",
        `**${name}** will execute **${actionInfo.label}** when **${eventInfo.label}** occurs.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleDelete(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  await deleteRule(rule.id, guildId);
  removeRuleFromCache(guildId, rule.id);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [successEmbed("Rule Deleted", `Rule **${name}** has been deleted.`)],
    ephemeral: true,
  });
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  enabled: boolean,
) {
  const name = interaction.options.getString("name", true);
  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  const updated = await updateRule(rule.id, guildId, { enabled });
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [
      successEmbed(
        enabled ? "Rule Enabled" : "Rule Disabled",
        `Rule **${name}** has been ${enabled ? "enabled" : "disabled"}.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const rules = getRulesForGuild(guildId);
  if (rules.length === 0) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "No Rules",
          "No action rules configured. Use `/actions create` to add one.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const lines = rules.map((r) => {
    const status = r.enabled ? "ON" : "OFF";
    const eventInfo = EVENT_TYPES[r.eventType];
    return `\`${status}\` **${r.name}** — ${eventInfo?.label ?? r.eventType} (${r.actions.length} action${r.actions.length !== 1 ? "s" : ""})`;
  });

  await interaction.reply({
    embeds: [
      infoEmbed("Action Rules", lines.join("\n")).setFooter({
        text: `${rules.length} rule(s)`,
      }),
    ],
    ephemeral: true,
  });
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  const eventInfo = EVENT_TYPES[rule.eventType];
  const embed = new EmbedBuilder()
    .setColor(rule.enabled ? 0x57f287 : 0xed4245)
    .setTitle(`Rule: ${rule.name}`)
    .addFields(
      { name: "Status", value: rule.enabled ? "Enabled" : "Disabled", inline: true },
      { name: "Event", value: eventInfo?.label ?? rule.eventType, inline: true },
      { name: "Priority", value: String(rule.priority), inline: true },
    )
    .setTimestamp();

  // Actions
  const actionLines = rule.actions.map((a, i) => {
    const info = ACTION_TYPES[a.type as ActionType];
    let detail = info?.label ?? a.type;
    if (a.channelId) detail += ` → <#${a.channelId}>`;
    if (a.roleId) detail += ` → <@&${a.roleId}>`;
    if (a.message)
      detail += ` → \`${a.message.length > 50 ? a.message.slice(0, 50) + "..." : a.message}\``;
    if (a.webhook?.url)
      detail += ` → \`${a.webhook.url.length > 50 ? a.webhook.url.slice(0, 50) + "..." : a.webhook.url}\``;
    if (a.nickname) detail += ` → nickname: \`${a.nickname}\``;
    if (a.threadName) detail += ` → thread: \`${a.threadName}\``;
    if (a.emoji) detail += ` → emoji: ${a.emoji}`;
    return `${i + 1}. ${detail}`;
  });
  embed.addFields({ name: "Actions", value: actionLines.join("\n") || "None" });

  // Conditions
  const condLines: string[] = [];
  const c = rule.conditions;
  if (c.channelIds?.length)
    condLines.push(`Channels: ${c.channelIds.map((id) => `<#${id}>`).join(", ")}`);
  if (c.roleIds?.length)
    condLines.push(`Roles: ${c.roleIds.map((id) => `<@&${id}>`).join(", ")}`);
  if (c.userIds?.length)
    condLines.push(`Users: ${c.userIds.map((id) => `<@${id}>`).join(", ")}`);
  if (c.excludeChannelIds?.length)
    condLines.push(
      `Exclude Channels: ${c.excludeChannelIds.map((id) => `<#${id}>`).join(", ")}`,
    );
  if (c.excludeRoleIds?.length)
    condLines.push(
      `Exclude Roles: ${c.excludeRoleIds.map((id) => `<@&${id}>`).join(", ")}`,
    );
  if (c.excludeUserIds?.length)
    condLines.push(
      `Exclude Users: ${c.excludeUserIds.map((id) => `<@${id}>`).join(", ")}`,
    );
  embed.addFields({
    name: "Conditions",
    value: condLines.join("\n") || "None (fires for all)",
  });

  embed.addFields({
    name: "Created By",
    value: `<@${rule.createdBy}>`,
    inline: true,
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  const newEvent = interaction.options.getString("event") as ActionEventType | null;
  const newMessage = interaction.options.getString("message");
  const newChannel = interaction.options.getChannel("channel");
  const newRole = interaction.options.getRole("role");
  const newPriority = interaction.options.getInteger("priority");

  const updates: Parameters<typeof updateRule>[2] = {};
  if (newEvent) updates.eventType = newEvent;
  if (newPriority !== null) updates.priority = newPriority;

  // Update first action's channel/role/message if provided
  if (newMessage || newChannel || newRole) {
    const actions = [...rule.actions];
    if (actions.length > 0) {
      if (newMessage) actions[0].message = newMessage;
      if (newChannel) actions[0].channelId = newChannel.id;
      if (newRole) actions[0].roleId = newRole.id;
    }
    updates.actions = actions;
  }

  if (Object.keys(updates).length === 0) {
    await interaction.reply({
      embeds: [warnEmbed("No Changes", "No options were provided to update.")],
      ephemeral: true,
    });
    return;
  }

  const updated = await updateRule(rule.id, guildId, updates);
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [successEmbed("Rule Updated", `Rule **${name}** has been updated.`)],
    ephemeral: true,
  });
}

function getConditionKey(type: ConditionType): keyof ActionConditions {
  const map: Record<ConditionType, keyof ActionConditions> = {
    channel: "channelIds",
    role: "roleIds",
    user: "userIds",
    "exclude-channel": "excludeChannelIds",
    "exclude-role": "excludeRoleIds",
    "exclude-user": "excludeUserIds",
  };
  return map[type];
}

async function handleAddCondition(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const type = interaction.options.getString("type", true) as ConditionType;
  const value = interaction.options.getString("value", true);

  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  const key = getConditionKey(type);
  const conditions = { ...rule.conditions };
  const arr = conditions[key] ?? [];
  if (arr.includes(value)) {
    await interaction.reply({
      embeds: [warnEmbed("Already Exists", `\`${value}\` is already in the **${type}** filter.`)],
      ephemeral: true,
    });
    return;
  }

  (conditions[key] as string[]) = [...arr, value];
  const updated = await updateRule(rule.id, guildId, { conditions });
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [
      successEmbed(
        "Condition Added",
        `Added \`${value}\` to the **${type}** filter on rule **${name}**.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleRemoveCondition(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const type = interaction.options.getString("type", true) as ConditionType;
  const value = interaction.options.getString("value", true);

  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  const key = getConditionKey(type);
  const conditions = { ...rule.conditions };
  const arr = conditions[key] ?? [];
  const idx = arr.indexOf(value);
  if (idx === -1) {
    await interaction.reply({
      embeds: [
        warnEmbed("Not Found", `\`${value}\` is not in the **${type}** filter.`),
      ],
      ephemeral: true,
    });
    return;
  }

  const newArr = [...arr];
  newArr.splice(idx, 1);
  (conditions[key] as string[]) = newArr.length > 0 ? newArr : (undefined as unknown as string[]);
  // Clean up empty arrays
  if (!conditions[key]?.length) delete conditions[key];

  const updated = await updateRule(rule.id, guildId, { conditions });
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [
      successEmbed(
        "Condition Removed",
        `Removed \`${value}\` from the **${type}** filter on rule **${name}**.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleAddAction(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const actionType = interaction.options.getString("action-type", true) as ActionType;
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const message = interaction.options.getString("message");
  const webhookUrl = interaction.options.getString("webhook-url");
  const nickname = interaction.options.getString("nickname");
  const threadName = interaction.options.getString("thread-name");
  const emoji = interaction.options.getString("emoji");

  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  if (rule.actions.length >= MAX_ACTIONS_PER_RULE) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Action Limit",
          `Rules can have at most **${MAX_ACTIONS_PER_RULE}** actions.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const actionConfig = buildActionConfig(
    actionType,
    channel?.id,
    role?.id,
    message ?? undefined,
    webhookUrl ?? undefined,
    nickname ?? undefined,
    threadName ?? undefined,
    emoji ?? undefined,
  );
  const actions = [...rule.actions, actionConfig];
  const updated = await updateRule(rule.id, guildId, { actions });
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  const actionInfo = ACTION_TYPES[actionType];
  await interaction.reply({
    embeds: [
      successEmbed(
        "Action Added",
        `Added **${actionInfo.label}** to rule **${name}** (${actions.length}/${MAX_ACTIONS_PER_RULE}).`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleRemoveAction(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name", true);
  const index = interaction.options.getInteger("index", true);

  const rule = await getRuleByName(guildId, name);
  if (!rule) {
    await interaction.reply({
      embeds: [errorEmbed("Not Found", `No rule named **${name}** exists.`)],
      ephemeral: true,
    });
    return;
  }

  if (index < 1 || index > rule.actions.length) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Invalid Index",
          `Index must be between 1 and ${rule.actions.length}.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (rule.actions.length <= 1) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "Cannot Remove",
          "A rule must have at least one action. Delete the rule instead.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const actions = [...rule.actions];
  actions.splice(index - 1, 1);
  const updated = await updateRule(rule.id, guildId, { actions });
  updateRuleInCache(updated);
  await notifyCacheInvalidation(guildId);

  await interaction.reply({
    embeds: [
      successEmbed(
        "Action Removed",
        `Removed action #${index} from rule **${name}**.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleSettings(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const logChannel = interaction.options.getChannel("log-channel");
  const maxRules = interaction.options.getInteger("max-rules");
  const enabled = interaction.options.getBoolean("enabled");

  const current = getGuildSettingsOrDefault(guildId);

  // If no options provided, show current settings
  if (logChannel === null && maxRules === null && enabled === null) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          "Action Settings",
          `**Enabled:** ${current.globalEnabled ? "Yes" : "No"}\n**Max Rules:** ${current.maxRules}\n**Log Channel:** ${current.logChannelId ? `<#${current.logChannelId}>` : "Not set"}`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const updated = { ...current };
  if (logChannel) updated.logChannelId = logChannel.id;
  if (maxRules !== null) updated.maxRules = maxRules;
  if (enabled !== null) updated.globalEnabled = enabled;

  await setGuildSettings(guildId, updated);
  await notifyCacheInvalidation(guildId, "reloadSettings");

  await interaction.reply({
    embeds: [
      successEmbed(
        "Settings Updated",
        `**Enabled:** ${updated.globalEnabled ? "Yes" : "No"}\n**Max Rules:** ${updated.maxRules}\n**Log Channel:** ${updated.logChannelId ? `<#${updated.logChannelId}>` : "Not set"}`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleLogs(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const name = interaction.options.getString("name") ?? undefined;
  const limit = interaction.options.getInteger("limit") ?? 10;

  const logs = await getRecentLogs(guildId, { ruleName: name, limit });
  if (logs.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed("No Logs", "No action execution logs found.")],
      ephemeral: true,
    });
    return;
  }

  const lines = logs.map((log) => {
    const status = log.success ? "+" : "-";
    const time = `<t:${Math.floor(log.executedAt.getTime() / 1000)}:R>`;
    const error = log.error ? ` — \`${log.error.slice(0, 50)}\`` : "";
    return `\`${status}\` **${log.ruleName}** → ${log.actionType} ${time}${error}`;
  });

  await interaction.reply({
    embeds: [
      infoEmbed("Action Logs", lines.join("\n")).setFooter({
        text: `Showing ${logs.length} log(s)`,
      }),
    ],
    ephemeral: true,
  });
}

// Autocomplete handler for rule names
export async function handleActionsAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const guildId = interaction.guildId;
  if (!guildId) return;

  const rules = getRulesForGuild(guildId);
  const filtered = rules
    .filter((r) => r.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((r) => ({ name: r.name, value: r.name }));

  await interaction.respond(filtered);
}

export default command;
