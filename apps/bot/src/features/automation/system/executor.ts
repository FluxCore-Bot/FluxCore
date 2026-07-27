import type { Client } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getRulesForEvent } from "@fluxcore/systems/actions/cache";
import { getGuildSettingsOrDefault } from "@fluxcore/systems/actions/config";
import { logExecution } from "@fluxcore/systems/actions/persistence";
import { getExecutor } from "./registry.js";
import type {
  ActionConditions,
  ActionRule,
  ActionType,
  EventContext,
  StepConditionConfig,
} from "@fluxcore/systems/actions/types";

// --- Per-(guild, eventType) rate limiting ---
//
// Each event type gets its own 60/min bucket so a noisy event class
// (e.g. messageCreate) cannot starve quieter ones (e.g. memberJoin).

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_EXECUTIONS = 60; // max 60 action executions per (guild, eventType) per minute

const eventBuckets = new Map<string, { count: number; resetAt: number }>();

function bucketKey(guildId: string, eventType: string): string {
  return `${guildId}\u0000${eventType}`;
}

function checkRateLimit(guildId: string, eventType: string): boolean {
  const key = bucketKey(guildId, eventType);
  const now = Date.now();
  let entry = eventBuckets.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    eventBuckets.set(key, entry);
  }

  if (entry.count >= RATE_LIMIT_MAX_EXECUTIONS) {
    return false;
  }

  entry.count++;
  return true;
}

// --- Condition matching ---

/**
 * Trigger filters FAIL CLOSED: a configured filter the event context cannot
 * answer means the rule does not fire.
 *
 * These guards used to read `conditions.excludeRoleIds?.length &&
 * context.member`, which silently *skipped* an unanswerable filter. The rule
 * then fired on exactly the users and channels it was configured to exclude —
 * "exclude @Staff" on a Member Banned rule announced every staff ban, because
 * a ban context carries no member — while the dashboard counted the filter as
 * active. An exclusion that cannot be evaluated is not a permission to
 * proceed; it is a reason to stop.
 *
 * The editor is event-aware (EVENT_CONDITION_SUPPORT) so new rules cannot be
 * built with a filter their trigger can never evaluate.
 */
function matchesConditions(
  conditions: ActionConditions,
  context: EventContext,
): boolean {
  // Channel filters test the parent too. On threadCreated the context channel
  // is the brand-new thread, whose id the user cannot possibly have picked in
  // the editor; the parent is the channel they actually chose.
  const channelIds = [context.channelId, context.parentChannelId].filter(
    (id): id is string => !!id,
  );

  // Include filters: the context must carry the datum AND match it.
  if (conditions.channelIds?.length) {
    if (channelIds.length === 0) return false;
    if (!channelIds.some((id) => conditions.channelIds!.includes(id))) return false;
  }
  if (conditions.userIds?.length) {
    if (!context.userId) return false;
    if (!conditions.userIds.includes(context.userId)) return false;
  }
  if (conditions.roleIds?.length) {
    if (!context.member) return false;
    const hasMatchingRole = conditions.roleIds.some((id) =>
      context.member!.roles.cache.has(id),
    );
    if (!hasMatchingRole) return false;
  }

  // Exclude filters: an unanswerable exclusion cannot be cleared, so it blocks.
  if (conditions.excludeChannelIds?.length) {
    if (channelIds.length === 0) return false;
    if (channelIds.some((id) => conditions.excludeChannelIds!.includes(id))) return false;
  }
  if (conditions.excludeUserIds?.length) {
    if (!context.userId) return false;
    if (conditions.excludeUserIds.includes(context.userId)) return false;
  }
  if (conditions.excludeRoleIds?.length) {
    if (!context.member) return false;
    const hasExcludedRole = conditions.excludeRoleIds.some((id) =>
      context.member!.roles.cache.has(id),
    );
    if (hasExcludedRole) return false;
  }

  return true;
}

function getContextValue(
  field: string,
  context: EventContext,
): string | number | undefined {
  switch (field) {
    case "channelId":
      return context.channelId;
    case "channelName":
      return context.channelName;
    case "userId":
      return context.userId;
    case "userName":
      return context.userName ?? context.userTag;
    case "roleId":
      return context.roleId;
    case "roleName":
      return context.roleName;
    case "memberCount":
      return context.memberCount;
    case "messageContent":
      return context.extra?.["message.content"];
    default:
      return context.extra?.[field];
  }
}

function evaluateCondition(
  condition: StepConditionConfig,
  context: EventContext,
): boolean {
  const expected = condition.value;

  // Role operators are answered entirely by the member's roles — they never
  // consume `condition.field`. Checking the field first meant the canonical
  // "if member has @Verified" branch always took the else path, because the
  // field defaults to channelId and memberJoin never populates one.
  if (condition.operator === "hasRole") {
    return context.member?.roles.cache.has(expected) ?? false;
  }
  if (condition.operator === "notHasRole") {
    if (!context.member) return false;
    return !context.member.roles.cache.has(expected);
  }

  const actual = getContextValue(condition.field, context);
  if (actual === undefined || actual === null) return false;

  const actualStr = String(actual);
  const actualLower = actualStr.toLowerCase();
  const expectedLower = expected.toLowerCase();

  switch (condition.operator) {
    case "equals":
      return actualLower === expectedLower;
    case "notEquals":
      return actualLower !== expectedLower;
    case "contains":
      return actualLower.includes(expectedLower);
    case "notContains":
      return !actualLower.includes(expectedLower);
    case "startsWith":
      return actualLower.startsWith(expectedLower);
    case "endsWith":
      return actualLower.endsWith(expectedLower);
    case "greaterThan":
      return Number(actual) > Number(expected);
    case "lessThan":
      return Number(actual) < Number(expected);
    case "inList":
      return expected
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(actualLower);
    case "notInList":
      return !expected
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(actualLower);
    default:
      return false;
  }
}

const MAX_STEP_ITERATIONS = 20;
const MAX_DELAY_MS = 300_000; // 5 minutes
const MAX_CONCURRENT_DELAYS = 50; // global cap on in-flight delay steps
let activeDelayCount = 0;

async function executeSteps(
  client: Client,
  context: EventContext,
  rule: ActionRule,
): Promise<void> {
  const steps = rule.steps!;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  let currentId: string | null = rule.entryStepId!;
  let iterations = 0;

  while (currentId && iterations < MAX_STEP_ITERATIONS) {
    iterations++;
    const step = stepMap.get(currentId);
    if (!step) {
      logger.warn(`Step "${currentId}" not found in rule "${rule.name}"`);
      break;
    }

    switch (step.type) {
      case "action": {
        if (!checkRateLimit(context.guildId, context.eventType)) {
          logger.warn(`Rate limit hit for guild ${context.guildId} during rule "${rule.name}"`);
          return;
        }
        try {
          const executor = getExecutor(step.action.type as ActionType);
          if (!executor) {
            // Must not fall through to the success log below: a rule
            // referencing a removed action type would report a clean 100%
            // success rate while doing nothing at all.
            throw new Error(`Unknown action type: ${step.action.type}`);
          }
          await executor(client, context, step.action);
          logExecution(rule, step.action.type, true, null).catch(() => {});
        } catch (error) {
          const err =
            error instanceof Error ? error : new Error(String(error));
          logger.error(
            `Action ${step.action.type} failed in rule "${rule.name}": ${err.message}`,
          );
          logExecution(rule, step.action.type, false, err.message).catch(
            () => {},
          );
        }
        currentId = step.next;
        break;
      }

      case "condition": {
        const result = evaluateCondition(step.condition, context);
        logExecution(
          rule,
          `condition:${step.condition.field}`,
          true,
          null,
          { result, field: step.condition.field, operator: step.condition.operator },
        ).catch(() => {});
        currentId = result ? step.thenNext : step.elseNext;
        break;
      }

      case "delay": {
        const ms = Math.min(Math.max(step.delayMs, 0), MAX_DELAY_MS);
        if (ms > 0) {
          if (activeDelayCount >= MAX_CONCURRENT_DELAYS) {
            logger.warn(`Skipping delay step in rule "${rule.name}": concurrent delay limit reached (${MAX_CONCURRENT_DELAYS})`);
            currentId = step.next;
            break;
          }
          activeDelayCount++;
          try {
            await new Promise((resolve) => setTimeout(resolve, ms));
          } finally {
            activeDelayCount--;
          }
        }
        currentId = step.next;
        break;
      }

      default:
        currentId = null;
    }
  }

  if (iterations >= MAX_STEP_ITERATIONS) {
    logger.warn(
      `Rule "${rule.name}" hit max step iterations (${MAX_STEP_ITERATIONS})`,
    );
  }
}

export async function processEvent(
  client: Client,
  context: EventContext,
): Promise<void> {
  const settings = getGuildSettingsOrDefault(context.guildId);
  if (!settings.globalEnabled) return;

  const rules = getRulesForEvent(context.guildId, context.eventType);
  if (rules.length === 0) return;

  // Rules execute sequentially in priority order (highest first).
  // This is intentional: parallel execution could cause race conditions
  // (e.g., addRole before removeRole) and break user-expected ordering.
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matchesConditions(rule.conditions, context)) continue;

    // V2: step-based execution
    if (rule.steps?.length && rule.entryStepId) {
      await executeSteps(client, context, rule);
      continue;
    }

    // V1: linear actions
    if (!rule.actions?.length) continue;
    for (const actionConfig of rule.actions) {
      if (!checkRateLimit(context.guildId, context.eventType)) {
        logger.warn(`Rate limit hit for guild ${context.guildId} during rule "${rule.name}"`);
        return;
      }
      try {
        const executor = getExecutor(actionConfig.type as ActionType);
        if (!executor) {
          logger.warn(
            `Unknown action type: ${actionConfig.type} in rule "${rule.name}"`,
          );
          continue;
        }
        await executor(client, context, actionConfig);
        logExecution(rule, actionConfig.type, true, null).catch((logErr) => {
          logger.warn(`Failed to log successful action execution for rule "${rule.name}": ${logErr instanceof Error ? logErr.message : String(logErr)}`);
        });
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error(String(error));
        logger.error(
          `Action ${actionConfig.type} failed in rule "${rule.name}": ${err.message}`,
        );
        logExecution(rule, actionConfig.type, false, err.message).catch(
          (logErr) => {
            logger.warn(`Failed to log action execution error for rule "${rule.name}": ${logErr instanceof Error ? logErr.message : String(logErr)}`);
          },
        );
      }
    }
  }
}
