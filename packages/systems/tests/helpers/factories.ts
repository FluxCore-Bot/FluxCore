/**
 * Test data factories for integration tests.
 *
 * Every factory produces valid data with sensible defaults.
 * Override only the fields you care about in each test.
 */

import { getPrisma } from "@fluxcore/database";
import type { ActionConfig, ActionConditions, ActionEventType } from "../../src/actions/types.js";

// ─── Action Rules ──────────────────────────────────────────

export interface CreateActionRuleInput {
  guildId?: string;
  name?: string;
  enabled?: boolean;
  eventType?: ActionEventType;
  actions?: ActionConfig[];
  conditions?: ActionConditions;
  priority?: number;
  createdBy?: string;
}

let ruleCounter = 0;

export async function createActionRule(overrides: CreateActionRuleInput = {}) {
  ruleCounter++;
  const prisma = getPrisma();
  return prisma.actionRule.create({
    data: {
      guildId: overrides.guildId ?? "test-guild-1",
      name: overrides.name ?? `test-rule-${ruleCounter}`,
      enabled: overrides.enabled ?? true,
      eventType: overrides.eventType ?? "memberJoin",
      actions: JSON.stringify(
        overrides.actions ?? [
          { type: "sendMessage", channelId: "ch-1", message: "Welcome!" },
        ],
      ),
      conditions: JSON.stringify(overrides.conditions ?? {}),
      priority: overrides.priority ?? 0,
      createdBy: overrides.createdBy ?? "user-1",
    },
  });
}

// ─── Action Guild Settings ─────────────────────────────────

export interface CreateActionGuildSettingsInput {
  guildId?: string;
  maxRules?: number;
  globalEnabled?: boolean;
  logChannelId?: string | null;
}

export async function createActionGuildSettings(
  overrides: CreateActionGuildSettingsInput = {},
) {
  const prisma = getPrisma();
  return prisma.actionGuildSettings.create({
    data: {
      guildId: overrides.guildId ?? "test-guild-1",
      maxRules: overrides.maxRules ?? 25,
      globalEnabled: overrides.globalEnabled ?? true,
      logChannelId: overrides.logChannelId ?? null,
    },
  });
}

// ─── Cache Invalidation ────────────────────────────────────

export async function createCacheInvalidation(
  guildId: string = "test-guild-1",
  action: "reload" | "reloadSettings" | "reloadTempVoice" | "reloadMusic" = "reload",
) {
  const prisma = getPrisma();
  return prisma.actionCacheInvalidation.create({
    data: { guildId, action },
  });
}

// ─── Music Guild Settings ──────────────────────────────────

export interface CreateMusicSettingsInput {
  guildId?: string;
  mode?: string;
  djRoleId?: string | null;
  defaultVolume?: number;
  maxQueueSize?: number;
  autoDisconnectSecs?: number;
  twentyFourSeven?: boolean;
  lastChannelId?: string | null;
}

export async function createMusicSettings(
  overrides: CreateMusicSettingsInput = {},
) {
  const prisma = getPrisma();
  return prisma.musicGuildSettings.create({
    data: {
      guildId: overrides.guildId ?? "test-guild-1",
      mode: overrides.mode ?? "open",
      djRoleId: overrides.djRoleId ?? null,
      defaultVolume: overrides.defaultVolume ?? 50,
      maxQueueSize: overrides.maxQueueSize ?? 100,
      autoDisconnectSecs: overrides.autoDisconnectSecs ?? 300,
      twentyFourSeven: overrides.twentyFourSeven ?? false,
      lastChannelId: overrides.lastChannelId ?? null,
    },
  });
}

// ─── Scheduled Messages ──────────────────────────────────────

export interface CreateScheduledMessageInput {
  guildId?: string;
  channelId?: string;
  name?: string;
  message?: string;
  cronExpr?: string;
  timezone?: string;
  enabled?: boolean;
  nextRunAt?: Date | null;
  createdBy?: string;
}

let scheduledMsgCounter = 0;

export async function createScheduledMessageFactory(
  overrides: CreateScheduledMessageInput = {},
) {
  scheduledMsgCounter++;
  const prisma = getPrisma();
  return prisma.scheduledMessage.create({
    data: {
      guildId: overrides.guildId ?? "test-guild-1",
      channelId: overrides.channelId ?? "ch-1",
      name: overrides.name ?? `scheduled-msg-${scheduledMsgCounter}`,
      message: overrides.message ?? JSON.stringify({ type: "text", content: "Hello!" }),
      cronExpr: overrides.cronExpr ?? "0 9 * * *",
      timezone: overrides.timezone ?? "UTC",
      enabled: overrides.enabled ?? true,
      nextRunAt: overrides.nextRunAt ?? new Date(Date.now() + 3_600_000),
      createdBy: overrides.createdBy ?? "user-1",
    },
  });
}

// ─── Mock Discord Objects (for unit tests) ─────────────────

/** Minimal mock for a Discord ChatInputCommandInteraction */
export function createMockInteraction(overrides: Record<string, unknown> = {}) {
  const defaults = {
    options: {
      getMember: vi.fn().mockReturnValue(null),
      getString: vi.fn().mockReturnValue(null),
      getInteger: vi.fn().mockReturnValue(null),
      getBoolean: vi.fn().mockReturnValue(null),
      getChannel: vi.fn().mockReturnValue(null),
      getRole: vi.fn().mockReturnValue(null),
      getSubcommand: vi.fn().mockReturnValue(null),
    },
    user: { id: "user-1", username: "testuser", displayName: "Test User" },
    member: { roles: { highest: { position: 10 } } },
    client: { user: { id: "bot-1" } },
    guild: { id: "test-guild-1", name: "Test Guild", memberCount: 100 },
    guildId: "test-guild-1",
    channelId: "ch-1",
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    followUp: vi.fn(),
  };
  return { ...defaults, ...overrides };
}

/** Minimal mock for a Discord GuildMember */
export function createMockMember(overrides: Record<string, unknown> = {}) {
  const defaults = {
    id: "user-1",
    displayName: "TestUser",
    user: {
      id: "user-1",
      username: "testuser",
      tag: "testuser#0000",
      bot: false,
      send: vi.fn(),
    },
    roles: {
      highest: { position: 5 },
      cache: new Map(),
      add: vi.fn(),
      remove: vi.fn(),
    },
    bannable: true,
    kickable: true,
    moderatable: true,
    ban: vi.fn(),
    kick: vi.fn(),
    timeout: vi.fn(),
    setNickname: vi.fn(),
  };
  return { ...defaults, ...overrides };
}

/** Minimal mock for a Fastify request session (dashboard) */
export function createMockSession(overrides: Record<string, unknown> = {}) {
  const MANAGE_GUILD = BigInt(0x20);
  return {
    userId: "user-1",
    username: "testuser",
    guilds: [
      {
        id: "test-guild-1",
        name: "Test Guild",
        permissions: MANAGE_GUILD.toString(),
      },
    ],
    ...overrides,
  };
}
