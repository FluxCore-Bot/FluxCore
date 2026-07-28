import { describe, it, expect } from "vitest";
import { validateWorkflow } from "../../../../src/client/features/automation/lib/workflow-validation";
import type { Constants, RuleStep } from "../../../../src/client/shared/lib/schemas";

// validateWorkflow takes the structural TranslateFn, so a plain passthrough
// needs no cast.
const t = (key: string) => key;

/**
 * Minimal constants carrying only what validateAction reads —
 * `actionTypeFields`. Mirrors ACTION_TYPE_FIELDS in
 * packages/systems/src/actions/constants.ts for the action types under test.
 */
const constants: Constants = {
  eventTypes: { memberJoin: { label: "Member Join", description: "" } },
  actionTypes: {
    sendMessage: { label: "Send Message", description: "" },
    addRole: { label: "Add Role", description: "" },
    sendWebhook: { label: "Send Webhook", description: "" },
  },
  maxActionsPerRule: 5,
  actionTypeFields: {
    sendMessage: [
      { key: "channelId", label: "Channel", type: "channel", required: true },
      { key: "message", label: "Message", type: "textarea", required: true },
    ],
    addRole: [{ key: "roleId", label: "Role", type: "role", required: true }],
    sendWebhook: [
      { key: "webhook.url", label: "Webhook URL", type: "text", required: true },
      { key: "webhook.method", label: "HTTP Method", type: "select" },
    ],
  },
  eventTypeVariables: { memberJoin: ["{user}"] },
  templateVariables: { "{user}": "User mention" },
};

const graph: RuleStep[] = [
  { id: "step_0", type: "action", action: { type: "sendMessage", message: "hi" }, next: "step_1" },
  { id: "step_1", type: "condition", condition: { field: "channelId", operator: "equals", value: "9" }, thenNext: "step_2", elseNext: null },
  { id: "step_2", type: "delay", delayMs: 5000, next: null },
];

describe("validateWorkflow — entry-less step graph", () => {
  it("blocks save with a noEntryStep error anchored to the trigger, and does not flood unreachable-step warnings", () => {
    const result = validateWorkflow("messageCreate", [], "Test Rule", undefined, t, graph, undefined);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      nodeId: "trigger",
      level: "error",
      message: "validation.noEntryStep",
    });

    // The reachability BFS is guarded on entryStepId. Without that guard,
    // every step in an entry-less graph gets flagged "unreachable" (the BFS
    // queue would start on a literal `undefined` id and never reach any real
    // step), burying the one error that actually matters under a wall of
    // warning noise.
    expect(result.issues.some((i) => i.message === "validation.stepUnreachable")).toBe(false);
  });

  it("does not report noEntryStep once the graph has an entry point", () => {
    const result = validateWorkflow("messageCreate", [], "Test Rule", undefined, t, graph, "step_0");

    expect(result.issues.some((i) => i.message === "validation.noEntryStep")).toBe(false);
  });
});

describe("validateWorkflow — required action fields block save", () => {
  it.each([
    ["sendMessage with no channel and no message", { type: "sendMessage" }],
    ["sendMessage with a channel but no message", { type: "sendMessage", channelId: "1" }],
    ["addRole with no role", { type: "addRole" }],
    ["sendWebhook with no url", { type: "sendWebhook", webhook: { url: "" } }],
  ])("rejects %s", (_label, action) => {
    const result = validateWorkflow("memberJoin", [action], "Test Rule", constants, t, undefined, undefined);

    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) => i.level === "error" && i.message === "validation.fieldRequired",
      ),
    ).toBe(true);
  });

  it("anchors the error to the action's node so the canvas can highlight it", () => {
    const result = validateWorkflow("memberJoin", [{ type: "addRole" }], "Test Rule", constants, t);

    expect(result.issues).toContainEqual({
      nodeId: "action-0",
      level: "error",
      message: "validation.fieldRequired",
    });
  });

  it("accepts an action once every required field is filled", () => {
    const result = validateWorkflow(
      "memberJoin",
      [{ type: "sendMessage", channelId: "123", message: "hi" }],
      "Test Rule",
      constants,
      t,
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("ignores optional fields left empty", () => {
    const result = validateWorkflow(
      "memberJoin",
      [{ type: "sendWebhook", webhook: { url: "https://example.com" } }],
      "Test Rule",
      constants,
      t,
    );

    expect(result.valid).toBe(true);
  });

  it("blocks save for an action step inside a graph, not just a linear action", () => {
    const steps: RuleStep[] = [
      { id: "step_0", type: "action", action: { type: "addRole" }, next: null },
    ];
    const result = validateWorkflow("memberJoin", [], "Test Rule", constants, t, steps, "step_0");

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      nodeId: "step-step_0",
      level: "error",
      message: "validation.fieldRequired",
    });
  });

  it("keeps advisory graph issues as warnings so the error/warning split stays meaningful", () => {
    const steps: RuleStep[] = [
      { id: "step_0", type: "action", action: { type: "addRole", roleId: "1" }, next: "step_1" },
      {
        id: "step_1",
        type: "condition",
        condition: { field: "channelId", operator: "equals", value: "" },
        thenNext: null,
        elseNext: null,
      },
    ];
    const result = validateWorkflow("memberJoin", [], "Test Rule", constants, t, steps, "step_0");

    expect(result.valid).toBe(true);
    expect(result.issues.every((i) => i.level === "warning")).toBe(true);
  });
});
