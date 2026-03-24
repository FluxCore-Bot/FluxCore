import { useState } from "react";
import { useParams } from "@tanstack/react-router";
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
import type { ModCase } from "../../../lib/schemas";

const ACTION_LABELS: Record<string, string> = {
  ban: "Ban",
  tempban: "Tempban",
  kick: "Kick",
  timeout: "Timeout",
  softban: "Softban",
  warn: "Warn",
  note: "Note",
};

const ACTION_COLORS: Record<string, string> = {
  ban: "text-red-400",
  tempban: "text-orange-400",
  kick: "text-yellow-400",
  timeout: "text-amber-400",
  softban: "text-orange-300",
  warn: "text-yellow-300",
  note: "text-text-muted",
};

export function ModerationPage() {
  const { guildId } = useParams({ strict: false }) as { guildId: string };
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [editingCase, setEditingCase] = useState<ModCase | null>(null);
  const [editReason, setEditReason] = useState("");

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
    if (confirm("Are you sure you want to delete this case?")) {
      deleteMutation.mutate(caseId);
    }
  };

  const handleEditStart = (modCase: ModCase) => {
    setEditingCase(modCase);
    setEditReason(modCase.reason ?? "");
  };

  const handleEditSave = () => {
    if (editingCase) {
      updateMutation.mutate(
        { caseId: editingCase.id, reason: editReason },
        { onSuccess: () => setEditingCase(null) },
      );
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Moderation"
        subtitle="View and manage moderation cases, configure punishment settings."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label="Total Cases" value={total} />
        <StatsCard
          label="Active Tempbans"
          value={activeTempbans}
          accentColor="border-orange-400"
        />
        <StatsCard
          label="Last 24h"
          value={recent24h}
          accentColor="border-success"
        />
      </div>

      {/* Cases Table */}
      <div className="space-y-4">
        <h3 className="font-label text-lg font-semibold">Cases</h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            type="text"
            placeholder="Filter by User ID..."
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
            className="w-auto sm:w-64"
          />
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value === "all" ? "" : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Moderator</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-muted">
                    No cases found.
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((modCase) => (
                  <TableRow key={modCase.id}>
                    <TableCell className="font-mono text-text-muted">#{modCase.id}</TableCell>
                    <TableCell>
                      <span className={`font-medium ${ACTION_COLORS[modCase.action] ?? "text-text"}`}>
                        {ACTION_LABELS[modCase.action] ?? modCase.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{modCase.targetId}</TableCell>
                    <TableCell className="font-mono text-xs">{modCase.moderatorId}</TableCell>
                    <TableCell className="max-w-48 truncate text-text-muted">
                      {modCase.reason ?? "No reason"}
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
                          title="Edit reason"
                        >
                          <Icon name="edit" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(modCase.id)}
                          className="hover:text-red-400"
                          title="Delete case"
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
              Previous
            </Button>
            <span className="text-sm text-text-muted">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Edit Reason Dialog */}
      <Dialog open={!!editingCase} onOpenChange={(open) => !open && setEditingCase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Case #{editingCase?.id} Reason
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Enter new reason..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingCase(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="font-label text-lg font-semibold">Settings</h3>
        <div className="rounded-lg border border-border bg-surface-low p-6 glass-edge">
          <div className="space-y-6">
            {/* DM on Punishment */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">DM on Punishment</p>
                <p className="text-sm text-text-muted">
                  Send a DM to users when they are punished (ban, kick, timeout).
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
              <p className="mb-2 font-medium">Mod Log Channel</p>
              <p className="mb-3 text-sm text-text-muted">
                Channel where moderation actions are logged.
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
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
