import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import type { CreateLogEntryInput, LogCategory, LogEntry } from "./types.js";
import { LOG_RETENTION_DAYS } from "./constants.js";

/** Create a log entry in the database. */
export async function createLogEntry(input: CreateLogEntryInput): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.logEntry.create({
      data: {
        guildId: input.guildId,
        category: input.category,
        eventType: input.eventType,
        targetId: input.targetId ?? null,
        executorId: input.executorId ?? null,
        content: JSON.stringify(input.content ?? {}),
      },
    });
  } catch (error) {
    logger.error(
      `Failed to create log entry for ${input.eventType}`,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export interface LogEntryFilters {
  category?: LogCategory;
  eventType?: string;
  targetId?: string;
  page?: number;
  limit?: number;
}

/** Get log entries for a guild with optional filters and pagination. */
export async function getLogEntries(
  guildId: string,
  filters: LogEntryFilters = {},
): Promise<{ entries: LogEntry[]; total: number }> {
  const prisma = getPrisma();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { guildId };
  if (filters.category) where.category = filters.category;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.targetId) where.targetId = filters.targetId;

  const [rows, total] = await Promise.all([
    prisma.logEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.logEntry.count({ where }),
  ]);

  const entries: LogEntry[] = rows.map((row) => ({
    id: row.id,
    guildId: row.guildId,
    category: row.category as LogEntry["category"],
    eventType: row.eventType as LogEntry["eventType"],
    targetId: row.targetId,
    executorId: row.executorId,
    content: parseJsonContent(row.content),
    createdAt: row.createdAt,
  }));

  return { entries, total };
}

function parseJsonContent(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // invalid JSON
  }
  return {};
}

/** Delete log entries older than the retention period. */
export async function cleanOldLogEntries(): Promise<number> {
  try {
    const prisma = getPrisma();
    const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await prisma.logEntry.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} log entries older than ${LOG_RETENTION_DAYS} days`);
    }
    return result.count;
  } catch (error) {
    logger.error(
      "Failed to clean old log entries",
      error instanceof Error ? error : new Error(String(error)),
    );
    return 0;
  }
}
