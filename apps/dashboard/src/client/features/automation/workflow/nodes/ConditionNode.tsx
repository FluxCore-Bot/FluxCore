import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "../../../../shared/components/Icon";

export interface ConditionNodeData {
  index: number;
  field: string;
  operator: string;
  value: string;
  label: string;
  validationState?: "valid" | "warning" | "error" | null;
  [key: string]: unknown;
}

const OPERATOR_LABEL_KEYS: Record<string, string> = {
  equals: "operatorShort.equals",
  notEquals: "operatorShort.notEquals",
  contains: "operatorShort.contains",
  notContains: "operatorShort.notContains",
  startsWith: "operatorShort.startsWith",
  endsWith: "operatorShort.endsWith",
  greaterThan: "operatorShort.greaterThan",
  lessThan: "operatorShort.lessThan",
  hasRole: "operatorShort.hasRole",
  notHasRole: "operatorShort.notHasRole",
  inList: "operatorShort.inList",
  notInList: "operatorShort.notInList",
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

function ConditionNodeComponent({ data, selected }: NodeProps) {
  const { t } = useTranslation("rules");
  const { field, operator, value, label, validationState } =
    data as ConditionNodeData;
  const isConfigured = field && operator;
  const opLabelKey = OPERATOR_LABEL_KEYS[operator];
  const opLabel = opLabelKey ? t(opLabelKey) : operator;

  return (
    <>
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="h-4! w-4! border-2! border-warning! bg-surface-high! after:absolute after:-inset-3.5 after:rounded-full after:content-['']"
      />
      <div
        role="group"
        data-validation={validationState ?? undefined}
        aria-label={t("nodes.ariaCondition", { label })}
        className={`min-w-[200px] max-w-[260px] rounded-lg border-2 px-4 py-3 transition-all ${getBorderClass(selected, validationState)}`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-warning/20">
            <Icon name="call_split" size={14} className="text-warning" />
          </div>
          <span className="section-label text-warning">
            {t("nodes.condition")}
          </span>
          <ValidationBadge state={validationState} />
          {!isConfigured && (
            <span
              role="img"
              aria-label={t("workflow.status.notConfigured")}
              className="ms-auto flex h-2 w-2 rounded-full bg-warning/60"
              title={t("workflow.status.notConfigured")}
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
        title={t("nodes.yesThen")}
        className="h-4! w-4! border-2! border-secondary! bg-surface-high! after:absolute after:-inset-2.5 after:rounded-full after:content-['']"
        style={{ top: "30%" }}
      />
      {/* No/Else branch */}
      <Handle
        type="source"
        position={Position.Right}
        id="else"
        title={t("nodes.noElse")}
        className="h-4! w-4! border-2! border-danger! bg-surface-high! after:absolute after:-inset-2.5 after:rounded-full after:content-['']"
        style={{ top: "70%" }}
      />
    </>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
