import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../../../shared/components/Icon";

export interface DelayNodeData {
  index: number;
  delayMs: number;
  label: string;
  validationState?: "valid" | "warning" | "error" | null;
  [key: string]: unknown;
}

function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return remainSecs > 0 ? `${mins}m ${remainSecs}s` : `${mins}m`;
}

function getBorderClass(
  selected: boolean | undefined,
  validationState: DelayNodeData["validationState"],
): string {
  if (validationState === "error") {
    return "border-danger/60 bg-danger/5";
  }
  if (selected) {
    return "border-text-muted/50 bg-surface-high shadow-[0px_0px_12px_0px_rgba(150,150,150,0.1)]";
  }
  return "border-text-muted/20 bg-surface-low";
}

function DelayNodeComponent({ data, selected }: NodeProps) {
  const { delayMs, label, validationState } = data as DelayNodeData;

  return (
    <>
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-4 !w-4 !border-2 !border-text-muted !bg-surface-high"
      />
      <div
        role="group"
        aria-label={`Delay: ${label}`}
        className={`min-w-[160px] max-w-[220px] rounded-lg border-2 px-4 py-3 transition-all ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-text-muted/15">
            <Icon name="schedule" size={14} className="text-text-muted" />
          </div>
          <span className="section-label text-text-muted">
            Delay
          </span>
        </div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Wait {formatDelay(delayMs)}
        </p>
      </div>
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-4 !w-4 !border-2 !border-text-muted/50 !bg-surface-high"
      />
    </>
  );
}

export const DelayNode = memo(DelayNodeComponent);
