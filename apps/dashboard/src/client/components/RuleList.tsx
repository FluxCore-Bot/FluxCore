import { Icon } from "./Icon";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { EmptyState } from "./EmptyState";
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
      <EmptyState
        icon="bolt"
        title="No rules yet"
        description="Create your first automation rule to get started with event-driven actions."
      />
    );
  }

  return (
    <div className="rounded-xl bg-surface-low shadow-2xl glass-edge">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Operations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <span className="text-sm font-semibold">{rule.name}</span>
              </TableCell>
              <TableCell className="text-sm text-text-muted">
                {constants?.eventTypes[rule.eventType]?.label ?? rule.eventType}
              </TableCell>
              <TableCell className="text-sm text-text-muted">
                {rule.actions.length}{" "}
                {rule.actions.length === 1 ? "action" : "actions"}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={rule.enabled ? "success" : "destructive"}
                  className="cursor-pointer"
                  onClick={() => onToggle(rule)}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} aria-label="Edit rule">
                    <Icon name="edit" className="text-text/40 hover:text-accent" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(rule)} aria-label="Delete rule">
                    <Icon name="delete" className="text-text/40 hover:text-danger" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
