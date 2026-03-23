import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "@tanstack/react-router";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useConstants } from "../../lib/hooks/useConstants";
import { useChannels } from "../../lib/hooks/useChannels";
import { useRoles } from "../../lib/hooks/useRoles";
import { useCreateRule, useUpdateRule } from "../../lib/hooks/useRules";
import {
  RuleFormSchema,
  type ActionConditions,
  type ActionConfig,
  type ActionRule,
  type RuleStep,
} from "../../lib/schemas";
import { validateWorkflow } from "../../lib/workflow-validation";
import { ApiError } from "../../lib/client";
import { toast } from "sonner";
import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { AddActionNode } from "./nodes/AddActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useWorkflowNodes } from "./useWorkflowNodes";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Alert } from "../ui/alert";
import { Icon } from "../Icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../ui/tooltip";
import { PageSkeleton } from "../PageSkeleton";

interface RuleDraft {
  name: string;
  eventType: string;
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
  conditions: ActionConditions;
  priority: number;
  enabled: boolean;
}

interface WorkflowEditorProps {
  rule?: ActionRule;
  draft?: RuleDraft;
  onClose: () => void;
  onSwitchView?: (draft: RuleDraft) => void;
}

const emptyAction: ActionConfig = { type: "" };

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  addActionNode: AddActionNode,
  conditionNode: ConditionNode,
  delayNode: DelayNode,
};

type SelectedNode =
  | { type: "trigger" }
  | { type: "action"; index: number }
  | { type: "step"; stepId: string };

function WorkflowEditorInner({ rule, draft, onClose, onSwitchView }: WorkflowEditorProps) {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const [name, setName] = useState(draft?.name ?? rule?.name ?? "");
  const [eventType, setEventType] = useState(draft?.eventType ?? rule?.eventType ?? "");
  const [actions, setActions] = useState<ActionConfig[]>(
    draft?.actions ?? (rule?.actions.length ? rule.actions : [{ ...emptyAction }]),
  );
  const [steps, setSteps] = useState<RuleStep[] | undefined>(
    draft?.steps ?? rule?.steps,
  );
  const [entryStepId, setEntryStepId] = useState<string | undefined>(
    draft?.entryStepId ?? rule?.entryStepId,
  );
  const [conditions, setConditions] = useState<ActionConditions>(
    draft?.conditions ?? rule?.conditions ?? {},
  );
  const [priority, setPriority] = useState(draft?.priority ?? rule?.priority ?? 0);
  const [enabled, setEnabled] = useState(draft?.enabled ?? rule?.enabled ?? true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const isStepMode = !!(steps?.length && entryStepId);

  const nextStepId = useCallback(() => {
    const existing = steps ?? [];
    let idx = existing.length;
    while (existing.some((s) => s.id === `step_${idx}`)) idx++;
    return `step_${idx}`;
  }, [steps]);

  const addAction = useCallback(() => {
    if (!constants) return;
    if (isStepMode) {
      // Add action step at end of chain
      const newId = nextStepId();
      setSteps((prev) => {
        const current = prev ?? [];
        // Find the last step in the chain that has next=null
        const lastStep = current.find((s) => {
          if (s.type === "condition") return false;
          return (s.type === "action" || s.type === "delay") && s.next === null;
        });
        if (lastStep && (lastStep.type === "action" || lastStep.type === "delay")) {
          return [
            ...current.map((s) =>
              s.id === lastStep.id ? { ...s, next: newId } : s,
            ),
            { id: newId, type: "action" as const, action: { ...emptyAction }, next: null },
          ];
        }
        return [...current, { id: newId, type: "action" as const, action: { ...emptyAction }, next: null }];
      });
      if (!entryStepId) setEntryStepId(newId);
    } else if (actions.length < constants.maxActionsPerRule) {
      setActions((prev) => [...prev, { ...emptyAction }]);
    }
  }, [constants, actions.length, isStepMode, nextStepId, entryStepId]);

  const convertToStepMode = useCallback((): { converted: RuleStep[]; entry: string; nextIdx: number } => {
    const actionSteps: RuleStep[] = actions
      .filter((a) => a.type) // skip unconfigured
      .map((a, i, arr) => ({
        id: `step_${i}`,
        type: "action" as const,
        action: a,
        next: i < arr.length - 1 ? `step_${i + 1}` : null,
      }));
    return {
      converted: actionSteps,
      entry: actionSteps.length > 0 ? "step_0" : "",
      nextIdx: actionSteps.length,
    };
  }, [actions]);

  const addConditionStep = useCallback(() => {
    if (!isStepMode) {
      const { converted, entry, nextIdx } = convertToStepMode();
      const condId = `step_${nextIdx}`;
      const condStep: RuleStep = {
        id: condId,
        type: "condition",
        condition: { field: "channelId", operator: "equals", value: "" },
        thenNext: null,
        elseNext: null,
      };
      // Wire last action to condition
      const wired = converted.map((s, i) =>
        i === converted.length - 1 ? { ...s, next: condId } : s,
      );
      setSteps([...wired, condStep]);
      setEntryStepId(entry || condId);
    } else {
      const newId = nextStepId();
      const condStep: RuleStep = {
        id: newId,
        type: "condition",
        condition: { field: "channelId", operator: "equals", value: "" },
        thenNext: null,
        elseNext: null,
      };
      setSteps((prev) => {
        const current = prev ?? [];
        const lastLinear = [...current].reverse().find(
          (s) => (s.type === "action" || s.type === "delay") && s.next === null,
        );
        if (lastLinear) {
          return [
            ...current.map((s) =>
              s.id === lastLinear.id ? { ...s, next: newId } : s,
            ),
            condStep,
          ];
        }
        return [...current, condStep];
      });
      if (!entryStepId) setEntryStepId(newId);
    }
  }, [isStepMode, convertToStepMode, nextStepId, entryStepId]);

  const addDelayStep = useCallback(() => {
    if (!isStepMode) {
      const { converted, entry, nextIdx } = convertToStepMode();
      const delayId = `step_${nextIdx}`;
      const delayStep: RuleStep = {
        id: delayId,
        type: "delay",
        delayMs: 5000,
        next: null,
      };
      const wired = converted.map((s, i) =>
        i === converted.length - 1 ? { ...s, next: delayId } : s,
      );
      const allSteps = [...wired, delayStep];
      setSteps(allSteps);
      setEntryStepId(entry || delayId);
    } else {
      const newId = nextStepId();
      const newStep: RuleStep = {
        id: newId,
        type: "delay",
        delayMs: 5000,
        next: null,
      };
      setSteps((prev) => {
        const current = prev ?? [];
        const lastStep = [...current].reverse().find(
          (s) => (s.type === "action" || s.type === "delay") && s.next === null,
        );
        if (lastStep) {
          return [
            ...current.map((s) =>
              s.id === lastStep.id ? { ...s, next: newId } : s,
            ),
            newStep,
          ];
        }
        return [...current, newStep];
      });
      if (!entryStepId) setEntryStepId(newId);
    }
  }, [isStepMode, convertToStepMode, nextStepId, entryStepId]);

  const handleStepChange = useCallback((stepId: string, updatedStep: RuleStep) => {
    setSteps((prev) => (prev ?? []).map((s) => (s.id === stepId ? updatedStep : s)));
  }, []);

  const handleStepRemove = useCallback((stepId: string) => {
    setSteps((prev) => {
      if (!prev) return prev;
      const step = prev.find((s) => s.id === stepId);
      if (!step) return prev;
      // Rewire: anything pointing to this step should point to this step's next
      const nextId =
        step.type === "condition" ? step.thenNext : step.next;
      return prev
        .filter((s) => s.id !== stepId)
        .map((s) => {
          if (s.type === "action" || s.type === "delay") {
            return s.next === stepId ? { ...s, next: nextId } : s;
          }
          if (s.type === "condition") {
            return {
              ...s,
              thenNext: s.thenNext === stepId ? nextId : s.thenNext,
              elseNext: s.elseNext === stepId ? nextId : s.elseNext,
            };
          }
          return s;
        });
    });
    if (entryStepId === stepId) {
      const step = steps?.find((s) => s.id === stepId);
      const nextId = step?.type === "condition" ? step.thenNext : (step as any)?.next;
      setEntryStepId(nextId ?? undefined);
    }
    setSelectedNode(null);
  }, [steps, entryStepId]);

  const validation = useMemo(
    () => validateWorkflow(eventType, actions, name, constants ?? undefined),
    [eventType, actions, name, constants],
  );

  const selectedNodeId = selectedNode
    ? selectedNode.type === "trigger"
      ? "trigger"
      : selectedNode.type === "step"
        ? `step-${selectedNode.stepId}`
        : `action-${selectedNode.index}`
    : null;

  const { nodes: computedNodes, edges: computedEdges } = useWorkflowNodes({
    eventType,
    actions,
    steps,
    entryStepId,
    constants: constants ?? undefined,
    maxActions: constants?.maxActionsPerRule,
    selectedNodeId,
    onAddAction: addAction,
    validationIssues: validation.issues,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  // Sync computed nodes/edges when data changes, preserving user-dragged positions
  useEffect(() => {
    setNodes((prev) => {
      const posMap = new Map(prev.map((n) => [n.id, n.position]));
      return computedNodes.map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? n.position,
      }));
    });
  }, [computedNodes, setNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.id === "trigger") {
      setSelectedNode({ type: "trigger" });
    } else if (node.id.startsWith("step-")) {
      const stepId = node.id.replace("step-", "");
      setSelectedNode({ type: "step", stepId });
    } else if (node.id.startsWith("action-")) {
      const index = parseInt(node.id.split("-")[1], 10);
      setSelectedNode({ type: "action", index });
    }
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleActionChange = useCallback((index: number, action: ActionConfig) => {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  }, []);

  const handleActionRemove = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
    setSelectedNode(null);
  }, []);

  const handleActionMove = useCallback((index: number, direction: "up" | "down") => {
    setActions((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedNode((prev) => {
      if (prev?.type !== "action") return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      return { type: "action", index: target };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");

    // Derive flat actions from steps if in step mode for validation
    const effectiveActions = isStepMode
      ? (steps ?? [])
          .filter((s): s is Extract<RuleStep, { type: "action" }> => s.type === "action")
          .map((s) => s.action)
      : actions;

    const formData = {
      name: name.trim(),
      eventType,
      actions: effectiveActions.length > 0 ? effectiveActions : [{ type: "" }],
      ...(isStepMode ? { steps, entryStepId } : {}),
      conditions,
      priority,
      enabled,
    };

    const result = RuleFormSchema.safeParse(formData);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      if (rule) {
        await updateRule.mutateAsync({ ruleId: rule.id, data: result.data });
        toast.success("Rule updated");
      } else {
        await createRule.mutateAsync(result.data);
        toast.success("Rule created");
      }
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "An error occurred";
      setError(message);
    }
  }, [name, eventType, actions, priority, enabled, rule, createRule, updateRule, onClose]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.current?.fitView({ padding: 0.3, duration: 300 });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape — close panel or editor
      if (e.key === "Escape") {
        if (selectedNode) {
          setSelectedNode(null);
        } else {
          onClose();
        }
        return;
      }
      // Ctrl/Cmd+S — save
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // Ctrl/Cmd+Shift+F — fit view
      if (e.key === "F" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        handleFitView();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNode, onClose, handleSubmit, handleFitView]);

  const isPending = createRule.isPending || updateRule.isPending;

  const defaultViewport = useMemo(() => ({ x: 50, y: 20, zoom: 1 }), []);

  if (!constants) return <PageSkeleton />;

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-lowest">
      {/* Floating toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-low/90 px-4 py-2.5 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <Icon name="arrow_back" size={16} />
          <span className="text-text-muted">Rules</span>
        </Button>

        <div className="h-5 w-px bg-border" />

        {onSwitchView && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onSwitchView({ name, eventType, actions, steps, entryStepId, conditions, priority, enabled })
              }
            >
              <Icon name="edit_note" size={16} />
              Form View
            </Button>
            <div className="h-5 w-px bg-border" />
          </>
        )}

        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name..."
          maxLength={50}
          className="w-52"
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                max={100}
                className="w-20"
              />
            </TooltipTrigger>
            <TooltipContent>Priority (0–100)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-text-muted">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={addAction}
            disabled={!isStepMode && actions.length >= constants.maxActionsPerRule}
          >
            <Icon name="add" size={16} />
            Action
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addConditionStep}
          >
            <Icon name="call_split" size={16} className="text-warning" />
            Condition
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addDelayStep}
          >
            <Icon name="schedule" size={16} className="text-text-muted" />
            Delay
          </Button>
          <div className="h-5 w-px bg-border" />

          {/* Validation status */}
          {validation.issues.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Icon
                      name={validation.valid ? "warning" : "error"}
                      size={16}
                      className={validation.valid ? "text-warning" : "text-danger"}
                    />
                    <span className={validation.valid ? "text-warning" : "text-danger"}>
                      {validation.issues.length} issue{validation.issues.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-72">
                  <ul className="space-y-1 text-xs">
                    {validation.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Icon
                          name={issue.level === "error" ? "error" : "warning"}
                          size={12}
                          className={issue.level === "error" ? "text-danger" : "text-warning"}
                        />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : name.trim() && eventType && actions.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <Icon name="check_circle" size={16} />
              <span>Ready</span>
            </div>
          ) : null}

          <Button size="sm" onClick={handleSubmit} disabled={isPending || !validation.valid}>
            <Icon name={rule ? "save" : "check"} size={16} />
            {isPending ? "Saving..." : rule ? "Save" : "Create"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive" className="mx-4 mt-3 mb-0">
          {error}
        </Alert>
      )}

      {/* Canvas — fills remaining space */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
          defaultViewport={defaultViewport}
          fitView={false}
          proOptions={{ hideAttribution: true }}
          className="!bg-surface-lowest"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(255,255,255,0.04)"
          />
          <Controls
            showInteractive={false}
            className="!rounded-lg !border-border !bg-surface-low !shadow-lg [&>button]:!border-border [&>button]:!bg-surface-low [&>button]:!fill-text-muted [&>button:hover]:!bg-surface-high"
          />
          <MiniMap
            nodeStrokeWidth={3}
            className="!rounded-lg !border-border !bg-surface-low"
            maskColor="rgba(14, 14, 16, 0.8)"
          />
          <Panel position="bottom-right" className="!mb-2 !mr-2 flex gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFitView}
                    className="h-8 w-8 rounded-lg border border-border bg-surface-low shadow-lg hover:bg-surface-high"
                  >
                    <Icon name="fit_screen" size={16} className="text-text-muted" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Fit to view <kbd className="ml-1.5 rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+Shift+F</kbd>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Panel>
        </ReactFlow>

        {/* Detail panel — slides in from right */}
        {selectedNode?.type === "trigger" && (
          <NodeDetailPanel
            type="trigger"
            eventType={eventType}
            constants={constants}
            channels={channels}
            roles={roles}
            conditions={conditions}
            onEventTypeChange={setEventType}
            onConditionsChange={setConditions}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {selectedNode?.type === "action" && !isStepMode && (
          <NodeDetailPanel
            type="action"
            index={selectedNode.index}
            action={actions[selectedNode.index]}
            constants={constants}
            channels={channels}
            roles={roles}
            totalActions={actions.length}
            onActionChange={handleActionChange}
            onActionRemove={handleActionRemove}
            onActionMove={handleActionMove}
            canRemove={actions.length > 1}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {selectedNode?.type === "step" && steps && (
          <NodeDetailPanel
            type="step"
            stepId={selectedNode.stepId}
            steps={steps}
            constants={constants}
            channels={channels}
            roles={roles}
            onStepChange={handleStepChange}
            onStepRemove={handleStepRemove}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-4 border-t border-border bg-surface-low/60 px-4 py-1.5 text-[11px] text-text-muted">
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Esc</kbd> Close
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+S</kbd> Save
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+Shift+F</kbd> Fit view
        </span>
        <span className="ml-auto text-text-muted/50">
          Click a node to configure it
        </span>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
