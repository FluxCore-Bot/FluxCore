import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogs } from "../lib/hooks/useLogs";
import { useConstants } from "../lib/hooks/useConstants";
import { Icon } from "./Icon";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./PageSkeleton";

export function LogsTable() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const [ruleFilter, setRuleFilter] = useState("");
  const { data: logs, isLoading } = useLogs(guildId, ruleFilter || undefined);

  if (isLoading) return <TableSkeleton rows={8} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Logs</h3>
        <div className="relative w-64">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            type="text"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            placeholder="Search logs..."
            className="pl-9 font-mono"
          />
        </div>
      </div>

      {!logs || logs.length === 0 ? (
        <EmptyState
          icon="description"
          title="No logs found"
          description="Rule execution logs will appear here once automation rules start running."
        />
      ) : (
        <div className="rounded-xl bg-surface-low shadow-2xl glass-edge">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Time</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-text-muted">
                    {new Date(log.executedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm font-semibold">{log.ruleName}</TableCell>
                  <TableCell className="text-sm text-text-muted">
                    {constants?.eventTypes[log.eventType]?.label ?? log.eventType}
                  </TableCell>
                  <TableCell className="text-sm text-text-muted">
                    {constants?.actionTypes[log.actionType]?.label ?? log.actionType}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={log.success ? "success" : "destructive"}>
                      {log.success ? "OK" : "Error"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-danger">
                    {log.error ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
