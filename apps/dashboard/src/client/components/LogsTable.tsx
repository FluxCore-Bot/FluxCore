import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogs } from "../lib/hooks/useLogs";
import { useConstants } from "../lib/hooks/useConstants";
import { Icon } from "./Icon";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { StatsCard } from "./StatsCard";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./PageSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const PAGE_SIZE = 10;

export function LogsTable() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { data: constants } = useConstants();
  const [ruleFilter, setRuleFilter] = useState("");
  const [dateRange, setDateRange] = useState("7d");
  const [page, setPage] = useState(1);
  const { data: logs, isLoading } = useLogs(guildId, ruleFilter || undefined);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const now = Date.now();
    const rangeMs: Record<string, number> = {
      "1h": 3600_000,
      "24h": 86400_000,
      "7d": 604800_000,
    };
    const cutoff = now - (rangeMs[dateRange] ?? rangeMs["7d"]);
    return logs.filter((log) => new Date(log.executedAt).getTime() >= cutoff);
  }, [logs, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Metrics
  const totalLogs = filteredLogs.length;
  const successCount = filteredLogs.filter((l) => l.success).length;
  const failureCount = totalLogs - successCount;
  const successRate = totalLogs > 0 ? ((successCount / totalLogs) * 100).toFixed(1) : "—";

  if (isLoading) return <TableSkeleton rows={8} />;

  return (
    <div className="space-y-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label="Execution Rate"
          value={`${successRate}%`}
          accentColor="border-success"
          valueClassName="text-success"
        />
        <StatsCard
          label="Total Failures"
          value={failureCount}
          accentColor="border-danger"
          valueClassName="text-danger"
        />
        <StatsCard
          label="Total Entries"
          value={totalLogs.toLocaleString()}
          accentColor="border-accent"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            type="text"
            value={ruleFilter}
            onChange={(e) => { setRuleFilter(e.target.value); setPage(1); }}
            placeholder="Search logs..."
            className="pl-10 font-mono"
          />
        </div>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last 1 hour</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!filteredLogs || filteredLogs.length === 0 ? (
        <EmptyState
          icon="description"
          title="No logs found"
          description="Rule execution logs will appear here once automation rules start running."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface-low shadow-2xl glass-edge">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-text-muted whitespace-nowrap">
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
                        {log.success ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-danger max-w-48 truncate">
                      {log.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs sm:text-sm">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filteredLogs.length)} of{" "}
              {filteredLogs.length.toLocaleString()} results
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
