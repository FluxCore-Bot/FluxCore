import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { getRulesByGuild } from "./persistence.js";
import type { ActionRule } from "./types.js";

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// guildId -> eventType -> ActionRule[] (sorted by priority desc)
const ruleCache = new Map<string, Map<string, ActionRule[]>>();

function addToInternalCache(rule: ActionRule): void {
  let guildMap = ruleCache.get(rule.guildId);
  if (!guildMap) {
    guildMap = new Map();
    ruleCache.set(rule.guildId, guildMap);
  }
  let rules = guildMap.get(rule.eventType);
  if (!rules) {
    rules = [];
    guildMap.set(rule.eventType, rules);
  }
  rules.push(rule);
  rules.sort((a, b) => b.priority - a.priority);
}

export async function loadAllRules(): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.actionRule.findMany({
      orderBy: { priority: "desc" },
    });

    ruleCache.clear();
    for (const row of rows) {
      const rule: ActionRule = {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        enabled: row.enabled,
        eventType: row.eventType as ActionRule["eventType"],
        actions: safeJsonParse(row.actions, []),
        conditions: safeJsonParse(row.conditions, {}),
        priority: row.priority,
        createdBy: row.createdBy,
      };
      addToInternalCache(rule);
    }
    logger.info(`Loaded ${rows.length} action rule(s) into cache`);
  } catch (error) {
    logger.error(
      "Failed to load action rules into cache",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export function getRulesForEvent(
  guildId: string,
  eventType: string,
): ActionRule[] {
  return ruleCache.get(guildId)?.get(eventType) ?? [];
}

export function getRulesForGuild(guildId: string): ActionRule[] {
  const guildMap = ruleCache.get(guildId);
  if (!guildMap) return [];
  const allRules: ActionRule[] = [];
  for (const rules of guildMap.values()) {
    allRules.push(...rules);
  }
  return allRules;
}

export function invalidateGuild(guildId: string): void {
  ruleCache.delete(guildId);
}

export async function reloadGuild(guildId: string): Promise<void> {
  // Load new rules first, then swap to minimize the window where cache is empty
  const rules = await getRulesByGuild(guildId);
  invalidateGuild(guildId);
  for (const rule of rules) {
    addToInternalCache(rule);
  }
}

export function addRuleToCache(rule: ActionRule): void {
  addToInternalCache(rule);
}

export function removeRuleFromCache(
  guildId: string,
  ruleId: number,
): void {
  const guildMap = ruleCache.get(guildId);
  if (!guildMap) return;
  for (const [eventType, rules] of guildMap) {
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      rules.splice(idx, 1);
      if (rules.length === 0) {
        guildMap.delete(eventType);
      }
      break;
    }
  }
  if (guildMap.size === 0) {
    ruleCache.delete(guildId);
  }
}

export function updateRuleInCache(updatedRule: ActionRule): void {
  removeRuleFromCache(updatedRule.guildId, updatedRule.id);
  addToInternalCache(updatedRule);
}
