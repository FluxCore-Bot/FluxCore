import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../../../shared/components/Icon";
import { ACTION_ICONS, getActionPreview } from "../../lib/rule-icons";
import type { ActionNodeData } from "../useWorkflowNodes";

function getBorderClass(
  selected: boolean | undefined,
  validationState: ActionNodeData["validationState"],
): string {
  if (validationState === "error") {
    return "border-danger/60 bg-danger/5 shadow-[0px_0px_12px_0px_rgba(255,100,100,0.1)]";
  }
  if (validationState === "warning") {
    return "border-warning/50 bg-warning/5";
  }
  if (selected) {
    return "border-secondary/60 bg-surface-high shadow-[0px_0px_12px_0px_rgba(172,138,255,0.15)]";
  }
  return "border-outline-variant/10 bg-surface-low";
}

function ActionNodeComponent({ data, selected }: NodeProps) {
  const { t } = useTranslation("rules");
  const { index, action, label, validationState } = data as ActionNodeData;
  const icon = ACTION_ICONS[action.type] ?? "play_arrow";
  const preview = getActionPreview(action, t);
  const isConfigured = action.type !== "";

  return (
    <>
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-4 !w-4 !border-2 !border-secondary !bg-surface-high"
      />
      <div
        role="group"
        aria-label={t("nodes.ariaAction", { index: index + 1, label })}
        className={`min-w-[220px] max-w-[260px] rounded-lg border px-4 py-3 transition-all glass-edge ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-secondary/15">
            <Icon name={icon} size={14} className="text-secondary" />
          </div>
          <span className="section-label text-text-muted">
            {t("nodes.action", { index: index + 1 })}
          </span>
          {validationState === "error" && (
            <Icon name="error" size={14} className="ms-auto text-danger" />
          )}
          {validationState === "warning" && (
            <Icon name="warning" size={14} className="ms-auto text-warning" />
          )}
          {!isConfigured && !validationState && (
            <span className="ms-auto flex h-2 w-2 rounded-full bg-warning/60" title={t("workflow.status.notConfigured")} />
          )}
        </div>
        <p className="text-sm font-medium text-text">{label}</p>
        {preview && (
          <p className="mt-1 truncate text-[11px] text-text-muted">
            {preview}
          </p>
        )}
      </div>
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        title={t("nodes.nextStep")}
        className="!h-4 !w-4 !border-2 !border-secondary/50 !bg-surface-high"
      />
    </>
  );
}

export const ActionNode = memo(ActionNodeComponent);
