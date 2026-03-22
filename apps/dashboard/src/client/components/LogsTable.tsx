import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogs } from "../lib/hooks/useLogs";
import { useConstants } from "../lib/hooks/useConstants";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";

export function LogsTable() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const [ruleFilter, setRuleFilter] = useState("");
  const { data: logs, isLoading } = useLogs(guildId, ruleFilter || undefined);

  if (isLoading) return <p className="text-text-muted">Loading...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Logs</h3>
        <Input
          type="text"
          value={ruleFilter}
          onChange={(e) => setRuleFilter(e.target.value)}
          placeholder="Search logs..."
          className="w-64 font-mono"
        />
      </div>

      {!logs || logs.length === 0 ? (
        <p className="py-10 text-center text-text-muted">No logs found.</p>
      ) : (
        <div className="rounded-xl bg-surface-low shadow-2xl">
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
