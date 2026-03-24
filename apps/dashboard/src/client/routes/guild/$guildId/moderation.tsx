import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { PageHeader } from "../../../components/PageHeader";
import { StatsCard } from "../../../components/StatsCard";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { Icon } from "../../../components/Icon";
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
          <input
            type="text"
            placeholder="Filter by User ID..."
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface-low px-3 py-1.5 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
          />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface-low px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-low text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Moderator</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No cases found.
                  </td>
                </tr>
              ) : (
                cases.map((modCase) => (
                  <tr key={modCase.id} className="hover:bg-surface-low/50">
                    <td className="px-4 py-3 font-mono text-text-muted">#{modCase.id}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${ACTION_COLORS[modCase.action] ?? "text-text"}`}>
                        {ACTION_LABELS[modCase.action] ?? modCase.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{modCase.targetId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{modCase.moderatorId}</td>
                    <td className="max-w-48 truncate px-4 py-3 text-text-muted">
                      {modCase.reason ?? "No reason"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(modCase.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditStart(modCase)}
                          className="rounded p-1 text-text-muted hover:bg-surface-high hover:text-accent"
                          title="Edit reason"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(modCase.id)}
                          className="rounded p-1 text-text-muted hover:bg-surface-high hover:text-red-400"
                          title="Delete case"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Edit Reason Modal */}
      {editingCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-bg p-6 shadow-xl">
            <h3 className="mb-4 font-label text-lg font-semibold">
              Edit Case #{editingCase.id} Reason
            </h3>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-md border border-border bg-surface-low px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
              placeholder="Enter new reason..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingCase(null)}
                className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-high"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={updateMutation.isPending}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button
                onClick={() =>
                  settingsMutation.mutate({
                    dmOnPunishment: !settings?.dmOnPunishment,
                  })
                }
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  settings?.dmOnPunishment ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    settings?.dmOnPunishment ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Mod Log Channel */}
            <div>
              <p className="mb-2 font-medium">Mod Log Channel</p>
              <p className="mb-3 text-sm text-text-muted">
                Channel where moderation actions are logged.
              </p>
              <select
                value={settings?.modLogChannelId ?? ""}
                onChange={(e) =>
                  settingsMutation.mutate({
                    modLogChannelId: e.target.value || null,
                  })
                }
                className="w-full rounded-md border border-border bg-surface-low px-3 py-2 text-sm text-text focus:border-accent focus:outline-none sm:w-64"
              >
                <option value="">None</option>
                {textChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
