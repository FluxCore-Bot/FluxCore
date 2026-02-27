import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { ACTION_LOG_RETENTION_DAYS } from "./constants.js";
import type {
  ActionConditions,
  ActionConfig,
  ActionEventType,
  ActionRule,
} from "./types.js";

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToRule(row: {
  id: number;
  guildId: string;
  name: string;
  enabled: boolean;
  eventType: string;
  actions: string;
  conditions: string;
  priority: number;
  createdBy: string;
}): ActionRule {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    enabled: row.enabled,
    eventType: row.eventType as ActionEventType,
    actions: safeJsonParse<ActionConfig[]>(row.actions, []),
    conditions: safeJsonParse<ActionConditions>(row.conditions, {}),
    priority: row.priority,
    createdBy: row.createdBy,
  };
}

export async function createRule(
  data: Omit<ActionRule, "id">,
): Promise<ActionRule> {
  const prisma = getPrisma();
  const row = await prisma.actionRule.create({
    data: {
      guildId: data.guildId,
      name: data.name,
      enabled: data.enabled,
      eventType: data.eventType,
      actions: JSON.stringify(data.actions),
      conditions: JSON.stringify(data.conditions),
      priority: data.priority,
      createdBy: data.createdBy,
    },
  });
  return rowToRule(row);
}

export async function updateRule(
  id: number,
  guildId: string,
  data: Partial<
    Pick<
      ActionRule,
      "name" | "enabled" | "eventType" | "actions" | "conditions" | "priority"
    >
  >,
): Promise<ActionRule> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.eventType !== undefined) updateData.eventType = data.eventType;
  if (data.actions !== undefined)
    updateData.actions = JSON.stringify(data.actions);
  if (data.conditions !== undefined)
    updateData.conditions = JSON.stringify(data.conditions);
  if (data.priority !== undefined) updateData.priority = data.priority;

  const row = await prisma.actionRule.update({
    where: { id, guildId },
    data: updateData,
  });
  return rowToRule(row);
}

export async function deleteRule(
  id: number,
  guildId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  try {
    await prisma.actionRule.delete({ where: { id, guildId } });
    return true;
  } catch {
    return false;
  }
}

export async function getRulesByGuild(guildId: string): Promise<ActionRule[]> {
  const prisma = getPrisma();
  const rows = await prisma.actionRule.findMany({
    where: { guildId },
    orderBy: { priority: "desc" },
  });
  return rows.map(rowToRule);
}

export async function getRuleByName(
  guildId: string,
  name: string,
): Promise<ActionRule | null> {
  const prisma = getPrisma();
  const row = await prisma.actionRule.findUnique({
    where: { guildId_name: { guildId, name } },
  });
  return row ? rowToRule(row) : null;
}

export async function countRules(guildId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.actionRule.count({ where: { guildId } });
}

export async function logExecution(
  rule: ActionRule,
  actionType: string,
  success: boolean,
  error: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.actionLog.create({
      data: {
        guildId: rule.guildId,
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: rule.eventType,
        actionType,
        success,
        error,
        metadata: JSON.stringify(metadata),
      },
    });
  } catch (err) {
    logger.error(
      "Failed to write action log",
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

export async function getRecentLogs(
  guildId: string,
  options: { ruleName?: string; limit?: number } = {},
) {
  const prisma = getPrisma();
  const { ruleName, limit = 10 } = options;
  return prisma.actionLog.findMany({
    where: {
      guildId,
      ...(ruleName ? { ruleName } : {}),
    },
    orderBy: { executedAt: "desc" },
    take: limit,
  });
}

export async function notifyCacheInvalidation(
  guildId: string,
  action: "reload" | "reloadSettings" | "reloadTempVoice" = "reload",
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.actionCacheInvalidation.create({
      data: { guildId, action },
    });
  } catch (err) {
    logger.error(
      "Failed to write cache invalidation",
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // Attempt instant HTTP notification (fire-and-forget)
  try {
    const { config } = await import("@fluxcore/config");
    if (config.botSyncUrl) {
      fetch(`${config.botSyncUrl}/cache/invalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Secret": config.botSyncSecret,
        },
        body: JSON.stringify({ guildId, action }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {
        // Silently ignore — DB polling is the fallback
      });
    }
  } catch {
    // Config may not have botSyncUrl set
  }
}

export async function cleanOldLogs(
  retentionDays: number = ACTION_LOG_RETENTION_DAYS,
): Promise<number> {
  const prisma = getPrisma();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = await prisma.actionLog.deleteMany({
    where: { executedAt: { lt: cutoff } },
  });
  return result.count;
}
