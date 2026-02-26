import type { Client } from "discord.js";
import { logger } from "@fluxcore/utils";
import { getRulesForEvent } from "@fluxcore/systems/actions/cache";
import { getGuildSettingsOrDefault } from "@fluxcore/systems/actions/config";
import { logExecution } from "@fluxcore/systems/actions/persistence";
import { getExecutor } from "./registry.js";
import type { ActionConditions, ActionType, EventContext } from "@fluxcore/systems/actions/types";

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
