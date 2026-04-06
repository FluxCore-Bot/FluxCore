import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import { StatsCard } from "../../../components/StatsCard";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { Icon } from "../../../components/Icon";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  useModCases,
  useDeleteModCase,
  useUpdateModCase,
  useModSettings,
  useUpdateModSettings,
} from "../../../lib/hooks/useModeration";
import { useChannels } from "../../../lib/hooks/useChannels";
import { ApiError } from "../../../lib/client";
import type { ModCase } from "../../../lib/schemas";

const ACTION_KEYS = ["ban", "tempban", "kick", "timeout", "softban", "warn", "note"] as const;

const ACTION_COLORS: Record<string, string> = {
  ban: "text-danger",
  tempban: "text-warning",
  kick: "text-warning",
  timeout: "text-warning",
  softban: "text-warning",
  warn: "text-warning",
  note: "text-text-muted",
};

export function ModerationPage() {
  const { t } = useTranslation("moderation");
  const { guildId } = useParams({ strict: false }) as { guildId: string };
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [editingCase, setEditingCase] = useState<ModCase | null>(null);
  const [editReason, setEditReason] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: casesData, isLoading: casesLoading } = useModCases(guildId, {
    page,
    action: actionFilter || undefined,
    userId: userFilter || undefined,
  });
  const { data: settings, isLoading: settingsLoading } = useModSettings(guildId);
  const { data: channels } = useChannels(guildId);
  const deleteMutation = useDeleteModCase(guildId);
  const updateMutation = useUpdateModCase(guildId);
  const settingsMutation = useUpdateModSettings(guildId);

  if (casesLoading || settingsLoading) {
    return <PageSkeleton />;
  }

  const cases = casesData?.cases ?? [];
  const total = casesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const activeTempbans = cases.filter(
    (c) => c.action === "tempban" && c.active,
  ).length;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent24h = cases.filter(
    (c) => new Date(c.createdAt) >= oneDayAgo,
  ).length;

  const textChannels = channels?.filter((c) => c.type === 0) ?? [];

  const handleDelete = (caseId: number) => {
    setDeleteConfirmId(caseId);
  };

  const handleEditStart = (modCase: ModCase) => {
    setEditingCase(modCase);
    setEditReason(modCase.reason ?? "");
  };

  const handleEditSave = () => {
    if (editingCase) {
      updateMutation.mutate(
        { caseId: editingCase.id, reason: editReason },
        {
          onSuccess: () => {
            setEditingCase(null);
            toast.success(t("toast.caseUpdated", { defaultValue: "Case updated" }));
          },
          onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : t("toast.updateFailed", { defaultValue: "Failed to update case" }));
          },
        },
      );
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label={t("stats.totalCases")} value={total} />
        <StatsCard
          label={t("stats.activeTempbans")}
          value={activeTempbans}
          accentColor="border-orange-400"
        />
        <StatsCard
          label={t("stats.last24h")}
          value={recent24h}
          accentColor="border-success"
        />
      </div>

      {/* Cases Table */}
      <div className="space-y-4">
        <h3 className="font-label text-lg font-semibold">{t("cases")}</h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.5} />
            <Input
              type="text"
              placeholder={t("filter.userPlaceholder")}
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="w-auto ps-9 sm:w-64"
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value === "all" ? "" : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("filter.allActions")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filter.allActions")}</SelectItem>
              {ACTION_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`actions.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border glass-edge">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.id")}</TableHead>
                <TableHead>{t("table.action")}</TableHead>
                <TableHead>{t("table.target")}</TableHead>
                <TableHead>{t("table.moderator")}</TableHead>
                <TableHead>{t("table.reason")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead>{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                      <Icon name="gavel" size={48} className="text-text-muted" />
                      <div>
                        <p className="font-medium text-text">{t("table.noCases")}</p>
                        <p className="mt-1 text-sm text-text-muted">{t("table.noCasesDesc", { defaultValue: "No moderation cases match your filters" })}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((modCase) => (
                  <TableRow key={modCase.id}>
                    <TableCell className="font-mono text-text-muted">#{modCase.id}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${ACTION_COLORS[modCase.action] ?? "text-text"}`}>
                        {t(`actions.${modCase.action}`, { defaultValue: modCase.action })}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{modCase.targetId}</TableCell>
                    <TableCell className="font-mono text-xs">{modCase.moderatorId}</TableCell>
                    <TableCell className="max-w-48 truncate text-text-muted">
                      {modCase.reason ?? t("table.noReason")}
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {new Date(modCase.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditStart(modCase)}
                          title={t("editReason")}
                        >
                          <Icon name="edit" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(modCase.id)}
                          className="hover:text-danger"
                          title={t("deleteCase")}
                        >
                          <Icon name="delete" size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {t("pagination.previous")}
            </Button>
            <span className="text-sm text-text-muted">
              {t("pagination.page", { page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t("pagination.next")}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Reason Dialog */}
      <Dialog open={!!editingCase} onOpenChange={(open) => !open && setEditingCase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("editDialog.title", { id: editingCase?.id })}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("editDialog.placeholder")}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingCase(null)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t("editDialog.saving") : t("common:actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title={t("deleteConfirm")}
        description={t("deleteCase")}
        confirmLabel={t("common:actions.delete", { defaultValue: "Delete" })}
        destructive
        onConfirm={() => {
          if (deleteConfirmId !== null) {
            deleteMutation.mutate(deleteConfirmId, {
              onSuccess: () => {
                toast.success(t("toast.caseDeleted", { defaultValue: "Case deleted" }));
              },
              onError: (err) => {
                toast.error(err instanceof ApiError ? err.message : t("toast.deleteFailed", { defaultValue: "Failed to delete case" }));
              },
            });
            setDeleteConfirmId(null);
          }
        }}
      />

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="font-label text-lg font-semibold">{t("settings.title")}</h3>
        <div className="rounded-lg bg-surface-container p-6 glass-edge">
          <div className="space-y-6">
            {/* DM on Punishment */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("settings.dmOnPunishment")}</p>
                <p className="text-sm text-text-muted">
                  {t("settings.dmOnPunishmentDesc")}
                </p>
              </div>
              <Switch
                checked={settings?.dmOnPunishment ?? false}
                onCheckedChange={(checked) =>
                  settingsMutation.mutate({ dmOnPunishment: checked })
                }
              />
            </div>

            {/* Mod Log Channel */}
            <div>
              <p className="mb-2 font-medium">{t("settings.modLogChannel")}</p>
              <p className="mb-3 text-sm text-text-muted">
                {t("settings.modLogChannelDesc")}
              </p>
              <Select
                value={settings?.modLogChannelId ?? "none"}
                onValueChange={(value) =>
                  settingsMutation.mutate({
                    modLogChannelId: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder={t("common:labels.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common:labels.none")}</SelectItem>
                  {textChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      #{ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
