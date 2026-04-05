import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useCustomCommands,
  useCreateCustomCommand,
  useUpdateCustomCommand,
  useDeleteCustomCommand,
  type CreateCustomCommandData,
} from "../../../lib/hooks/useCustomCommands";
import { useChannels } from "../../../lib/hooks/useChannels";
import { useRoles } from "../../../lib/hooks/useRoles";
import type {
  CustomCommandItem,
  CustomCommandResponse,
  CustomCommandAction,
} from "../../../lib/schemas";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Separator } from "../../../components/ui/separator";
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
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Icon } from "../../../components/Icon";

function emptyAction(): CustomCommandAction {
  return { type: "addRole", roleId: "" };
}

export function CommandsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("commands");

  const { data: commands, isLoading } = useCustomCommands(guildId);
  const createCommand = useCreateCustomCommand(guildId);
  const updateCommand = useUpdateCustomCommand(guildId);
  const deleteCommand = useDeleteCustomCommand(guildId);
  const { data: channels } = useChannels(guildId);
  const { data: roles } = useRoles(guildId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommandItem | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTriggerType, setFormTriggerType] = useState<
    "command" | "keyword" | "startsWith" | "regex"
  >("command");
  const [formResponseType, setFormResponseType] = useState<"text" | "embed">("text");
  const [formContent, setFormContent] = useState("");
  const [formEmbedTitle, setFormEmbedTitle] = useState("");
  const [formEmbedDescription, setFormEmbedDescription] = useState("");
  const [formEmbedColor, setFormEmbedColor] = useState("#5865f2");
  const [formEmbedFooter, setFormEmbedFooter] = useState("");
  const [formActions, setFormActions] = useState<CustomCommandAction[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formCooldown, setFormCooldown] = useState("0");
  const [formAllowedRoles, setFormAllowedRoles] = useState<string[]>([]);
  const [formAllowedChannels, setFormAllowedChannels] = useState<string[]>([]);
  const [formDeletesTrigger, setFormDeletesTrigger] = useState(false);
  const [formDmResponse, setFormDmResponse] = useState(false);

  const TRIGGER_TYPE_LABELS = useMemo<Record<string, string>>(
    () => ({
      command: t("triggerTypes.command"),
      keyword: t("triggerTypes.keyword"),
      startsWith: t("triggerTypes.startsWith"),
      regex: t("triggerTypes.regex"),
    }),
    [t],
  );

  const VARIABLE_HELP = useMemo(
    () => [
      { variable: "{user}", description: t("variables.entries.user") },
      { variable: "{username}", description: t("variables.entries.username") },
      { variable: "{userId}", description: t("variables.entries.userId") },
      { variable: "{server}", description: t("variables.entries.server") },
      { variable: "{channel}", description: t("variables.entries.channel") },
      { variable: "{channelName}", description: t("variables.entries.channelName") },
      { variable: "{memberCount}", description: t("variables.entries.memberCount") },
    ],
    [t],
  );

  function resetForm() {
    setFormName("");
    setFormTriggerType("command");
    setFormResponseType("text");
    setFormContent("");
    setFormEmbedTitle("");
    setFormEmbedDescription("");
    setFormEmbedColor("#5865f2");
    setFormEmbedFooter("");
    setFormActions([]);
    setFormEnabled(true);
    setFormCooldown("0");
    setFormAllowedRoles([]);
    setFormAllowedChannels([]);
    setFormDeletesTrigger(false);
    setFormDmResponse(false);
    setEditingCommand(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(cmd: CustomCommandItem) {
    setEditingCommand(cmd);
    setFormName(cmd.name);
    setFormTriggerType(cmd.triggerType);
    setFormResponseType(cmd.response.type);
    setFormContent(cmd.response.content ?? "");
    setFormEmbedTitle(cmd.response.embed?.title ?? "");
    setFormEmbedDescription(cmd.response.embed?.description ?? "");
    setFormEmbedColor(
      cmd.response.embed?.color !== undefined
        ? `#${cmd.response.embed.color.toString(16).padStart(6, "0")}`
        : "#5865f2",
    );
    setFormEmbedFooter(cmd.response.embed?.footer ?? "");
    setFormActions(cmd.actions.length > 0 ? [...cmd.actions] : []);
    setFormEnabled(cmd.enabled);
    setFormCooldown(String(cmd.cooldown));
    setFormAllowedRoles([...cmd.allowedRoles]);
    setFormAllowedChannels([...cmd.allowedChannels]);
    setFormDeletesTrigger(cmd.deletesTrigger);
    setFormDmResponse(cmd.dmResponse);
    setDialogOpen(true);
  }

  function buildResponse(): CustomCommandResponse {
    if (formResponseType === "embed") {
      return {
        type: "embed",
        embed: {
          title: formEmbedTitle || undefined,
          description: formEmbedDescription || undefined,
          color: formEmbedColor ? parseInt(formEmbedColor.replace("#", ""), 16) : undefined,
          footer: formEmbedFooter || undefined,
        },
      };
    }
    return { type: "text", content: formContent };
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    const response = buildResponse();
    const validActions = formActions.filter((a) => a.roleId);

    if (editingCommand) {
      updateCommand.mutate(
        {
          commandId: editingCommand.id,
          data: {
            name: formName,
            triggerType: formTriggerType,
            response,
            actions: validActions,
            enabled: formEnabled,
            cooldown: parseInt(formCooldown, 10) || 0,
            allowedRoles: formAllowedRoles,
            allowedChannels: formAllowedChannels,
            deletesTrigger: formDeletesTrigger,
            dmResponse: formDmResponse,
          },
        },
        {
          onSuccess: () => {
            toast.success(t("toast.updated"));
            setDialogOpen(false);
            resetForm();
          },
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : t("toast.updateFailed")),
        },
      );
    } else {
      const data: CreateCustomCommandData = {
        name: formName,
        triggerType: formTriggerType,
        response,
        actions: validActions,
        enabled: formEnabled,
        cooldown: parseInt(formCooldown, 10) || 0,
        allowedRoles: formAllowedRoles,
        allowedChannels: formAllowedChannels,
        deletesTrigger: formDeletesTrigger,
        dmResponse: formDmResponse,
      };

      createCommand.mutate(data, {
        onSuccess: () => {
          toast.success(t("toast.created"));
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.createFailed")),
      });
    }
  }

  function handleDelete(commandId: number) {
    deleteCommand.mutate(commandId, {
      onSuccess: () => toast.success(t("toast.deleted")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.deleteFailed")),
    });
  }

  function handleToggleEnabled(cmd: CustomCommandItem) {
    updateCommand.mutate(
      { commandId: cmd.id, data: { enabled: !cmd.enabled } },
      {
        onSuccess: () =>
          toast.success(cmd.enabled ? t("toast.toggleDisabled") : t("toast.toggleEnabled")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("toast.toggleFailed")),
      },
    );
  }

  function handleAddAction() {
    if (formActions.length >= 5) {
      toast.error(t("actionsSection.maxActions"));
      return;
    }
    setFormActions([...formActions, emptyAction()]);
  }

  function handleRemoveAction(index: number) {
    setFormActions(formActions.filter((_, i) => i !== index));
  }

  function handleActionChange(
    index: number,
    field: keyof CustomCommandAction,
    value: string,
  ) {
    const updated = [...formActions];
    updated[index] = { ...updated[index], [field]: value };
    setFormActions(updated);
  }

  const textChannels = channels?.filter((c) => c.type === 0) ?? [];
  const enabledCount = commands?.filter((c) => c.enabled).length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.totalCommands")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {isLoading ? "..." : commands?.length ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("stats.enabled")}</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {isLoading ? "..." : enabledCount}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">{t("common:limit")}</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {isLoading ? "..." : t("stats.limit", { count: commands?.length ?? 0 })}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="commands">
        <TabsList>
          <TabsTrigger value="commands">{t("tabs.commands")}</TabsTrigger>
          <TabsTrigger value="variables">{t("tabs.variables")}</TabsTrigger>
        </TabsList>

        {/* Command List */}
        <TabsContent value="commands">
          <Card className="bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t("tabs.commands")}</h3>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog}>
                    <Icon name="add" size={16} className="me-1" />
                    {t("dialog.createCommand")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCommand ? t("dialog.editCommand") : t("dialog.createCommand")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Trigger Config */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="cmd-name">
                          {formTriggerType === "command"
                            ? t("form.commandName")
                            : formTriggerType === "regex"
                              ? t("form.regexPattern")
                              : t("form.triggerText")}
                        </Label>
                        <Input
                          id="cmd-name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={
                            formTriggerType === "command"
                              ? "e.g. rules"
                              : formTriggerType === "regex"
                                ? "e.g. hello|hi|hey"
                                : "e.g. hello"
                          }
                        />
                        {formTriggerType === "command" && formName && (
                          <p className="mt-1 font-mono text-xs text-text-muted">
                            {t("triggerPrefix", { name: formName })}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="cmd-trigger">{t("form.triggerType")}</Label>
                        <Select
                          value={formTriggerType}
                          onValueChange={(v) =>
                            setFormTriggerType(
                              v as typeof formTriggerType,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="command">
                              {t("triggerTypes.prefixCommand")}
                            </SelectItem>
                            <SelectItem value="keyword">
                              {t("triggerTypes.keywordContains")}
                            </SelectItem>
                            <SelectItem value="startsWith">
                              {t("triggerTypes.startsWith")}
                            </SelectItem>
                            <SelectItem value="regex">
                              {t("triggerTypes.regex")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    {/* Response Config */}
                    <div>
                      <div className="mb-3 flex items-center gap-3">
                        <h4 className="text-sm font-semibold">{t("form.response")}</h4>
                        <Select
                          value={formResponseType}
                          onValueChange={(v) =>
                            setFormResponseType(v as "text" | "embed")
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">{t("badge.text")}</SelectItem>
                            <SelectItem value="embed">{t("badge.embed")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formResponseType === "text" ? (
                        <div>
                          <Label htmlFor="cmd-content">{t("form.message")}</Label>
                          <Textarea
                            id="cmd-content"
                            value={formContent}
                            onChange={(e) => setFormContent(e.target.value)}
                            placeholder={t("form.message")}
                            rows={4}
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="embed-title">{t("form.embedTitle")}</Label>
                            <Input
                              id="embed-title"
                              value={formEmbedTitle}
                              onChange={(e) => setFormEmbedTitle(e.target.value)}
                              placeholder={t("form.embedTitle")}
                            />
                          </div>
                          <div>
                            <Label htmlFor="embed-desc">
                              {t("form.embedDescription")}
                            </Label>
                            <Textarea
                              id="embed-desc"
                              value={formEmbedDescription}
                              onChange={(e) =>
                                setFormEmbedDescription(e.target.value)
                              }
                              placeholder={t("form.embedDescription")}
                              rows={3}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="embed-color">{t("form.color")}</Label>
                              <Input
                                id="embed-color"
                                type="color"
                                value={formEmbedColor}
                                onChange={(e) =>
                                  setFormEmbedColor(e.target.value)
                                }
                                className="h-10 w-full"
                              />
                            </div>
                            <div>
                              <Label htmlFor="embed-footer">{t("form.footer")}</Label>
                              <Input
                                id="embed-footer"
                                value={formEmbedFooter}
                                onChange={(e) =>
                                  setFormEmbedFooter(e.target.value)
                                }
                                placeholder={t("form.footer")}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">
                          {t("actionsSection.title", { count: formActions.length })}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddAction}
                          disabled={formActions.length >= 5}
                        >
                          <Icon name="add" size={14} className="me-1" />
                          {t("actions.addAction")}
                        </Button>
                      </div>

                      {formActions.length > 0 ? (
                        <div className="space-y-3">
                          {formActions.map((action, idx) => (
                            <div
                              key={idx}
                              className="flex items-end gap-2 rounded-md border border-border p-3"
                            >
                              <div className="w-36">
                                <Label>{t("common:type")}</Label>
                                <Select
                                  value={action.type}
                                  onValueChange={(v) =>
                                    handleActionChange(idx, "type", v)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="addRole">
                                      {t("actions.addRole")}
                                    </SelectItem>
                                    <SelectItem value="removeRole">
                                      {t("actions.removeRole")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Label>{t("common:role")}</Label>
                                <Select
                                  value={action.roleId}
                                  onValueChange={(v) =>
                                    handleActionChange(idx, "roleId", v)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("restrictions.addRole")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles?.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>
                                        {r.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAction(idx)}
                              >
                                <Icon
                                  name="delete"
                                  size={16}
                                  className="text-danger"
                                />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">
                          {t("actionsSection.noActions")}
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Options */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold">{t("common:options")}</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="cmd-cooldown">
                              {t("options.cooldown")}
                            </Label>
                            <Input
                              id="cmd-cooldown"
                              type="number"
                              min={0}
                              max={3600}
                              value={formCooldown}
                              onChange={(e) => setFormCooldown(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <p className="text-sm font-medium">{t("options.enabled")}</p>
                            <p className="text-xs text-text-muted">
                              {t("options.enabledDesc")}
                            </p>
                          </div>
                          <Switch
                            checked={formEnabled}
                            onCheckedChange={setFormEnabled}
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <p className="text-sm font-medium">
                              {t("options.deleteTrigger")}
                            </p>
                            <p className="text-xs text-text-muted">
                              {t("options.deleteTriggerDesc")}
                            </p>
                          </div>
                          <Switch
                            checked={formDeletesTrigger}
                            onCheckedChange={setFormDeletesTrigger}
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                          <div>
                            <p className="text-sm font-medium">
                              {t("options.dmResponse")}
                            </p>
                            <p className="text-xs text-text-muted">
                              {t("options.dmResponseDesc")}
                            </p>
                          </div>
                          <Switch
                            checked={formDmResponse}
                            onCheckedChange={setFormDmResponse}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Permissions */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold">
                        {t("restrictions.title")}
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <Label>{t("restrictions.allowedChannels")}</Label>
                          <Select
                            value={
                              formAllowedChannels.length > 0
                                ? formAllowedChannels[
                                    formAllowedChannels.length - 1
                                  ]
                                : ""
                            }
                            onValueChange={(v) => {
                              if (!formAllowedChannels.includes(v)) {
                                setFormAllowedChannels([
                                  ...formAllowedChannels,
                                  v,
                                ]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("restrictions.addChannel")} />
                            </SelectTrigger>
                            <SelectContent>
                              {textChannels.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  #{ch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formAllowedChannels.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {formAllowedChannels.map((chId) => {
                                const ch = textChannels.find(
                                  (c) => c.id === chId,
                                );
                                return (
                                  <Badge
                                    key={chId}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() =>
                                      setFormAllowedChannels(
                                        formAllowedChannels.filter(
                                          (id) => id !== chId,
                                        ),
                                      )
                                    }
                                  >
                                    #{ch?.name ?? chId} x
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>{t("restrictions.allowedRoles")}</Label>
                          <Select
                            value={
                              formAllowedRoles.length > 0
                                ? formAllowedRoles[
                                    formAllowedRoles.length - 1
                                  ]
                                : ""
                            }
                            onValueChange={(v) => {
                              if (!formAllowedRoles.includes(v)) {
                                setFormAllowedRoles([
                                  ...formAllowedRoles,
                                  v,
                                ]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("restrictions.addRole")} />
                            </SelectTrigger>
                            <SelectContent>
                              {roles?.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formAllowedRoles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {formAllowedRoles.map((rId) => {
                                const r = roles?.find(
                                  (role) => role.id === rId,
                                );
                                return (
                                  <Badge
                                    key={rId}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() =>
                                      setFormAllowedRoles(
                                        formAllowedRoles.filter(
                                          (id) => id !== rId,
                                        ),
                                      )
                                    }
                                  >
                                    {r?.name ?? rId} x
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        {t("actions.cancel")}
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={
                          createCommand.isPending || updateCommand.isPending
                        }
                      >
                        {editingCommand ? t("actions.update") : t("actions.create")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <p className="text-text-muted">{t("loading")}</p>
            ) : commands && commands.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.name")}</TableHead>
                    <TableHead>{t("table.trigger")}</TableHead>
                    <TableHead>{t("table.response")}</TableHead>
                    <TableHead>{t("table.cooldown")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.map((cmd) => (
                    <TableRow key={cmd.id}>
                      <TableCell className="font-mono font-medium">
                        {cmd.triggerType === "command"
                          ? `!${cmd.name}`
                          : cmd.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TRIGGER_TYPE_LABELS[cmd.triggerType] ??
                            cmd.triggerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {cmd.response.type === "embed" ? t("badge.embed") : t("badge.text")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cmd.cooldown > 0 ? `${cmd.cooldown}s` : "--"}
                      </TableCell>
                      <TableCell>
                        {cmd.enabled ? (
                          <Badge className="bg-success/20 text-success">
                            {t("badge.active")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-text-muted"
                          >
                            {t("badge.disabled")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleEnabled(cmd)}
                            title={cmd.enabled ? t("common:disable") : t("common:enable")}
                          >
                            <Icon
                              name={
                                cmd.enabled
                                  ? "toggle_on"
                                  : "toggle_off"
                              }
                              size={16}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(cmd)}
                            title={t("common:edit")}
                          >
                            <Icon name="edit" size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cmd.id)}
                            disabled={deleteCommand.isPending}
                            title={t("common:delete")}
                          >
                            <Icon
                              name="delete"
                              size={16}
                              className="text-danger"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-text-muted">
                {t("empty")}
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Variables Reference */}
        <TabsContent value="variables">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">{t("variables.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("variables.description")}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("variables.table.variable")}</TableHead>
                  <TableHead>{t("variables.table.description")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VARIABLE_HELP.map((v) => (
                  <TableRow key={v.variable}>
                    <TableCell className="font-mono text-accent">
                      {v.variable}
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {v.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
