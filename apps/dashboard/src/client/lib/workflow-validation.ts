import type { ActionConfig, Constants } from "./schemas";

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
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!name.trim()) {
    issues.push({
      nodeId: "toolbar",
      level: "error",
      message: "Rule name is required",
    });
  }

  if (!eventType) {
    issues.push({
      nodeId: "trigger",
      level: "error",
      message: "No event type selected",
    });
  }

  if (actions.length === 0) {
    issues.push({
      nodeId: "trigger",
      level: "warning",
      message: "No actions configured",
    });
  }

  actions.forEach((action, i) => {
    const nodeId = `action-${i}`;

    if (!action.type) {
      issues.push({
        nodeId,
        level: "error",
        message: `Action ${i + 1}: no action type selected`,
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
          message: `Action ${i + 1}: ${field.label} is required`,
        });
      }
    }
  });

  return {
    valid: issues.filter((i) => i.level === "error").length === 0,
    issues,
  };
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
