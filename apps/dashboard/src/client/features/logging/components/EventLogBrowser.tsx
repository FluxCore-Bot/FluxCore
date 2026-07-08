import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "@tanstack/react-router";
import { useLogEntries, type LogFilters } from "../hooks/useLogging";
import { CATEGORY_ICONS } from "./EventLogConfig";
import { Icon } from "../../../shared/components/Icon";
import { Input } from "../../../shared/ui/input";
import { Button } from "../../../shared/ui/button";
import { Badge } from "../../../shared/ui/badge";
import { EmptyState } from "../../../shared/components/EmptyState";
import { TableSkeleton } from "../../../shared/ui/skeletons";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";

const PAGE_SIZE = 25;

const CATEGORY_VALUES = ["", "message", "member", "voice", "channel", "role", "server", "moderation"];

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
  const { t } = useTranslation(["logs", "common"]);
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
        <h2 className="text-lg font-semibold font-display">{t("events.title")}</h2>
        {data && (
          <Badge variant="outline" className="ms-auto text-xs font-mono">
            {t("events.filter.entries", { count: data.total.toLocaleString() })}
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
            <SelectValue placeholder={t("events.filter.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_VALUES.map((val) => (
              <SelectItem key={val} value={val}>
                {val === "" ? t("events.filter.allCategories") : t(`events.categories.${val}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-56">
          <Icon
            name="search"
            size={16}
            className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="text"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setPage(1);
            }}
            placeholder={t("events.filter.byUserId")}
            aria-label={t("events.filter.byUserId")}
            className="ps-10 font-mono text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          icon="shield"
          title={t("events.empty.title")}
          description={t("events.empty.description")}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg bg-surface-low shadow-2xl glass-edge">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("events.table.timestamp")}</TableHead>
                  <TableHead>{t("events.table.category")}</TableHead>
                  <TableHead>{t("events.table.event")}</TableHead>
                  <TableHead>{t("events.table.target")}</TableHead>
                  <TableHead>{t("events.table.executor")}</TableHead>
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
                        className={`inline-flex items-center gap-1 text-xs ${CATEGORY_COLORS[entry.category] ?? ""}`}
                      >
                        <Icon
                          name={CATEGORY_ICONS[entry.category] ?? "circle"}
                          size={12}
                        />
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
              {t("events.pagination.page", { page, total: totalPages, count: data.total.toLocaleString() })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("events.pagination.previous")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("events.pagination.next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
