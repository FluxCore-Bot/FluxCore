import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useParams } from "@tanstack/react-router";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type OnEdgesChange,
  type OnNodesChange,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useConstants } from "../../../shared/hooks/useConstants";
import { useCreateRule, useUpdateRule } from "../hooks/useRules";
import { useRuleDraft } from "../hooks/useRuleDraft";
import {
  RuleFormSchema,
  type ActionConditions,
  type ActionConfig,
  type ActionRule,
  type RuleStep,
} from "../../../shared/lib/schemas";
import { validateWorkflow } from "../lib/workflow-validation";
import { ApiError } from "../../../shared/lib/client";
import { toast } from "sonner";
import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useWorkflowNodes } from "./useWorkflowNodes";
import { useWorkflowSteps } from "./useWorkflowSteps";
import { useWorkflowKeyboard } from "./useWorkflowKeyboard";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Switch } from "../../../shared/ui/switch";
import { Alert } from "../../../shared/ui/alert";
import { Icon } from "../../../shared/components/Icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../../../shared/ui/tooltip";
import { PageSkeleton } from "../../../shared/ui/skeletons";

export interface RuleDraft {
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
}

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  delayNode: DelayNode,
};

type SelectedNode =
  | { type: "trigger" }
  | { type: "action"; index: number }
  | { type: "step"; stepId: string };

function WorkflowEditorInner({ rule, draft, onClose }: WorkflowEditorProps) {
  const { t } = useTranslation(["rules", "common"]);
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const createRule = useCreateRule(guildId);
  const updateRule = useUpdateRule(guildId);
  const { saveDraft: saveDraftToStorage, loadDraft, clearDraft } = useRuleDraft(guildId, rule?.id);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Load saved draft on mount (only for new rules without an explicit draft)
  const savedDraft = !draft && !rule ? loadDraft() : null;
  const initialDraft = draft ?? savedDraft;

  const [name, setName] = useState(initialDraft?.name ?? rule?.name ?? "");
  const [eventType, setEventType] = useState(initialDraft?.eventType ?? rule?.eventType ?? "");
  const [conditions, setConditions] = useState<ActionConditions>(
    initialDraft?.conditions ?? rule?.conditions ?? {},
  );
  const [priority, setPriority] = useState(initialDraft?.priority ?? rule?.priority ?? 0);
  const [enabled, setEnabled] = useState(initialDraft?.enabled ?? rule?.enabled ?? true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const emptyAction: ActionConfig = { type: "" };

  const {
    actions,
    steps,
    entryStepId,
    isStepMode,
    addAction,
    addConditionStep,
    addDelayStep,
    handleStepChange,
    handleStepRemove: rawStepRemove,
    handleConnect,
    handleEdgeRemoval,
    handleActionChange: rawActionChange,
    handleActionRemove: rawActionRemove,
    handleActionMove: rawActionMove,
    convertAndSeverEdges,
  } = useWorkflowSteps({
    initialSteps: initialDraft?.steps ?? rule?.steps,
    initialEntryStepId: initialDraft?.entryStepId ?? rule?.entryStepId,
    initialActions: initialDraft?.actions ?? (rule?.actions.length ? rule.actions : [{ ...emptyAction }]),
    constants,
  });

  // Wrap step/action handlers to also manage selectedNode
  const handleStepRemove = useCallback((stepId: string) => {
    rawStepRemove(stepId);
    setSelectedNode(null);
  }, [rawStepRemove]);

  const handleActionRemove = useCallback((index: number) => {
    rawActionRemove(index);
    setSelectedNode(null);
  }, [rawActionRemove]);

  const handleActionMove = useCallback((index: number, direction: "up" | "down") => {
    rawActionMove(index, direction);
    setSelectedNode((prev) => {
      if (prev?.type !== "action") return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      return { type: "action", index: target };
    });
  }, [rawActionMove]);

  // Auto-save draft on changes
  useEffect(() => {
    saveDraftToStorage({ name, eventType, actions, steps, entryStepId, conditions, priority, enabled });
  }, [name, eventType, actions, steps, entryStepId, conditions, priority, enabled, saveDraftToStorage]);

  const validation = useMemo(
    () => validateWorkflow(eventType, actions, name, constants ?? undefined, t, steps, entryStepId),
    [eventType, actions, name, constants, t, steps, entryStepId],
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
    t,
  });

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(computedNodes);
  const [rfEdges, setEdges, onEdgesChangeBase] = useEdgesState(computedEdges);

  // Custom node change handler: intercept node removals from React Flow's
  // built-in delete key so they sync back to our actions/steps state.
  // Without this, React Flow removes the node visually but our data model
  // still has the action, causing it to reappear on the next sync.
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const removals = changes.filter((c) => c.type === "remove");
    if (removals.length > 0) {
      for (const change of removals) {
        if (change.type !== "remove") continue;
        const nodeId = change.id;
        if (nodeId.startsWith("action-") && !isStepMode) {
          const index = parseInt(nodeId.split("-")[1], 10);
          if (!isNaN(index)) {
            if (actions.length > 1) {
              handleActionRemove(index);
            } else {
              // Last action — reset to empty instead of removing
              rawActionChange(index, { type: "" });
              setSelectedNode(null);
            }
          }
        } else if (nodeId.startsWith("step-")) {
          const stepId = nodeId.slice(5);
          handleStepRemove(stepId);
        }
        // Ignore trigger/add-action node removals
      }
      // Don't pass removals to React Flow — our sync effect handles the visual update
      const nonRemovals = changes.filter((c) => c.type !== "remove");
      if (nonRemovals.length > 0) {
        onNodesChangeBase(nonRemovals);
      }
      return;
    }
    onNodesChangeBase(changes);
  }, [isStepMode, actions.length, handleActionRemove, rawActionChange, handleStepRemove, onNodesChangeBase]);

  // Custom edge change handler: intercept edge removals and update step data
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const removals = changes.filter((c) => c.type === "remove");
    if (removals.length > 0) {
      if (isStepMode) {
        for (const change of removals) {
          if (change.type !== "remove") continue;
          const edge = rfEdges.find((e) => e.id === change.id);
          if (!edge) continue;
          handleEdgeRemoval(edge.source, edge.sourceHandle);
        }
      } else {
        // V1 mode: convert to step mode with deleted connections severed
        const removedIds = new Set(
          removals.filter((c) => c.type === "remove").map((c) => c.id),
        );
        convertAndSeverEdges(removedIds);
      }
    }
    const nonRemovals = changes.filter((c) => c.type !== "remove");
    if (nonRemovals.length > 0) {
      onEdgesChangeBase(nonRemovals);
    }
  }, [isStepMode, rfEdges, handleEdgeRemoval, convertAndSeverEdges, onEdgesChangeBase]);

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

  /** Validate whether a proposed connection is allowed */
  const isValidConnection = useCallback((connection: Edge | Connection): boolean => {
    let { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) return false;
    // Normalise reversed connections (dragging from a target handle)
    if (sourceHandle === "target" || targetHandle === "source") {
      [source, target] = [target, source];
    }
    if (source === target) return false;
    if (source === "trigger") return target.startsWith("step-");
    if (target === "trigger") return source.startsWith("step-");
    if (target === "add-action") return false;
    if (!source.startsWith("step-") || !target.startsWith("step-")) return false;
    return true;
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");

    const effectiveActions = isStepMode
      ? (steps ?? [])
          .filter((s): s is Extract<RuleStep, { type: "action" }> => s.type === "action")
          .map((s) => s.action)
      : actions;

    const configuredActions = effectiveActions.filter((a) => a.type);
    if (configuredActions.length === 0) {
      setError(t("form.atLeastOneAction"));
      return;
    }

    const formData = {
      name: name.trim(),
      eventType,
      actions: configuredActions,
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
        toast.success(t("toast.updated"));
      } else {
        await createRule.mutateAsync(result.data);
        toast.success(t("toast.created"));
      }
      clearDraft();
      onClose();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("editor.genericError");
      setError(message);
    }
  }, [name, eventType, actions, steps, entryStepId, isStepMode, conditions, priority, enabled, rule, createRule, updateRule, onClose, clearDraft, t]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.current?.fitView({ padding: 0.3, duration: 300 });
  }, []);

  // Keyboard shortcuts
  const handleActionReset = useCallback((index: number) => {
    rawActionChange(index, { type: "" });
    setSelectedNode(null);
  }, [rawActionChange]);

  useWorkflowKeyboard({
    selectedNode,
    isStepMode,
    actionsLength: actions.length,
    onClose,
    onDeselectNode: () => setSelectedNode(null),
    onSubmit: handleSubmit,
    onFitView: handleFitView,
    onAddAction: addAction,
    onActionRemove: handleActionRemove,
    onActionReset: handleActionReset,
    onActionMove: handleActionMove,
    onStepRemove: handleStepRemove,
  });

  const isPending = createRule.isPending || updateRule.isPending;
  const defaultViewport = useMemo(() => ({ x: 50, y: 20, zoom: 1 }), []);

  if (!constants) return <PageSkeleton />;

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-lowest">
      <style>{`
        .react-flow__edge.selected .react-flow__edge-path,
        .react-flow__edge:focus .react-flow__edge-path,
        .react-flow__edge:focus-visible .react-flow__edge-path {
          stroke: rgba(163, 166, 255, 0.9) !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 6px rgba(163, 166, 255, 0.5));
        }
        .react-flow__edge.selected .react-flow__edge-interaction {
          stroke-width: 20px;
        }
      `}</style>
      {/* Floating toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-low/90 px-3 py-2 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2.5">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <Icon name="arrow_back" size={16} className="rtl:rotate-180" />
          <span className="hidden text-text-muted sm:inline">{t("editor.backToRules")}</span>
        </Button>

        <div className="h-5 w-px bg-border" />

        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("editor.ruleNamePlaceholder")}
          maxLength={50}
          className="w-32 sm:w-52"
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
            <TooltipContent>{t("editor.priorityTooltip")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-xs text-text-muted">
            {enabled ? t("common:labels.enabled") : t("common:labels.disabled")}
          </span>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={addAction}
            disabled={!isStepMode && actions.length >= constants.maxActionsPerRule}
          >
            <Icon name="add" size={16} />
            {t("editor.addAction")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addConditionStep}
          >
            <Icon name="call_split" size={16} className="text-warning" />
            {t("editor.addCondition")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={addDelayStep}
          >
            <Icon name="schedule" size={16} className="text-text-muted" />
            {t("editor.addDelay")}
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
                      {t("editor.issues", { count: validation.issues.length })}
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
              <span>{t("workflow.status.ready")}</span>
            </div>
          ) : null}

          <Button size="sm" onClick={handleSubmit} disabled={isPending || !validation.valid}>
            <Icon name={rule ? "save" : "check"} size={16} />
            {isPending ? t("form.saving") : rule ? t("form.update") : t("form.create")}
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
      <div
        className="relative flex-1"
        role="group"
        aria-label={t("editor.canvasLabel")}
      >
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}

          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          edgesFocusable={true}
          edgesReconnectable={true}
          elementsSelectable={true}
          onNodeClick={onNodeClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
          defaultViewport={defaultViewport}
          fitView={false}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          className="!bg-surface-lowest"
          connectionLineStyle={{ stroke: "rgba(163, 166, 255, 0.4)", strokeWidth: 2 }}
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
          <Panel position="bottom-right" className="!mb-2 me-2! flex gap-1.5">
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
                  {t("editor.fitToView")} <kbd className="ms-1.5 rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+Shift+F</kbd>
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
            guildId={guildId}
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
            guildId={guildId}
            totalActions={actions.length}
            onActionChange={rawActionChange}
            onActionRemove={actions.length > 1 ? handleActionRemove : handleActionReset}
            onActionMove={handleActionMove}
            canRemove={true}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {selectedNode?.type === "step" && steps && (
          <NodeDetailPanel
            type="step"
            stepId={selectedNode.stepId}
            steps={steps}
            constants={constants}
            guildId={guildId}
            onStepChange={handleStepChange}
            onStepRemove={handleStepRemove}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center gap-4 border-t border-border bg-surface-low/60 px-4 py-1.5 text-[11px] text-text-muted">
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Esc</kbd> {t("editor.shortcuts.close")}
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+S</kbd> {t("editor.shortcuts.save")}
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Del</kbd> {t("editor.shortcuts.removeNode")}
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">A</kbd> {t("editor.shortcuts.addAction")}
        </span>
        <span>
          <kbd className="rounded bg-surface-lowest px-1 py-0.5 font-mono text-[10px]">Ctrl+Shift+F</kbd> {t("editor.shortcuts.fitView")}
        </span>
        <span className="ms-auto text-text-muted/50">
          {t("editor.disconnectHint")}
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
