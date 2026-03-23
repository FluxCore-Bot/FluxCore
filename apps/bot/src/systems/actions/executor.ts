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

function matchesConditions(
  conditions: ActionConditions,
  context: EventContext,
): boolean {
  // Include filters: if specified, context must match
  if (conditions.channelIds?.length && context.channelId) {
    if (!conditions.channelIds.includes(context.channelId)) return false;
  }
  if (conditions.userIds?.length && context.userId) {
    if (!conditions.userIds.includes(context.userId)) return false;
  }
  if (conditions.roleIds?.length && context.member) {
    const hasMatchingRole = conditions.roleIds.some((id) =>
      context.member!.roles.cache.has(id),
    );
    if (!hasMatchingRole) return false;
  }

  // Exclude filters: if matched, skip
  if (conditions.excludeChannelIds?.length && context.channelId) {
    if (conditions.excludeChannelIds.includes(context.channelId)) return false;
  }
  if (conditions.excludeUserIds?.length && context.userId) {
    if (conditions.excludeUserIds.includes(context.userId)) return false;
  }
  if (conditions.excludeRoleIds?.length && context.member) {
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
      return context.extra?.messageContent;
    default:
      return context.extra?.[field];
  }
}

function evaluateCondition(
  condition: StepConditionConfig,
  context: EventContext,
): boolean {
  const actual = getContextValue(condition.field, context);
  const expected = condition.value;

  if (actual === undefined || actual === null) return false;

  const actualStr = String(actual);

  switch (condition.operator) {
    case "equals":
      return actualStr === expected;
    case "notEquals":
      return actualStr !== expected;
    case "contains":
      return actualStr.toLowerCase().includes(expected.toLowerCase());
    case "notContains":
      return !actualStr.toLowerCase().includes(expected.toLowerCase());
    case "startsWith":
      return actualStr.toLowerCase().startsWith(expected.toLowerCase());
    case "endsWith":
      return actualStr.toLowerCase().endsWith(expected.toLowerCase());
    case "greaterThan":
      return Number(actual) > Number(expected);
    case "lessThan":
      return Number(actual) < Number(expected);
    case "hasRole":
      return context.member?.roles.cache.has(expected) ?? false;
    case "notHasRole":
      return !(context.member?.roles.cache.has(expected) ?? true);
    case "inList":
      return expected
        .split(",")
        .map((s) => s.trim())
        .includes(actualStr);
    case "notInList":
      return !expected
        .split(",")
        .map((s) => s.trim())
        .includes(actualStr);
    default:
      return false;
  }
}

const MAX_STEP_ITERATIONS = 20;
const MAX_DELAY_MS = 300_000; // 5 minutes

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
        try {
          const executor = getExecutor(step.action.type as ActionType);
          if (!executor) {
            logger.warn(
              `Unknown action type: ${step.action.type} in rule "${rule.name}"`,
            );
          } else {
            await executor(client, context, step.action);
          }
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
          await new Promise((resolve) => setTimeout(resolve, ms));
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

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matchesConditions(rule.conditions, context)) continue;

    // V2: step-based execution
    if (rule.steps?.length && rule.entryStepId) {
      await executeSteps(client, context, rule);
      continue;
    }

    // V1: linear actions
    for (const actionConfig of rule.actions) {
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
