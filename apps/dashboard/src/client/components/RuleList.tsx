import type { ActionRule, Constants } from "../lib/schemas";

interface RuleListProps {
  rules: ActionRule[];
  constants: Constants | undefined;
  onEdit: (rule: ActionRule) => void;
  onDelete: (rule: ActionRule) => void;
  onToggle: (rule: ActionRule) => void;
}

export function RuleList({
  rules,
  constants,
  onEdit,
  onDelete,
  onToggle,
}: RuleListProps) {
  if (rules.length === 0) {
    return (
      <p className="py-10 text-center text-text-muted">
        No rules yet. Create one to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
              Event
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-text-muted">
              Actions
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium uppercase text-text-muted">
              Status
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase text-text-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-b border-border/50">
              <td className="px-3 py-2.5 text-sm">{rule.name}</td>
              <td className="px-3 py-2.5 text-sm text-text-muted">
                {constants?.eventTypes[rule.eventType]?.label ?? rule.eventType}
              </td>
              <td className="px-3 py-2.5 text-sm text-text-muted">
                {rule.actions.length}{" "}
                {rule.actions.length === 1 ? "action" : "actions"}
              </td>
              <td className="px-3 py-2.5 text-center">
                <button
                  onClick={() => onToggle(rule)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    rule.enabled
                      ? "bg-success/20 text-success"
                      : "bg-danger/20 text-danger"
                  }`}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </button>
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(rule)}
                    className="rounded-md px-3 py-1 text-xs text-accent hover:bg-accent/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(rule)}
                    className="rounded-md px-3 py-1 text-xs text-danger hover:bg-danger/10"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
