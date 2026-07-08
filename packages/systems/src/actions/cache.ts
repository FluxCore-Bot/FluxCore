import { getPrisma } from "@fluxcore/database";
import { logger } from "@fluxcore/utils";
import { getRulesByGuild, rowToRule } from "./persistence.js";
import type { ActionRule } from "./types.js";

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
      addToInternalCache(rowToRule(row));
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
  const rules = await getRulesByGuild(guildId);

  // Build the new per-event map locally first; only after it is fully
  // populated do we atomically swap it into the global cache. This
  // guarantees that any concurrent getRulesForEvent() call observes
  // EITHER the complete previous rule set OR the complete new one — never
  // an empty intermediate state.
  const newGuildMap = new Map<string, ActionRule[]>();
  for (const rule of rules) {
    let bucket = newGuildMap.get(rule.eventType);
    if (!bucket) {
      bucket = [];
      newGuildMap.set(rule.eventType, bucket);
    }
    bucket.push(rule);
  }
  for (const bucket of newGuildMap.values()) {
    bucket.sort((a, b) => b.priority - a.priority);
  }

  if (newGuildMap.size === 0) {
    ruleCache.delete(guildId);
  } else {
    ruleCache.set(guildId, newGuildMap);
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
