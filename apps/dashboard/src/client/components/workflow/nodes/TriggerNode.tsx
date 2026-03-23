import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../Icon";
import type { TriggerNodeData } from "../useWorkflowNodes";

function getBorderClass(
  selected: boolean | undefined,
  validationState: TriggerNodeData["validationState"],
): string {
  if (validationState === "error") {
    return "border-danger bg-danger/10 shadow-[0px_0px_16px_0px_rgba(255,100,100,0.15)]";
  }
  if (validationState === "warning") {
    return "border-warning bg-warning/10";
  }
  if (selected) {
    return "border-accent bg-accent/15 shadow-[0px_0px_16px_0px_rgba(163,166,255,0.2)]";
  }
  return "border-accent/40 bg-accent/5";
}

function TriggerNodeComponent({ data, selected }: NodeProps) {
  const { label, description, validationState } = data as TriggerNodeData;

  return (
    <>
      <div
        className={`min-w-[220px] max-w-[260px] rounded-lg border-2 px-4 py-3 transition-all ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/20">
            <Icon name="bolt" size={14} className="text-accent" />
          </div>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-accent">
            Trigger
          </span>
          {validationState === "error" && (
            <Icon name="error" size={14} className="ml-auto text-danger" />
          )}
          {validationState === "warning" && (
            <Icon name="warning" size={14} className="ml-auto text-warning" />
          )}
        </div>
        <p className="text-sm font-medium text-text">{label}</p>
        {description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-text-muted">
            {description}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-accent !bg-surface-high"
      />
    </>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
