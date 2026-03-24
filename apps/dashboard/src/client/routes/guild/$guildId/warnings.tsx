import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";

export function WarningsPage() {
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

  // Punishment form state
  const [newThreshold, setNewThreshold] = useState("");
  const [newAction, setNewAction] = useState("timeout");
  const [newDuration, setNewDuration] = useState("");

  const totalPages = warningsData ? Math.max(1, Math.ceil(warningsData.total / 10)) : 1;

  function handleDeleteWarning(id: number) {
    deleteWarning.mutate(id, {
      onSuccess: () => toast.success("Warning removed"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete warning"),
    });
  }

  function handleClearUserWarnings() {
    if (!userFilter) {
      toast.error("Enter a user ID to clear all warnings for that user");
      return;
    }
    clearUserWarnings.mutate(userFilter, {
      onSuccess: () => {
        toast.success("All warnings cleared for user");
        setUserFilter("");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to clear warnings"),
    });
  }

  function handleAddPunishment() {
    const threshold = parseInt(newThreshold, 10);
    if (!Number.isFinite(threshold) || threshold < 1) {
      toast.error("Threshold must be a positive number");
      return;
    }
    const duration = newAction === "timeout" && newDuration
      ? parseInt(newDuration, 10)
      : undefined;

    addPunishment.mutate(
      { threshold, action: newAction, duration },
      {
        onSuccess: () => {
          toast.success("Punishment threshold added");
          setNewThreshold("");
          setNewDuration("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to add punishment"),
      },
    );
  }

  function handleRemovePunishment(id: number) {
    removePunishment.mutate(id, {
      onSuccess: () => toast.success("Punishment removed"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to remove punishment"),
    });
  }

  function handleToggleSetting(key: "dmOnWarn" | "reasonRequired", value: boolean) {
    updateSettings.mutate(
      { [key]: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
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
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Warnings"
        subtitle="Track and manage member warnings with automatic escalation."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Total Warnings</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {warningsLoading ? "..." : warningsData?.total ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Escalation Rules</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {punishmentsLoading ? "..." : punishments?.length ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">DM on Warn</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {settingsLoading ? "..." : settings?.dmOnWarn ? "Enabled" : "Disabled"}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="warnings">
        <TabsList>
          <TabsTrigger value="warnings">Warning Log</TabsTrigger>
          <TabsTrigger value="escalation">Escalation</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Warnings Table */}
        <TabsContent value="warnings">
          <Card className="bg-surface p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filter by User ID..."
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-64"
                />
                {userFilter && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearUserWarnings}
                    disabled={clearUserWarnings.isPending}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {warningsLoading ? (
              <p className="text-text-muted">Loading warnings...</p>
            ) : warningsData && warningsData.warnings.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Moderator</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {page} of {totalPages} ({warningsData.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">No warnings found.</p>
            )}
          </Card>
        </TabsContent>

        {/* Escalation Config */}
        <TabsContent value="escalation">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Punishment Escalation</h3>
            <p className="mb-4 text-sm text-text-muted">
              Configure automatic actions when a user reaches a certain number of warnings.
            </p>

            {punishmentsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : punishments && punishments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {punishments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.threshold} warnings</TableCell>
                      <TableCell className="capitalize">{p.action}</TableCell>
                      <TableCell>
                        {p.action === "timeout" && p.duration
                          ? `${Math.floor(p.duration / 60)} min`
                          : "—"}
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
            ) : (
              <p className="mb-4 text-text-muted">No escalation rules configured.</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 text-sm font-semibold">Add Escalation Rule</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="threshold">Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  placeholder="e.g. 3"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label htmlFor="action">Action</Label>
                <Select value={newAction} onValueChange={setNewAction}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timeout">Timeout</SelectItem>
                    <SelectItem value="kick">Kick</SelectItem>
                    <SelectItem value="ban">Ban</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newAction === "timeout" && (
                <div>
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    placeholder="e.g. 3600"
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
                Add Rule
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Warning Settings</h3>

            {settingsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">DM on Warn</p>
                    <p className="text-sm text-text-muted">
                      Send a direct message to the user when they receive a warning.
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
                    <p className="font-medium">Require Reason</p>
                    <p className="text-sm text-text-muted">
                      Moderators must provide a reason when issuing a warning.
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
                    <p className="font-medium">Max Warnings</p>
                    <p className="text-sm text-text-muted">
                      Maximum warnings per user (0 = unlimited).
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
    </div>
  );
}
