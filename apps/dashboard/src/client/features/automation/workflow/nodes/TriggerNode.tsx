import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../../../shared/components/Icon";
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

/**
 * Non-colour signal for a node's validation state.
 *
 * Colour alone cannot carry this: a condition node's brand colour already IS
 * amber, so a "warning" border is indistinguishable from its normal styling —
 * and colour-only status fails WCAG 1.4.1 regardless. The data attribute also
 * gives the toolbar's issue list something to scroll to.
 */
function ValidationBadge({
  state,
}: {
  state: "valid" | "warning" | "error" | null | undefined;
}) {
  const { t } = useTranslation("rules");
  if (state !== "warning" && state !== "error") return null;
  return (
    <span
      role="img"
      aria-label={t(state === "error" ? "nodes.hasError" : "nodes.hasWarning")}
      className={`ms-auto ${state === "error" ? "text-danger" : "text-warning"}`}
    >
      <Icon name={state === "error" ? "error" : "warning"} size={14} />
    </span>
  );
}

function TriggerNodeComponent({ data, selected }: NodeProps) {
  const { t } = useTranslation("rules");
  const { label, description, validationState, filterCount } = data as TriggerNodeData;

  return (
    <>
      <div
        role="group"
        data-validation={validationState ?? undefined}
        aria-label={t("nodes.ariaTrigger", { label })}
        className={`min-w-[220px] max-w-[260px] rounded-lg border-2 px-4 py-3 transition-all ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/20">
            <Icon name="bolt" size={14} className="text-accent" />
          </div>
          <span className="section-label text-accent">
            {t("nodes.trigger")}
          </span>
          <ValidationBadge state={validationState} />
          {!!filterCount && (
            <span
              className="ms-auto flex items-center gap-1 rounded bg-surface-high px-1.5 py-0.5 text-[10px] text-text-secondary"
              aria-label={t("nodes.activeFilters", { count: filterCount })}
            >
              <Icon name="filter_alt" size={11} />
              {filterCount}
            </span>
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
        id="source"
        type="source"
        position={Position.Right}
        title={t("nodes.nextStep")}
        className="h-4! w-4! border-2! border-accent! bg-surface-high! after:absolute after:-inset-3.5 after:rounded-full after:content-['']"
      />
    </>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
