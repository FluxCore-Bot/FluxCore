import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useLogEntries, type LogFilters } from "../lib/hooks/useLogging";
import { Icon } from "./Icon";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./PageSkeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const PAGE_SIZE = 25;

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "message", label: "Message" },
  { value: "member", label: "Member" },
  { value: "voice", label: "Voice" },
  { value: "channel", label: "Channel" },
  { value: "role", label: "Role" },
  { value: "server", label: "Server" },
  { value: "moderation", label: "Moderation" },
];

const CATEGORY_COLORS: Record<string, string> = {
  message: "text-blue-400",
  member: "text-accent",
  voice: "text-purple-400",
  channel: "text-warning",
  role: "text-warning",
  server: "text-warning",
  moderation: "text-danger",
};

export function EventLogBrowser() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const [category, setCategory] = useState("");
  const [targetId, setTargetId] = useState("");
  const [page, setPage] = useState(1);

  const filters: LogFilters = {
    page,
    limit: PAGE_SIZE,
  };
  if (category) filters.category = category;
  if (targetId.trim()) filters.targetId = targetId.trim();

  const { data, isLoading } = useLogEntries(guildId, filters);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="list" size={20} className="text-accent" />
        <h3 className="text-lg font-semibold font-display">Event Log Browser</h3>
        {data && (
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {data.total.toLocaleString()} entries
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-56">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="text"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by User ID..."
            className="pl-10 font-mono text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          icon="shield"
          title="No event logs found"
          description="Event logs will appear here once logging is configured and events start occurring."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface-low shadow-2xl glass-edge">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Executor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs font-mono text-text-muted whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${CATEGORY_COLORS[entry.category] ?? ""}`}
                      >
                        {entry.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {entry.eventType}
                    </TableCell>
                    <TableCell className="text-sm text-text-muted font-mono">
                      {entry.targetId ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-text-muted font-mono">
                      {entry.executorId ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs sm:text-sm">
              Page {page} of {totalPages} ({data.total.toLocaleString()} total)
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
