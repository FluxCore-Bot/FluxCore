import { getPrisma } from "@fluxcore/database";
import type { ScheduledMessageRow, ScheduledMessageContent } from "./types.js";
import { getNextCronRun } from "./cron.js";
import { MAX_SCHEDULED_MESSAGES_PER_GUILD } from "./constants.js";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToMessage(row: {
  id: number;
  guildId: string;
  channelId: string;
  name: string;
  message: string;
  cronExpr: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy: string;
  createdAt: Date;
}): ScheduledMessageRow {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    name: row.name,
    message: parseJson<ScheduledMessageContent>(row.message, { type: "text", content: "" }),
    cronExpr: row.cronExpr,
    timezone: row.timezone,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function getScheduledMessages(
  guildId: string,
  page: number = 1,
  limit: number = 25,
): Promise<{ messages: ScheduledMessageRow[]; total: number }> {
  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.scheduledMessage.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.scheduledMessage.count({ where: { guildId } }),
  ]);

  return {
    messages: rows.map(rowToMessage),
    total,
  };
}

export async function getScheduledMessageById(
  id: number,
  guildId: string,
): Promise<ScheduledMessageRow | null> {
  const prisma = getPrisma();
  const row = await prisma.scheduledMessage.findFirst({
    where: { id, guildId },
  });
  if (!row) return null;
  return rowToMessage(row);
}

export async function createScheduledMessage(
  guildId: string,
  data: {
    channelId: string;
    name: string;
    message: ScheduledMessageContent;
    cronExpr: string;
    timezone?: string;
    enabled?: boolean;
    createdBy: string;
  },
): Promise<ScheduledMessageRow> {
  const prisma = getPrisma();

  // Check guild limit
  const count = await prisma.scheduledMessage.count({ where: { guildId } });
  if (count >= MAX_SCHEDULED_MESSAGES_PER_GUILD) {
    throw new Error(`Maximum of ${MAX_SCHEDULED_MESSAGES_PER_GUILD} scheduled messages per guild`);
  }

  const timezone = data.timezone ?? "UTC";
  const enabled = data.enabled ?? true;
  const nextRunAt = enabled ? getNextCronRun(data.cronExpr, timezone) : null;

  const row = await prisma.scheduledMessage.create({
    data: {
      guildId,
      channelId: data.channelId,
      name: data.name,
      message: JSON.stringify(data.message),
      cronExpr: data.cronExpr,
      timezone,
      enabled,
      nextRunAt,
      createdBy: data.createdBy,
    },
  });

  return rowToMessage(row);
}

export async function updateScheduledMessage(
  id: number,
  guildId: string,
  data: {
    channelId?: string;
    name?: string;
    message?: ScheduledMessageContent;
    cronExpr?: string;
    timezone?: string;
    enabled?: boolean;
  },
): Promise<ScheduledMessageRow | null> {
  const prisma = getPrisma();

  const existing = await prisma.scheduledMessage.findFirst({
    where: { id, guildId },
  });
  if (!existing) return null;

  const dbData: Record<string, unknown> = {};
  if (data.channelId !== undefined) dbData.channelId = data.channelId;
  if (data.name !== undefined) dbData.name = data.name;
  if (data.message !== undefined) dbData.message = JSON.stringify(data.message);
  if (data.cronExpr !== undefined) dbData.cronExpr = data.cronExpr;
  if (data.timezone !== undefined) dbData.timezone = data.timezone;
  if (data.enabled !== undefined) dbData.enabled = data.enabled;

  // Recalculate nextRunAt if cron, timezone, or enabled changed
  const cronExpr = data.cronExpr ?? existing.cronExpr;
  const timezone = data.timezone ?? existing.timezone;
  const enabled = data.enabled ?? existing.enabled;

  if (enabled) {
    dbData.nextRunAt = getNextCronRun(cronExpr, timezone);
  } else {
    dbData.nextRunAt = null;
  }

  const row = await prisma.scheduledMessage.update({
    where: { id },
    data: dbData,
  });

  return rowToMessage(row);
}

export async function deleteScheduledMessage(
  id: number,
  guildId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.scheduledMessage.deleteMany({
    where: { id, guildId },
  });
  return result.count > 0;
}

export async function getDueMessages(): Promise<ScheduledMessageRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.scheduledMessage.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: new Date() },
    },
  });
  return rows.map(rowToMessage);
}

export async function markMessageExecuted(
  id: number,
  cronExpr: string,
  timezone: string,
): Promise<void> {
  const prisma = getPrisma();
  const nextRunAt = getNextCronRun(cronExpr, timezone);
  await prisma.scheduledMessage.update({
    where: { id },
    data: {
      lastRunAt: new Date(),
      nextRunAt,
    },
  });
}
