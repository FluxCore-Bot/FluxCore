import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
  useSuggestions,
  useSuggestionSettings,
  useUpdateSuggestionSettings,
  useUpdateSuggestionStatus,
  useDeleteSuggestion,
} from "../../../features/suggestions/hooks/useSuggestions";
import { DiscordSelect } from "../../../shared/ui/discord-select";
import { Button } from "../../../shared/ui/button";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import { Switch } from "../../../shared/ui/switch";
import { Badge } from "../../../shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../shared/ui/table";
import { Separator } from "../../../shared/ui/separator";
import { Icon } from "../../../shared/components/Icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { StatsCard } from "../../../shared/components/StatsCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../shared/ui/dialog";
import { Textarea } from "../../../shared/ui/textarea";
import { MessageSquare, Power, Hash } from "lucide-react";
import { PageSkeleton, TableSkeleton, FormSkeleton } from "../../../shared/ui/skeletons";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  denied: "destructive",
  implemented: "secondary",
};

export function SuggestionsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t, i18n } = useTranslation("suggestions");

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Suggestions list
  const { data: suggestionsData, isLoading: suggestionsLoading } = useSuggestions(guildId, {
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 10,
  });

  // Settings
  const { data: settings, isLoading: settingsLoading } = useSuggestionSettings(guildId);
  const updateSettings = useUpdateSuggestionSettings(guildId);

  // Actions
  const updateStatus = useUpdateSuggestionStatus(guildId);
  const deleteSuggestion = useDeleteSuggestion(guildId);

  // Status change dialog
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    id: number;
    action: string;
  }>({ open: false, id: 0, action: "" });
  const [statusReason, setStatusReason] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const totalPages = suggestionsData
    ? Math.max(1, Math.ceil(suggestionsData.total / 10))
    : 1;

  function handleToggleSetting(
    key: "enabled" | "dmOnStatusChange" | "autoThread" | "anonymousMode",
    value: boolean,
  ) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingsFailed")),
      },
    );
  }

  function handleChannelSetting(key: "channelId" | "reviewChannelId", value: string | null) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingsFailed")),
      },
    );
  }

  function openStatusDialog(id: number, action: string) {
    setStatusDialog({ open: true, id, action });
    setStatusReason("");
  }

  function handleStatusChange() {
    updateStatus.mutate(
      {
        id: statusDialog.id,
        status: statusDialog.action,
        reason: statusReason || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t(`toast.${statusDialog.action}`));
          setStatusDialog({ open: false, id: 0, action: "" });
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.actionFailed")),
      },
    );
  }

  function handleDelete(id: number) {
    setDeleteConfirmId(id);
  }

  function confirmDelete() {
    if (deleteConfirmId === null) return;
    deleteSuggestion.mutate(deleteConfirmId, {
      onSuccess: () => toast.success(t("toast.deleted")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.actionFailed")),
    });
    setDeleteConfirmId(null);
  }

  if (suggestionsLoading && settingsLoading) return <PageSkeleton stats={3} tabCount={2} content="table" />;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label={t("stats.totalSuggestions")}
          value={suggestionsLoading ? "..." : suggestionsData?.total ?? 0}
          icon={MessageSquare}
          accent="primary"
        />
        <StatsCard
          label={t("stats.systemStatus")}
          value={settingsLoading ? "..." : settings?.enabled ? t("common:labels.enabled") : t("common:labels.disabled")}
          icon={Power}
          accent={settings?.enabled ? "success" : "danger"}
        />
        <StatsCard
          label={t("common:labels.channel")}
          value={settingsLoading ? "..." : settings?.channelId ? t("stats.channel.configured") : t("stats.channel.notSet")}
          icon={Hash}
          accent={settings?.channelId ? "info" : "warning"}
        />
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList>
          <TabsTrigger value="suggestions">{t("tabs.suggestions")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
        </TabsList>

        {/* Suggestions List */}
        <TabsContent value="suggestions">
          <Card className="bg-surface-container p-6 glass-edge">
            {/* Filter */}
            <div className="mb-4 flex items-center gap-3">
              <Label>{t("filter.filterByStatus")}:</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filter.all")}</SelectItem>
                  <SelectItem value="pending">{t("filter.pending")}</SelectItem>
                  <SelectItem value="approved">{t("filter.approved")}</SelectItem>
                  <SelectItem value="denied">{t("filter.rejected")}</SelectItem>
                  <SelectItem value="implemented">{t("filter.implemented")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {suggestionsLoading ? (
              <TableSkeleton columns={6} />
            ) : suggestionsData && suggestionsData.suggestions.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("table.id")}</TableHead>
                        <TableHead>{t("table.content")}</TableHead>
                        <TableHead className="w-24">{t("table.status")}</TableHead>
                        <TableHead className="w-20">{t("table.votes")}</TableHead>
                        <TableHead className="w-28">{t("table.date")}</TableHead>
                        <TableHead className="w-32">{t("common:labels.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestionsData.suggestions.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs font-bold">#{s.id}</TableCell>
                          <TableCell>
                            <p className="max-w-md truncate text-sm">{s.content}</p>
                            <p className="mt-0.5 font-mono text-xs text-text-muted">
                              by {s.userId}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE_VARIANT[s.status] ?? "outline"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-success">+{s.upvotes}</span>
                            {" / "}
                            <span className="text-danger">-{s.downvotes}</span>
                          </TableCell>
                          <TableCell className="text-xs text-text-muted">
                            {formatDate(s.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {s.status === "pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openStatusDialog(s.id, "approved")}
                                    title={t("actions.approve")}
                                  >
                                    <Icon name="check_circle" size={16} className="text-success" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openStatusDialog(s.id, "denied")}
                                    title={t("actions.reject")}
                                  >
                                    <Icon name="cancel" size={16} className="text-danger" />
                                  </Button>
                                </>
                              )}
                              {(s.status === "approved" || s.status === "pending") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openStatusDialog(s.id, "implemented")}
                                  title={t("actions.implement")}
                                >
                                  <Icon name="task_alt" size={16} className="text-accent" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(s.id)}
                                disabled={deleteSuggestion.isPending}
                                title={t("actions.delete")}
                              >
                                <Icon name="delete" size={16} className="text-danger" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      {t("pagination.page", { page, total: totalPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        {t("pagination.previous")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        {t("pagination.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">{t("empty")}</p>
            )}
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("tabs.settings")}</h3>

            {settingsLoading ? (
              <FormSkeleton />
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("common:actions.enable")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.channelDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) => handleToggleSetting("enabled", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t("settings.channel")}</Label>
                  <DiscordSelect
                    guildId={guildId}
                    type="text"
                    value={settings.channelId ?? null}
                    onValueChange={(v) => handleChannelSetting("channelId", v)}
                    allowNone
                    placeholder={t("settings.channel")}
                  />
                  <p className="text-xs text-text-muted">
                    {t("settings.channelDesc")}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t("common:labels.channel")} ({t("common:labels.optional")})</Label>
                  <DiscordSelect
                    guildId={guildId}
                    type="text"
                    value={settings.reviewChannelId ?? null}
                    onValueChange={(v) => handleChannelSetting("reviewChannelId", v)}
                    allowNone
                    placeholder={t("common:labels.channel")}
                  />
                  <p className="text-xs text-text-muted">
                    {t("settings.channelDesc")}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.dmOnStatusChange")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.dmOnStatusChangeDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.dmOnStatusChange}
                    onCheckedChange={(checked) => handleToggleSetting("dmOnStatusChange", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.autoThread")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.autoThreadDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoThread}
                    onCheckedChange={(checked) => handleToggleSetting("autoThread", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.anonymousMode")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.anonymousModeDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.anonymousMode}
                    onCheckedChange={(checked) => handleToggleSetting("anonymousMode", checked)}
                  />
                </div>
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Change Dialog */}
      <Dialog
        open={statusDialog.open}
        onOpenChange={(open) => {
          if (!open) setStatusDialog({ open: false, id: 0, action: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusDialog.action === "approved" && t("actions.approve")}
              {statusDialog.action === "denied" && t("actions.reject")}
              {statusDialog.action === "implemented" && t("actions.implement")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {t("table.id")} #{statusDialog.id} — <strong>{statusDialog.action}</strong>
            </p>
            <div>
              <Label htmlFor="status-reason">{t("common:labels.reason")} ({t("common:labels.optional")})</Label>
              <Textarea
                id="status-reason"
                placeholder={t("common:labels.reason")}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialog({ open: false, id: 0, action: "" })}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={updateStatus.isPending}
            >
              {t("common:actions.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Suggestion Confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title={t("actions.delete")}
        description={t("common:actions.confirmDelete", { defaultValue: "Are you sure you want to delete this suggestion? This action cannot be undone." })}
        confirmLabel={t("common:actions.delete", { defaultValue: "Delete" })}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
