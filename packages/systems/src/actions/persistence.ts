import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { ACTION_LOG_RETENTION_DAYS } from "./constants.js";
import type {
  ActionConditions,
  ActionConfig,
  ActionEventType,
  ActionRule,
  RuleStep,
  StepsPayload,
} from "./types.js";

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function parseActionsColumn(raw: string): {
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
} {
  const parsed = safeJsonParse<ActionConfig[] | StepsPayload>(raw, []);
  // V2 format: object with _v: 2
  if (parsed && !Array.isArray(parsed) && (parsed as StepsPayload)._v === 2) {
    const payload = parsed as StepsPayload;
    // Also derive flat actions for backward compat (used in logs, list views, etc.)
    const flatActions: ActionConfig[] = payload.steps
      .filter((s): s is Extract<RuleStep, { type: "action" }> => s.type === "action")
      .map((s) => s.action);
    return {
      actions: flatActions,
      steps: payload.steps,
      entryStepId: payload.entryStepId,
    };
  }
  // V1 format: plain array
  return { actions: parsed as ActionConfig[] };
}

function serializeActions(rule: {
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
}): string {
  if (rule.steps && rule.entryStepId) {
    const payload: StepsPayload = {
      _v: 2,
      steps: rule.steps,
      entryStepId: rule.entryStepId,
    };
    return JSON.stringify(payload);
  }
  return JSON.stringify(rule.actions);
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
  const { actions, steps, entryStepId } = parseActionsColumn(row.actions);
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    enabled: row.enabled,
    eventType: row.eventType as ActionEventType,
    actions,
    ...(steps ? { steps, entryStepId } : {}),
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
      actions: serializeActions(data),
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
      "name" | "enabled" | "eventType" | "actions" | "steps" | "entryStepId" | "conditions" | "priority"
    >
  >,
): Promise<ActionRule> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.eventType !== undefined) updateData.eventType = data.eventType;
  if (data.steps !== undefined && data.entryStepId !== undefined) {
    updateData.actions = serializeActions({
      actions: data.actions ?? [],
      steps: data.steps,
      entryStepId: data.entryStepId,
    });
  } else if (data.actions !== undefined) {
    updateData.actions = JSON.stringify(data.actions);
  }
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
  action: "reload" | "reloadSettings" | "reloadTempVoice" | "reloadMusic" = "reload",
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

export async function getAnalytics(
  guildId: string,
  days: number = 7,
) {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalRules, activeRules, executionTrend, eventDistribution, recentActivity] =
    await Promise.all([
      prisma.actionRule.count({ where: { guildId } }),
      prisma.actionRule.count({ where: { guildId, enabled: true } }),
      prisma.$queryRaw<
        Array<{ date: string; total: bigint; success: bigint; error: bigint }>
      >`
        SELECT
          TO_CHAR("executedAt"::date, 'YYYY-MM-DD') as date,
          COUNT(*)::bigint as total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::bigint as success,
          SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::bigint as error
        FROM "ActionLog"
        WHERE "guildId" = ${guildId} AND "executedAt" >= ${since}
        GROUP BY "executedAt"::date
        ORDER BY "executedAt"::date ASC
      `,
      prisma.actionLog.groupBy({
        by: ["eventType"],
        where: { guildId, executedAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { eventType: "desc" } },
      }),
      prisma.actionLog.findMany({
        where: { guildId },
        orderBy: { executedAt: "desc" },
        take: 10,
      }),
    ]);

  const totalExecutions = executionTrend.reduce(
    (sum, row) => sum + Number(row.total),
    0,
  );
  const totalSuccess = executionTrend.reduce(
    (sum, row) => sum + Number(row.success),
    0,
  );
  const recentErrors = await prisma.actionLog.count({
    where: {
      guildId,
      success: false,
      executedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return {
    summary: {
      totalRules,
      activeRules,
      totalExecutions,
      successRate:
        totalExecutions > 0
          ? Math.round((totalSuccess / totalExecutions) * 100)
          : 100,
      recentErrors,
    },
    executionTrend: executionTrend.map((row) => ({
      date: row.date,
      total: Number(row.total),
      success: Number(row.success),
      error: Number(row.error),
    })),
    eventDistribution: eventDistribution.map((row) => ({
      eventType: row.eventType,
      count: row._count._all,
    })),
    recentActivity: recentActivity.map((row) => ({
      id: row.id,
      ruleName: row.ruleName,
      eventType: row.eventType,
      actionType: row.actionType,
      success: row.success,
      error: row.error,
      executedAt: row.executedAt.toISOString(),
    })),
  };
}

export async function getLastFiredByGuild(
  guildId: string,
): Promise<Map<number, Date>> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<
    Array<{ ruleId: number; lastFired: Date }>
  >`
    SELECT "ruleId", MAX("executedAt") as "lastFired"
    FROM "ActionLog"
    WHERE "guildId" = ${guildId}
    GROUP BY "ruleId"
  `;
  return new Map(
    rows.map((r: { ruleId: number; lastFired: Date }) => [r.ruleId, r.lastFired] as const),
  );
}

export async function bulkUpdateRules(
  guildId: string,
  ruleIds: number[],
  data: { enabled?: boolean },
): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.actionRule.updateMany({
    where: { guildId, id: { in: ruleIds } },
    data,
  });
  return result.count;
}

export async function bulkDeleteRules(
  guildId: string,
  ruleIds: number[],
): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.actionRule.deleteMany({
    where: { guildId, id: { in: ruleIds } },
  });
  return result.count;
}

export async function getRuleAnalytics(
  guildId: string,
  ruleId: number,
  days: number = 7,
) {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totalExecutions, successCount, recentLogs] = await Promise.all([
    prisma.actionLog.count({
      where: { guildId, ruleId, executedAt: { gte: since } },
    }),
    prisma.actionLog.count({
      where: { guildId, ruleId, executedAt: { gte: since }, success: true },
    }),
    prisma.actionLog.findMany({
      where: { guildId, ruleId },
      orderBy: { executedAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    totalExecutions,
    successRate:
      totalExecutions > 0
        ? Math.round((successCount / totalExecutions) * 100)
        : 100,
    recentLogs: recentLogs.map((row: {
      id: number;
      actionType: string;
      success: boolean;
      error: string | null;
      executedAt: Date;
    }) => ({
      id: row.id,
      actionType: row.actionType,
      success: row.success,
      error: row.error,
      executedAt: row.executedAt.toISOString(),
    })),
  };
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
