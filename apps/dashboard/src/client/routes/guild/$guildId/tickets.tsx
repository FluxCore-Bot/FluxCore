import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useTickets,
  useCloseTicket,
  useTicketPanels,
  useCreateTicketPanel,
  useDeleteTicketPanel,
  useSendTicketPanel,
  useTicketSettings,
  useUpdateTicketSettings,
} from "../../../lib/hooks/useTickets";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
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
  const { t } = useTranslation("tickets");
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
      onSuccess: () => toast.success(t("toast.ticketClosed")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.ticketCloseFailed")),
    });
  }

  function handleCreatePanel() {
    if (!newPanelName.trim() || !newPanelChannel.trim()) {
      toast.error(t("toast.panelCreateFailed"));
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
          toast.success(t("toast.panelCreated"));
          setNewPanelName("");
          setNewPanelChannel("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.panelCreateFailed")),
      },
    );
  }

  function handleDeletePanel(panelId: number) {
    deletePanel.mutate(panelId, {
      onSuccess: () => toast.success(t("toast.ticketDeleted")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.ticketDeleteFailed")),
    });
  }

  function handleSendPanel(panelId: number) {
    sendPanel.mutate(panelId, {
      onSuccess: () => toast.success(t("toast.panelDeployed")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.panelDeployFailed")),
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
        onSuccess: () => toast.success(t("toast.settingsSaved")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingsFailed")),
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
          toast.error(err instanceof ApiError ? err.message : t("toast.settingsFailed")),
      },
    );
  }

  function handleNamingFormatChange(value: string) {
    updateSettings.mutate(
      { namingFormat: value },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.settingsFailed")),
      },
    );
  }

  // Initialize settings inputs
  const staffRolesValue = staffRolesInput || (settings?.staffRoleIds ?? []).join(", ");
  const transcriptChannelValue = transcriptChannelInput || settings?.transcriptChannelId || "";

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.totalTickets")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : ticketData?.total ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.open")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : openCount}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.claimed")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {ticketsLoading ? "..." : claimedCount}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.panels")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {panelsLoading ? "..." : panels?.length ?? 0}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">{t("tabs.activeTickets")}</TabsTrigger>
          <TabsTrigger value="panels">{t("tabs.panelBuilder")}</TabsTrigger>
          <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>
        </TabsList>

        {/* Active Tickets */}
        <TabsContent value="tickets">
          <Card className="bg-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <Label>{t("common:actions.filter")}:</Label>
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
                    {s ? t(`statuses.${s}`) : t("common:labels.all")}
                  </Button>
                ))}
              </div>
            </div>

            {ticketsLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : ticketData && ticketData.tickets.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>{t("table.user")}</TableHead>
                      <TableHead>{t("table.subject")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead>{t("table.assignee")}</TableHead>
                      <TableHead>{t("table.created")}</TableHead>
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
                              className="ms-1 text-primary hover:underline"
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
                        {t("common:actions.back")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        {t("common:actions.next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-text-muted">{t("empty.tickets")}</p>
            )}
          </Card>
        </TabsContent>

        {/* Panel Builder */}
        <TabsContent value="panels">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">{t("tabs.panelBuilder")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("empty.panels")}
            </p>

            {panelsLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : panels && panels.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common:labels.name")}</TableHead>
                    <TableHead>{t("common:labels.channel")}</TableHead>
                    <TableHead>{t("panelBuilder.category")}</TableHead>
                    <TableHead>{t("common:labels.status")}</TableHead>
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
                          <Badge key={c.name} variant="secondary" className="me-1">
                            {c.emoji ? `${c.emoji} ` : ""}{c.label}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        {panel.messageId ? (
                          <Badge variant="default">{t("panelBuilder.deploy")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("common:labels.default")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendPanel(panel.id)}
                          disabled={sendPanel.isPending}
                          title={t("panelBuilder.deploy")}
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
              <p className="mb-4 text-text-muted">{t("empty.panels")}</p>
            )}

            <Separator className="my-6" />

            <h4 className="mb-3 text-sm font-semibold">{t("panelBuilder.create")}</h4>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div>
                <Label htmlFor="panel-name">{t("panelBuilder.title")}</Label>
                <Input
                  id="panel-name"
                  placeholder={t("panelBuilder.title")}
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <Label htmlFor="panel-channel">{t("panelBuilder.channel")}</Label>
                <Input
                  id="panel-channel"
                  placeholder={t("panelBuilder.channel")}
                  value={newPanelChannel}
                  onChange={(e) => setNewPanelChannel(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={handleCreatePanel} disabled={createPanel.isPending}>
                {t("panelBuilder.create")}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">{t("tabs.settings")}</h3>

            {settingsLoading ? (
              <p className="text-text-muted">{t("common:actions.loading")}</p>
            ) : settings ? (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="staff-roles">{t("common:labels.role")}</Label>
                  <Input
                    id="staff-roles"
                    placeholder="e.g. 123456789, 987654321"
                    value={staffRolesValue}
                    onChange={(e) => setStaffRolesInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {t("settings.transcriptChannelDesc")}
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="transcript-channel">{t("settings.transcriptChannel")}</Label>
                  <Input
                    id="transcript-channel"
                    placeholder="e.g. 123456789"
                    value={transcriptChannelValue}
                    onChange={(e) => setTranscriptChannelInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {t("settings.transcriptChannelDesc")}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.maxTicketsPerUser")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.maxTicketsPerUserDesc")}
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
                    <p className="font-medium">{t("settings.closeConfirmation")}</p>
                    <p className="text-sm text-text-muted">
                      {t("settings.closeConfirmationDesc")}
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
                  <Label htmlFor="naming-format">{t("common:labels.name")}</Label>
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
                  {t("common:actions.save")}
                </Button>
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
