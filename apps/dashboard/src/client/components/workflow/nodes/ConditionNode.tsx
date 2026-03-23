import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../Icon";

export interface ConditionNodeData {
  index: number;
  field: string;
  operator: string;
  value: string;
  label: string;
  validationState?: "valid" | "warning" | "error" | null;
  [key: string]: unknown;
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "=",
  notEquals: "≠",
  contains: "contains",
  notContains: "!contains",
  startsWith: "starts",
  endsWith: "ends",
  greaterThan: ">",
  lessThan: "<",
  hasRole: "has role",
  notHasRole: "!has role",
  inList: "in",
  notInList: "not in",
};

function getBorderClass(
  selected: boolean | undefined,
  validationState: ConditionNodeData["validationState"],
): string {
  if (validationState === "error") {
    return "border-danger/60 bg-danger/5";
  }
  if (selected) {
    return "border-warning/60 bg-warning/10 shadow-[0px_0px_12px_0px_rgba(255,200,50,0.15)]";
  }
  return "border-warning/30 bg-warning/5";
}

function ConditionNodeComponent({ data, selected }: NodeProps) {
  const { field, operator, value, label, validationState } =
    data as ConditionNodeData;
  const isConfigured = field && operator;
  const opLabel = OPERATOR_LABELS[operator] ?? operator;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-warning !bg-surface-high"
      />
      <div
        className={`min-w-[200px] max-w-[260px] rounded-lg border-2 px-4 py-3 transition-all ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-warning/20">
            <Icon name="call_split" size={14} className="text-warning" />
          </div>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-warning">
            Condition
          </span>
          {!isConfigured && (
            <span
              className="ml-auto flex h-2 w-2 rounded-full bg-warning/60"
              title="Not configured"
            />
          )}
        </div>
        <p className="text-sm font-medium text-text">{label}</p>
        {isConfigured && (
          <p className="mt-1 truncate text-[11px] text-text-muted">
            {field} {opLabel} {value || "..."}
          </p>
        )}
      </div>
      {/* Yes/Then branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="then"
        className="!h-3 !w-3 !border-2 !border-secondary !bg-surface-high"
        style={{ top: "35%" }}
      />
      {/* No/Else branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="else"
        className="!h-3 !w-3 !border-2 !border-danger !bg-surface-high"
        style={{ top: "65%" }}
      />
    </>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
