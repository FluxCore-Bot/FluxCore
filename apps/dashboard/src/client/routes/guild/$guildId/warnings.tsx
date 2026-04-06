import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../lib/client";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { PageHeader } from "../../../components/PageHeader";
import {
  useWarnings,
  useDeleteWarning,
  useClearUserWarnings,
  useWarnPunishments,
  useAddPunishment,
  useRemovePunishment,
  useWarnSettings,
  useUpdateWarnSettings,
} from "../../../lib/hooks/useWarnings";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
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
import { Separator } from "../../../components/ui/separator";
import { Icon } from "../../../components/Icon";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { StatsCard } from "../../../components/StatsCard";

export function WarningsPage() {
  const { t } = useTranslation("warnings");
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const [userFilter, setUserFilter] = useState("");
  const [page, setPage] = useState(1);

  // Warnings data
  const { data: warningsData, isLoading: warningsLoading } = useWarnings(guildId, {
    userId: userFilter || undefined,
    page,
    limit: 10,
  });
  const deleteWarning = useDeleteWarning(guildId);
  const clearUserWarnings = useClearUserWarnings(guildId);

  // Punishments data
  const { data: punishments, isLoading: punishmentsLoading } = useWarnPunishments(guildId);
  const addPunishment = useAddPunishment(guildId);
  const removePunishment = useRemovePunishment(guildId);

  // Settings data
  const { data: settings, isLoading: settingsLoading } = useWarnSettings(guildId);
  const updateSettings = useUpdateWarnSettings(guildId);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [removePunishmentConfirmId, setRemovePunishmentConfirmId] = useState<number | null>(null);

  // Punishment form state
  const [newThreshold, setNewThreshold] = useState("");
  const [newAction, setNewAction] = useState("timeout");
  const [newDuration, setNewDuration] = useState("");

  const totalPages = warningsData ? Math.max(1, Math.ceil(warningsData.total / 10)) : 1;

  function handleDeleteWarning(id: number) {
    setDeleteConfirmId(id);
  }

  function confirmDeleteWarning() {
    if (deleteConfirmId === null) return;
    deleteWarning.mutate(deleteConfirmId, {
      onSuccess: () => toast.success(t("toast.warningRemoved")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.warningsFailed")),
    });
    setDeleteConfirmId(null);
  }

  function handleClearUserWarnings() {
    if (!userFilter) {
      toast.error(t("toast.enterUserId"));
      return;
    }
    clearUserWarnings.mutate(userFilter, {
      onSuccess: () => {
        toast.success(t("toast.allCleared"));
        setUserFilter("");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.clearFailed")),
    });
  }

  function handleAddPunishment() {
    const threshold = parseInt(newThreshold, 10);
    if (!Number.isFinite(threshold) || threshold < 1) {
      toast.error(t("toast.thresholdInvalid"));
      return;
    }
    const duration = newAction === "timeout" && newDuration
      ? parseInt(newDuration, 10)
      : undefined;

    addPunishment.mutate(
      { threshold, action: newAction, duration },
      {
        onSuccess: () => {
          toast.success(t("toast.thresholdAdded"));
          setNewThreshold("");
          setNewDuration("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.thresholdFailed")),
      },
    );
  }

  function handleRemovePunishment(id: number) {
    setRemovePunishmentConfirmId(id);
  }

  function confirmRemovePunishment() {
    if (removePunishmentConfirmId === null) return;
    removePunishment.mutate(removePunishmentConfirmId, {
      onSuccess: () => toast.success(t("toast.thresholdRemoved")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.removeFailed")),
    });
    setRemovePunishmentConfirmId(null);
  }

  function handleToggleSetting(key: "dmOnWarn" | "reasonRequired", value: boolean) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingFailed")),
      },
    );
  }

  function handleMaxWarningsChange(value: string) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num < 0) return;
    updateSettings.mutate(
      { maxWarnings: num },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingFailed")),
      },
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label={t("stats.totalWarnings")}
          value={warningsLoading ? "..." : warningsData?.total ?? 0}
        />
        <StatsCard
          label={t("stats.escalationRules")}
          value={punishmentsLoading ? "..." : punishments?.length ?? 0}
        />
        <StatsCard
          label={t("stats.dmOnWarn")}
          value={settingsLoading ? "..." : settings?.dmOnWarn ? t("common:labels.enabled") : t("common:labels.disabled")}
        />
      </div>

      <Tabs defaultValue="warnings">
        <TabsList>
          <TabsTrigger value="warnings">{t("tabs.warnings")}</TabsTrigger>
          <TabsTrigger value="escalation">{t("tabs.escalation")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
        </TabsList>

        {/* Warnings Table */}
        <TabsContent value="warnings">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" strokeWidth={1.5} />
                  <Input
                    placeholder={t("filter.userPlaceholder")}
                    value={userFilter}
                    onChange={(e) => {
                      setUserFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-64 ps-9"
                  />
                </div>
                {userFilter && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearUserWarnings}
                    disabled={clearUserWarnings.isPending}
                  >
                    {t("filter.clearAll")}
                  </Button>
                )}
              </div>
            </div>

            {warningsLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-64 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-high" />
              </div>
            ) : warningsData && warningsData.warnings.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("table.id")}</TableHead>
                        <TableHead>{t("table.user")}</TableHead>
                        <TableHead>{t("table.moderator")}</TableHead>
                        <TableHead>{t("table.reason")}</TableHead>
                        <TableHead>{t("table.date")}</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warningsData.warnings.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-mono text-xs">#{w.id}</TableCell>
                          <TableCell className="font-mono text-xs">{w.userId}</TableCell>
                          <TableCell className="font-mono text-xs">{w.moderatorId}</TableCell>
                          <TableCell className="max-w-xs truncate">{w.reason}</TableCell>
                          <TableCell className="text-xs text-text-muted">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteWarning(w.id)}
                              disabled={deleteWarning.isPending}
                            >
                              <Icon name="delete" size={16} className="text-danger" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      {t("pagination.page", { page, total: totalPages, count: warningsData.total })}
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
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <Icon name="warning" size={48} className="text-text-muted" />
                <div>
                  <p className="font-medium text-text">{t("noWarnings")}</p>
                  <p className="mt-1 text-sm text-text-muted">{t("noWarningsDesc", { defaultValue: "No warnings have been issued yet" })}</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Escalation Config */}
        <TabsContent value="escalation">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("escalation.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("escalation.description")}
            </p>

            {punishmentsLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-64 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-high" />
              </div>
            ) : punishments && punishments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("escalation.threshold")}</TableHead>
                      <TableHead>{t("escalation.action")}</TableHead>
                      <TableHead>{t("escalation.duration")}</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {punishments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{t("escalation.warnings", { count: p.threshold })}</TableCell>
                        <TableCell className="capitalize">{p.action}</TableCell>
                        <TableCell>
                          {p.action === "timeout" && p.duration
                            ? t("escalation.min", { count: Math.floor(p.duration / 60) })
                            : "\u2014"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePunishment(p.id)}
                            disabled={removePunishment.isPending}
                          >
                            <Icon name="delete" size={16} className="text-danger" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="mb-4 text-text-muted">{t("escalation.noRules")}</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 font-label text-sm font-semibold">{t("escalation.addRule")}</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="threshold">{t("escalation.threshold")}</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  placeholder={t("escalation.thresholdPlaceholder")}
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label htmlFor="action">{t("escalation.action")}</Label>
                <Select value={newAction} onValueChange={setNewAction}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timeout">{t("escalation.timeout")}</SelectItem>
                    <SelectItem value="kick">{t("escalation.kick")}</SelectItem>
                    <SelectItem value="ban">{t("escalation.ban")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newAction === "timeout" && (
                <div>
                  <Label htmlFor="duration">{t("escalation.durationLabel")}</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    placeholder={t("escalation.durationPlaceholder")}
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
              <Button
                onClick={handleAddPunishment}
                disabled={addPunishment.isPending}
              >
                {t("escalation.addButton")}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("settings.title")}</h3>

            {settingsLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-64 animate-pulse rounded bg-surface-high" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-high" />
              </div>
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.dmOnWarn")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.dmOnWarnDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.dmOnWarn}
                    onCheckedChange={(checked) => handleToggleSetting("dmOnWarn", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.requireReason")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.requireReasonDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={settings.reasonRequired}
                    onCheckedChange={(checked) => handleToggleSetting("reasonRequired", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.maxWarnings")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.maxWarningsDesc")}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={settings.maxWarnings}
                    onChange={(e) => handleMaxWarningsChange(e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
      {/* Delete Warning Confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title={t("toast.warningRemoved")}
        description={t("common:actions.confirmDelete", { defaultValue: "Are you sure you want to delete this item? This action cannot be undone." })}
        confirmLabel={t("common:actions.delete", { defaultValue: "Delete" })}
        destructive
        onConfirm={confirmDeleteWarning}
      />

      {/* Remove Punishment Confirmation */}
      <ConfirmDialog
        open={removePunishmentConfirmId !== null}
        onOpenChange={(open) => { if (!open) setRemovePunishmentConfirmId(null); }}
        title={t("toast.thresholdRemoved")}
        description={t("common:actions.confirmDelete", { defaultValue: "Are you sure you want to remove this escalation rule? This action cannot be undone." })}
        confirmLabel={t("common:actions.delete", { defaultValue: "Remove" })}
        destructive
        onConfirm={confirmRemovePunishment}
      />
    </div>
  );
}
