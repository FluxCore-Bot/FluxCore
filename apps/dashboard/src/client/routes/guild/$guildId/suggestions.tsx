import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useSuggestions,
  useSuggestionSettings,
  useUpdateSuggestionSettings,
  useUpdateSuggestionStatus,
  useDeleteSuggestion,
} from "../../../lib/hooks/useSuggestions";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Textarea } from "../../../components/ui/textarea";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  denied: "destructive",
  implemented: "secondary",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SuggestionsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
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
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  function handleChannelSetting(key: "channelId" | "reviewChannelId", value: string) {
    const channelId = value.trim() || null;
    updateSettings.mutate(
      { [key]: channelId },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
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
          toast.success(`Suggestion #${statusDialog.id} ${statusDialog.action}`);
          setStatusDialog({ open: false, id: 0, action: "" });
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update status"),
      },
    );
  }

  function handleDelete(id: number) {
    deleteSuggestion.mutate(id, {
      onSuccess: () => toast.success(`Suggestion #${id} deleted`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete suggestion"),
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Suggestions"
        subtitle="Review and manage community suggestions. Configure channels, voting, and notification settings."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Total Suggestions</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {suggestionsLoading ? "..." : suggestionsData?.total ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">System Status</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {settingsLoading ? "..." : settings?.enabled ? "Enabled" : "Disabled"}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Channel</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {settingsLoading ? "..." : settings?.channelId ? "Configured" : "Not Set"}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Suggestions List */}
        <TabsContent value="suggestions">
          <Card className="bg-surface p-6">
            {/* Filter */}
            <div className="mb-4 flex items-center gap-3">
              <Label>Filter by status:</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {suggestionsLoading ? (
              <p className="text-text-muted">Loading suggestions...</p>
            ) : suggestionsData && suggestionsData.suggestions.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-20">Votes</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
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
                                  title="Approve"
                                >
                                  <Icon name="check_circle" size={16} className="text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openStatusDialog(s.id, "denied")}
                                  title="Deny"
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
                                title="Mark Implemented"
                              >
                                <Icon name="task_alt" size={16} className="text-accent" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(s.id)}
                              disabled={deleteSuggestion.isPending}
                              title="Delete"
                            >
                              <Icon name="delete" size={16} className="text-danger" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {page} of {totalPages} ({suggestionsData.total} total)
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
              <p className="text-text-muted">No suggestions found.</p>
            )}
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Suggestion Settings</h3>

            {settingsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : settings ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Suggestions</p>
                    <p className="text-sm text-text-muted">
                      Toggle the entire suggestions system on or off.
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) => handleToggleSetting("enabled", checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="suggestions-channel">Suggestions Channel ID</Label>
                  <Input
                    id="suggestions-channel"
                    placeholder="e.g. 123456789012345678"
                    defaultValue={settings.channelId ?? ""}
                    onBlur={(e) => handleChannelSetting("channelId", e.target.value)}
                  />
                  <p className="text-xs text-text-muted">
                    The channel where suggestion embeds will be posted.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="review-channel">Review Channel ID (Optional)</Label>
                  <Input
                    id="review-channel"
                    placeholder="e.g. 123456789012345678"
                    defaultValue={settings.reviewChannelId ?? ""}
                    onBlur={(e) => handleChannelSetting("reviewChannelId", e.target.value)}
                  />
                  <p className="text-xs text-text-muted">
                    Optional channel for mod review notifications.
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">DM on Status Change</p>
                    <p className="text-sm text-text-muted">
                      Send a DM to the suggestion author when status changes.
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
                    <p className="font-medium">Auto-Create Discussion Thread</p>
                    <p className="text-sm text-text-muted">
                      Automatically create a thread for each suggestion.
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
                    <p className="font-medium">Anonymous Mode</p>
                    <p className="text-sm text-text-muted">
                      Hide suggestion author names in the suggestions channel.
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
              {statusDialog.action === "approved" && "Approve Suggestion"}
              {statusDialog.action === "denied" && "Deny Suggestion"}
              {statusDialog.action === "implemented" && "Mark as Implemented"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Updating suggestion #{statusDialog.id} to <strong>{statusDialog.action}</strong>.
            </p>
            <div>
              <Label htmlFor="status-reason">Reason (optional)</Label>
              <Textarea
                id="status-reason"
                placeholder="Add a reason..."
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
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={updateStatus.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
