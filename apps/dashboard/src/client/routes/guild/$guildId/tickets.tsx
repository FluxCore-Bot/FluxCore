import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useTickets,
  useCloseTicket,
  useTicketPanels,
  useCreateTicketPanel,
  useUpdateTicketPanel,
  useDeleteTicketPanel,
  useSendTicketPanel,
  useTicketSettings,
  useUpdateTicketSettings,
} from "../../../lib/hooks/useTickets";
import type { TicketCategoryItem } from "../../../lib/schemas";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Separator } from "../../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Icon } from "../../../components/Icon";

function statusColor(status: string) {
  switch (status) {
    case "open":
      return "default";
    case "claimed":
      return "secondary";
    case "closed":
      return "outline";
    default:
      return "default";
  }
}

export function TicketsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Tickets
  const { data: ticketData, isLoading: ticketsLoading } = useTickets(guildId, {
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const closeTicketMutation = useCloseTicket(guildId);

  // Panels
  const { data: panels, isLoading: panelsLoading } = useTicketPanels(guildId);
  const createPanel = useCreateTicketPanel(guildId);
  const deletePanel = useDeleteTicketPanel(guildId);
  const sendPanel = useSendTicketPanel(guildId);

  // Settings
  const { data: settings, isLoading: settingsLoading } = useTicketSettings(guildId);
  const updateSettings = useUpdateTicketSettings(guildId);

  // Panel form state
  const [newPanelName, setNewPanelName] = useState("");
  const [newPanelChannel, setNewPanelChannel] = useState("");

  // Settings form state
  const [staffRolesInput, setStaffRolesInput] = useState("");
  const [transcriptChannelInput, setTranscriptChannelInput] = useState("");

  const totalPages = ticketData ? Math.max(1, Math.ceil(ticketData.total / 20)) : 1;

  const openCount = ticketData?.tickets.filter((t) => t.status === "open").length ?? 0;
  const claimedCount = ticketData?.tickets.filter((t) => t.status === "claimed").length ?? 0;

  function handleCloseTicket(ticketId: number) {
    closeTicketMutation.mutate(ticketId, {
      onSuccess: () => toast.success("Ticket closed"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to close ticket"),
    });
  }

  function handleCreatePanel() {
    if (!newPanelName.trim() || !newPanelChannel.trim()) {
      toast.error("Panel name and channel ID are required");
      return;
    }
    createPanel.mutate(
      {
        channelId: newPanelChannel.trim(),
        name: newPanelName.trim(),
        categories: [{ name: "general", label: "Open Ticket" }],
      },
      {
        onSuccess: () => {
          toast.success("Panel created");
          setNewPanelName("");
          setNewPanelChannel("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to create panel"),
      },
    );
  }

  function handleDeletePanel(panelId: number) {
    deletePanel.mutate(panelId, {
      onSuccess: () => toast.success("Panel deleted"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete panel"),
    });
  }

  function handleSendPanel(panelId: number) {
    sendPanel.mutate(panelId, {
      onSuccess: () => toast.success("Panel send requested"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to send panel"),
    });
  }

  function handleSaveSettings() {
    const staffRoleIds = staffRolesInput
      ? staffRolesInput.split(",").map((s) => s.trim()).filter(Boolean)
      : settings?.staffRoleIds ?? [];
    const transcriptChannelId = transcriptChannelInput.trim() || settings?.transcriptChannelId || null;

    updateSettings.mutate(
      { staffRoleIds, transcriptChannelId },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to save settings"),
      },
    );
  }

  function handleNumberSetting(key: "maxOpenPerUser" | "autoCloseHours", value: string) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num < 0) return;
    updateSettings.mutate(
      { [key]: num },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  function handleNamingFormatChange(value: string) {
    updateSettings.mutate(
      { namingFormat: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to update setting"),
      },
    );
  }

  // Initialize settings inputs
  const staffRolesValue = staffRolesInput || (settings?.staffRoleIds ?? []).join(", ");
  const transcriptChannelValue = transcriptChannelInput || settings?.transcriptChannelId || "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ticket System"
        subtitle="Manage support tickets, panels, and settings."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Total Tickets</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : ticketData?.total ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Open</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : openCount}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Claimed</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : claimedCount}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Panels</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {panelsLoading ? "..." : panels?.length ?? 0}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Active Tickets</TabsTrigger>
          <TabsTrigger value="panels">Panel Builder</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Active Tickets */}
        <TabsContent value="tickets">
          <Card className="bg-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <Label>Filter by status:</Label>
              <div className="flex gap-2">
                {["", "open", "claimed", "closed"].map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                  >
                    {s || "All"}
                  </Button>
                ))}
              </div>
            </div>

            {ticketsLoading ? (
              <p className="text-text-muted">Loading tickets...</p>
            ) : ticketData && ticketData.tickets.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Claimed By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketData.tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-xs font-bold">
                          {ticket.id}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {ticket.userId}
                        </TableCell>
                        <TableCell>{ticket.categoryName || "--"}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(ticket.status)}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {ticket.claimedBy || "--"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {ticket.status !== "closed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCloseTicket(ticket.id)}
                              disabled={closeTicketMutation.isPending}
                            >
                              <Icon name="close" size={16} className="text-danger" />
                            </Button>
                          )}
                          {ticket.transcriptUrl && (
                            <a
                              href={ticket.transcriptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 text-primary hover:underline"
                            >
                              <Icon name="description" size={16} />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-text-muted">
                      Page {page} of {totalPages} ({ticketData.total} total)
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
              <p className="text-text-muted">No tickets found.</p>
            )}
          </Card>
        </TabsContent>

        {/* Panel Builder */}
        <TabsContent value="panels">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Ticket Panels</h3>
            <p className="mb-4 text-sm text-text-muted">
              Create panels that users click to open tickets. Each panel is posted as a message with buttons in a channel.
            </p>

            {panelsLoading ? (
              <p className="text-text-muted">Loading panels...</p>
            ) : panels && panels.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panels.map((panel) => (
                    <TableRow key={panel.id}>
                      <TableCell className="font-medium">{panel.name}</TableCell>
                      <TableCell className="font-mono text-xs">{panel.channelId}</TableCell>
                      <TableCell>
                        {panel.categories.map((c) => (
                          <Badge key={c.name} variant="secondary" className="mr-1">
                            {c.emoji ? `${c.emoji} ` : ""}{c.label}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        {panel.messageId ? (
                          <Badge variant="default">Sent</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendPanel(panel.id)}
                          disabled={sendPanel.isPending}
                          title="Send panel to channel"
                        >
                          <Icon name="send" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePanel(panel.id)}
                          disabled={deletePanel.isPending}
                        >
                          <Icon name="delete" size={16} className="text-danger" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="mb-4 text-text-muted">No panels configured.</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 text-sm font-semibold">Create Panel</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="panel-name">Panel Name</Label>
                <Input
                  id="panel-name"
                  placeholder="e.g. Support Tickets"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <Label htmlFor="panel-channel">Channel ID</Label>
                <Input
                  id="panel-channel"
                  placeholder="e.g. 123456789"
                  value={newPanelChannel}
                  onChange={(e) => setNewPanelChannel(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={handleCreatePanel} disabled={createPanel.isPending}>
                Create Panel
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Ticket Settings</h3>

            {settingsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : settings ? (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="staff-roles">Staff Role IDs (comma-separated)</Label>
                  <Input
                    id="staff-roles"
                    placeholder="e.g. 123456789, 987654321"
                    value={staffRolesValue}
                    onChange={(e) => setStaffRolesInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Roles that can see and manage tickets.
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="transcript-channel">Transcript Channel ID</Label>
                  <Input
                    id="transcript-channel"
                    placeholder="e.g. 123456789"
                    value={transcriptChannelValue}
                    onChange={(e) => setTranscriptChannelInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Channel where ticket transcripts are sent on close.
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Max Open Tickets Per User</p>
                    <p className="text-sm text-text-muted">
                      Limit how many tickets a user can have open.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={25}
                    value={settings.maxOpenPerUser}
                    onChange={(e) => handleNumberSetting("maxOpenPerUser", e.target.value)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-Close After (hours)</p>
                    <p className="text-sm text-text-muted">
                      Automatically close inactive tickets. 0 = disabled.
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={720}
                    value={settings.autoCloseHours}
                    onChange={(e) => handleNumberSetting("autoCloseHours", e.target.value)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div>
                  <Label htmlFor="naming-format">Channel Naming Format</Label>
                  <Input
                    id="naming-format"
                    value={settings.namingFormat}
                    onChange={(e) => handleNamingFormatChange(e.target.value)}
                    className="w-64"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Variables: {"{number}"} (zero-padded), {"{username}"}
                  </p>
                </div>

                <Separator />

                <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                  Save Settings
                </Button>
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
