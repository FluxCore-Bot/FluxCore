import type { TFunction } from "i18next";
import type { ActionConfig, Constants, RuleStep } from "../../../shared/lib/schemas";

export interface ValidationIssue {
  nodeId: string;
  level: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateWorkflow(
  eventType: string,
  actions: ActionConfig[],
  name: string,
  constants: Constants | undefined,
  t: TFunction,
  steps?: RuleStep[],
  entryStepId?: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!name.trim()) {
    issues.push({
      nodeId: "toolbar",
      level: "error",
      message: t("validation.nameRequired"),
    });
  }

  if (!eventType) {
    issues.push({
      nodeId: "trigger",
      level: "error",
      message: t("validation.noEventType"),
    });
  }

  const isStepMode = !!(steps?.length && entryStepId);

  if (isStepMode) {
    validateSteps(steps!, entryStepId!, constants, t, issues);
  } else {
    validateLinearActions(actions, constants, t, issues);
  }

  return {
    valid: issues.filter((i) => i.level === "error").length === 0,
    issues,
  };
}

function validateLinearActions(
  actions: ActionConfig[],
  constants: Constants | undefined,
  t: TFunction,
  issues: ValidationIssue[],
) {
  const configured = actions.filter((a) => a.type);
  if (configured.length === 0) {
    issues.push({
      nodeId: "trigger",
      level: "error",
      message: t("validation.atLeastOneAction"),
    });
  }

  actions.forEach((action, i) => {
    const nodeId = `action-${i}`;
    validateAction(action, nodeId, t("validation.actionLabel", { index: i + 1 }), constants, t, issues);
  });
}

function validateSteps(
  steps: RuleStep[],
  entryStepId: string,
  constants: Constants | undefined,
  t: TFunction,
  issues: ValidationIssue[],
) {
  const configuredActionSteps = steps.filter(
    (s) => s.type === "action" && s.action.type,
  );

  if (configuredActionSteps.length === 0) {
    issues.push({
      nodeId: "trigger",
      level: "error",
      message: t("validation.atLeastOneAction"),
    });
  }

  // Validate each step
  for (const step of steps) {
    const nodeId = `step-${step.id}`;

    if (step.type === "action") {
      validateAction(step.action, nodeId, t("validation.actionStepLabel", { id: step.id }), constants, t, issues);
    } else if (step.type === "condition") {
      if (!step.condition.value) {
        issues.push({
          nodeId,
          level: "warning",
          message: t("validation.conditionValueEmpty", { id: step.id }),
        });
      }
      if (!step.thenNext && !step.elseNext) {
        issues.push({
          nodeId,
          level: "warning",
          message: t("validation.conditionNoBranches", { id: step.id }),
        });
      }
    } else if (step.type === "delay") {
      if (step.delayMs < 1000 || step.delayMs > 300000) {
        issues.push({
          nodeId,
          level: "error",
          message: t("validation.delayOutOfRange", { id: step.id }),
        });
      }
      if (!step.next) {
        issues.push({
          nodeId,
          level: "warning",
          message: t("validation.delayNotConnected", { id: step.id }),
        });
      }
    }
  }

  // Check for unreachable steps (not connected from entry)
  const reachable = new Set<string>();
  const queue = [entryStepId];
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const step = stepMap.get(id);
    if (!step) continue;
    if (step.type === "condition") {
      if (step.thenNext) queue.push(step.thenNext);
      if (step.elseNext) queue.push(step.elseNext);
    } else if ((step.type === "action" || step.type === "delay") && step.next) {
      queue.push(step.next);
    }
  }

  for (const step of steps) {
    if (!reachable.has(step.id)) {
      issues.push({
        nodeId: `step-${step.id}`,
        level: "warning",
        message: t("validation.stepUnreachable", { id: step.id }),
      });
    }
  }
}

function validateAction(
  action: ActionConfig,
  nodeId: string,
  label: string,
  constants: Constants | undefined,
  t: TFunction,
  issues: ValidationIssue[],
) {
  if (!action.type) {
    issues.push({
      nodeId,
      level: "error",
      message: t("validation.noActionType", { label }),
    });
    return;
  }

  if (!constants) return;

  const fields = constants.actionTypeFields[action.type] ?? [];
  for (const field of fields) {
    if (!field.required) continue;

    const value = getNestedValue(action, field.key);
    if (value === undefined || value === null || value === "") {
      issues.push({
        nodeId,
        level: "warning",
        message: t("validation.fieldRequired", { label, field: field.label }),
      });
    }
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function getNodeValidationState(
  nodeId: string,
  issues: ValidationIssue[],
): "valid" | "warning" | "error" | null {
  const nodeIssues = issues.filter((i) => i.nodeId === nodeId);
  if (nodeIssues.length === 0) return null;
  if (nodeIssues.some((i) => i.level === "error")) return "error";
  return "warning";
}
