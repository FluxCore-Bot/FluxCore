import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useScheduledMessages,
  useCreateScheduledMessage,
  useUpdateScheduledMessage,
  useDeleteScheduledMessage,
  useTestScheduledMessage,
  useCronPreview,
} from "../../../lib/hooks/useScheduledMessages";
import { useChannels } from "../../../lib/hooks/useChannels";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Icon } from "../../../components/Icon";
import type { ScheduledMessageContent } from "../../../lib/schemas";
import { StatsCard } from "../../../components/StatsCard";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface MessageFormState {
  name: string;
  channelId: string;
  cronExpr: string;
  timezone: string;
  enabled: boolean;
  messageType: "text" | "embed";
  textContent: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  embedFooter: string;
  embedThumbnail: string;
  embedImage: string;
}

const emptyForm: MessageFormState = {
  name: "",
  channelId: "",
  cronExpr: "0 9 * * *",
  timezone: "UTC",
  enabled: true,
  messageType: "text",
  textContent: "",
  embedTitle: "",
  embedDescription: "",
  embedColor: "#a3a6ff",
  embedFooter: "",
  embedThumbnail: "",
  embedImage: "",
};

function formToContent(form: MessageFormState): ScheduledMessageContent {
  if (form.messageType === "embed") {
    return {
      type: "embed",
      embed: {
        title: form.embedTitle || undefined,
        description: form.embedDescription || undefined,
        color: form.embedColor ? parseInt(form.embedColor.replace("#", ""), 16) : undefined,
        footer: form.embedFooter || undefined,
        thumbnail: form.embedThumbnail || undefined,
        image: form.embedImage || undefined,
      },
    };
  }
  return { type: "text", content: form.textContent };
}

export function ScheduledMessagesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("scheduled");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MessageFormState>(emptyForm);

  const CRON_PRESETS = useMemo<Record<string, string>>(
    () => ({
      [t("cronPresets.everyHour")]: "0 * * * *",
      [t("cronPresets.every6Hours")]: "0 */6 * * *",
      [t("cronPresets.daily9am")]: "0 9 * * *",
      [t("cronPresets.dailyMidnight")]: "0 0 * * *",
      [t("cronPresets.weeklyMonday")]: "0 9 * * 1",
      [t("cronPresets.monthly1st")]: "0 9 1 * *",
    }),
    [t],
  );

  const { data, isLoading } = useScheduledMessages(guildId, { page, limit: 10 });
  const { data: channels } = useChannels(guildId);
  const createMsg = useCreateScheduledMessage(guildId);
  const updateMsg = useUpdateScheduledMessage(guildId);
  const deleteMsg = useDeleteScheduledMessage(guildId);
  const testMsg = useTestScheduledMessage(guildId);
  const { data: cronPreview } = useCronPreview(guildId, form.cronExpr, form.timezone);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;
  const textChannels = channels?.filter((c) => c.type === 0 || c.type === 5) ?? [];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return t("never");
    return new Date(dateStr).toLocaleString();
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(msg: {
    id: number;
    name: string;
    channelId: string;
    cronExpr: string;
    timezone: string;
    enabled: boolean;
    message: ScheduledMessageContent;
  }) {
    setEditingId(msg.id);
    setForm({
      name: msg.name,
      channelId: msg.channelId,
      cronExpr: msg.cronExpr,
      timezone: msg.timezone,
      enabled: msg.enabled,
      messageType: msg.message.type,
      textContent: msg.message.content ?? "",
      embedTitle: msg.message.embed?.title ?? "",
      embedDescription: msg.message.embed?.description ?? "",
      embedColor: msg.message.embed?.color
        ? `#${msg.message.embed.color.toString(16).padStart(6, "0")}`
        : "#a3a6ff",
      embedFooter: msg.message.embed?.footer ?? "",
      embedThumbnail: msg.message.embed?.thumbnail ?? "",
      embedImage: msg.message.embed?.image ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }
    if (!form.channelId) {
      toast.error(t("validation.channelRequired"));
      return;
    }

    const content = formToContent(form);

    if (editingId !== null) {
      updateMsg.mutate(
        {
          id: editingId,
          channelId: form.channelId,
          name: form.name.trim(),
          message: content,
          cronExpr: form.cronExpr,
          timezone: form.timezone,
          enabled: form.enabled,
        },
        {
          onSuccess: () => {
            toast.success(t("toast.updated"));
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : t("toast.updateFailed")),
        },
      );
    } else {
      createMsg.mutate(
        {
          channelId: form.channelId,
          name: form.name.trim(),
          message: content,
          cronExpr: form.cronExpr,
          timezone: form.timezone,
          enabled: form.enabled,
        },
        {
          onSuccess: () => {
            toast.success(t("toast.created"));
            setDialogOpen(false);
          },
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : t("toast.createFailed")),
        },
      );
    }
  }

  function handleToggleEnabled(id: number, enabled: boolean) {
    updateMsg.mutate(
      { id, enabled },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.updateFailed")),
      },
    );
  }

  function handleDelete(id: number) {
    deleteMsg.mutate(id, {
      onSuccess: () => toast.success(t("toast.deleted")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.deleteFailed")),
    });
  }

  function handleTestSend(id: number) {
    testMsg.mutate(id, {
      onSuccess: () => toast.success(t("toast.testSent")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.testFailed")),
    });
  }

  function updateForm(updates: Partial<MessageFormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={openCreate}>
            <Icon name="add" size={16} className="me-2" />
            {t("actions.newMessage")}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label={t("stats.totalMessages")}
          value={isLoading ? "..." : data?.total ?? 0}
        />
        <StatsCard
          label={t("stats.active")}
          value={isLoading ? "..." : data?.messages.filter((m) => m.enabled).length ?? 0}
          valueClassName="text-success"
        />
        <StatsCard
          label={t("stats.inactive")}
          value={isLoading ? "..." : data?.messages.filter((m) => !m.enabled).length ?? 0}
        />
      </div>

      {/* Message List */}
      <Card className="bg-surface p-6">
        {isLoading ? (
          <p className="text-text-muted">{t("common:loading")}</p>
        ) : data && data.messages.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.channel")}</TableHead>
                  <TableHead>{t("table.schedule")}</TableHead>
                  <TableHead>{t("table.nextRun")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium">{msg.name}</TableCell>
                    <TableCell className="font-mono text-xs">{msg.channelId}</TableCell>
                    <TableCell>
                      <code className="rounded bg-surface-high px-2 py-0.5 font-mono text-xs">
                        {msg.cronExpr}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-text-muted">
                      {formatDate(msg.nextRunAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={msg.enabled}
                          onCheckedChange={(checked) =>
                            handleToggleEnabled(msg.id, checked)
                          }
                        />
                        <Badge variant={msg.enabled ? "default" : "secondary"}>
                          {msg.enabled ? t("stats.active") : t("stats.inactive")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestSend(msg.id)}
                          title={t("actions.testSend")}
                        >
                          <Icon name="play_arrow" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(msg)}
                          title={t("actions.edit")}
                        >
                          <Icon name="edit" size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(msg.id)}
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
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Icon name="schedule" size={48} className="text-text-muted" />
            <div>
              <p className="font-medium text-text">{t("empty.title")}</p>
              <p className="mt-1 text-sm text-text-muted">
                {t("empty.description")}
              </p>
            </div>
            <Button onClick={openCreate}>
              <Icon name="add" size={16} className="me-2" />
              {t("empty.createButton")}
            </Button>
          </div>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId !== null ? t("dialog.editTitle") : t("dialog.createTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Name */}
            <div>
              <Label htmlFor="msg-name">{t("form.name")}</Label>
              <Input
                id="msg-name"
                placeholder={t("form.name")}
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                maxLength={100}
              />
            </div>

            {/* Channel */}
            <div>
              <Label>{t("form.channel")}</Label>
              <Select value={form.channelId} onValueChange={(v) => updateForm({ channelId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.channel")} />
                </SelectTrigger>
                <SelectContent>
                  {textChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      #{ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("form.schedulePreset")}</Label>
                <Select
                  value={
                    Object.entries(CRON_PRESETS).find(
                      ([, v]) => v === form.cronExpr,
                    )?.[0] ?? "custom"
                  }
                  onValueChange={(v) => {
                    if (v !== "custom" && CRON_PRESETS[v]) {
                      updateForm({ cronExpr: CRON_PRESETS[v] });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CRON_PRESETS).map((label) => (
                      <SelectItem key={label} value={label}>
                        {label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("cronPresets.custom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cron-expr">{t("form.cronExpression")}</Label>
                <Input
                  id="cron-expr"
                  placeholder="0 9 * * *"
                  value={form.cronExpr}
                  onChange={(e) => updateForm({ cronExpr: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <Label>{t("form.timezone")}</Label>
              <Select value={form.timezone} onValueChange={(v) => updateForm({ timezone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Next run preview */}
            {cronPreview && cronPreview.nextRuns.length > 0 && (
              <div className="rounded-md border border-border bg-surface-high p-3">
                <p className="mb-2 text-xs font-semibold text-text-muted">{t("cronPreview.nextRuns")}:</p>
                <ul className="space-y-1">
                  {cronPreview.nextRuns.slice(0, 3).map((run, i) => (
                    <li key={i} className="font-mono text-xs text-text">
                      {new Date(run).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Message Content */}
            <Tabs
              value={form.messageType}
              onValueChange={(v) => updateForm({ messageType: v as "text" | "embed" })}
            >
              <TabsList>
                <TabsTrigger value="text">{t("form.text")}</TabsTrigger>
                <TabsTrigger value="embed">{t("form.embed")}</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <div>
                  <Label htmlFor="msg-content">{t("form.messageContent")}</Label>
                  <Textarea
                    id="msg-content"
                    placeholder={t("form.messageContent")}
                    value={form.textContent}
                    onChange={(e) => updateForm({ textContent: e.target.value })}
                    maxLength={2000}
                    rows={5}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {t("characters", { count: form.textContent.length })}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="embed" className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="embed-title">{t("embed.title")}</Label>
                  <Input
                    id="embed-title"
                    placeholder={t("embed.title")}
                    value={form.embedTitle}
                    onChange={(e) => updateForm({ embedTitle: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="embed-description">{t("embed.description")}</Label>
                  <Textarea
                    id="embed-description"
                    placeholder={t("embed.description")}
                    value={form.embedDescription}
                    onChange={(e) => updateForm({ embedDescription: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="embed-color">{t("embed.color")}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="embed-color"
                        type="color"
                        value={form.embedColor}
                        onChange={(e) => updateForm({ embedColor: e.target.value })}
                        className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                      />
                      <Input
                        value={form.embedColor}
                        onChange={(e) => updateForm({ embedColor: e.target.value })}
                        className="font-mono"
                        placeholder="#a3a6ff"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="embed-footer">{t("embed.footer")}</Label>
                    <Input
                      id="embed-footer"
                      placeholder={t("embed.footer")}
                      value={form.embedFooter}
                      onChange={(e) => updateForm({ embedFooter: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="embed-thumbnail">{t("embed.thumbnail")}</Label>
                    <Input
                      id="embed-thumbnail"
                      placeholder="https://..."
                      value={form.embedThumbnail}
                      onChange={(e) => updateForm({ embedThumbnail: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="embed-image">{t("embed.image")}</Label>
                    <Input
                      id="embed-image"
                      placeholder="https://..."
                      value={form.embedImage}
                      onChange={(e) => updateForm({ embedImage: e.target.value })}
                    />
                  </div>
                </div>

                {/* Embed Preview */}
                {(form.embedTitle || form.embedDescription) && (
                  <div
                    className="rounded-md border-s-4 bg-surface-high p-4"
                    style={{
                      borderInlineStartColor: form.embedColor || "#a3a6ff",
                    }}
                  >
                    {form.embedTitle && (
                      <p className="mb-1 font-semibold text-text">{form.embedTitle}</p>
                    )}
                    {form.embedDescription && (
                      <p className="text-sm text-text-muted">{form.embedDescription}</p>
                    )}
                    {form.embedFooter && (
                      <p className="mt-2 text-xs text-text-muted">{form.embedFooter}</p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t("form.enabled")}</p>
                <p className="text-sm text-text-muted">
                  {t("form.enabledDesc")}
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => updateForm({ enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMsg.isPending || updateMsg.isPending}
            >
              {editingId !== null ? t("actions.save") : t("actions.newMessage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
