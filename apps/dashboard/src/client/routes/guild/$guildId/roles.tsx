import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "../../../shared/lib/client";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { PageHeader } from "../../../shared/components/PageHeader";
import {
  useRolePanels,
  useCreateRolePanel,
  useUpdateRolePanel,
  useDeleteRolePanel,
  useSendRolePanel,
  type CreateRolePanelData,
} from "../../../features/roles/hooks/useRolePanels";
import { useChannels } from "../../../shared/hooks/useChannels";
import { useRoles } from "../../../shared/hooks/useRoles";
import type { RolePanelItem, RolePanelEntryItem } from "../../../shared/lib/schemas";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Card } from "../../../shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../shared/ui/dialog";
import { Badge } from "../../../shared/ui/badge";
import { Separator } from "../../../shared/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { Icon } from "../../../shared/components/Icon";
import { StatsCard } from "../../../shared/components/StatsCard";
import { PageSkeleton, TableSkeleton } from "../../../shared/ui/skeletons";
import { LayoutGrid, Rocket, Users } from "lucide-react";

function EmptyRoleEntry(): RolePanelEntryItem {
  return { roleId: "", label: "", emoji: "", description: "", style: 2 };
}

export function RolesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("roles");

  const PANEL_TYPE_LABELS: Record<string, string> = useMemo(() => ({
    reaction: t("panelTypes.reaction"),
    button: t("panelTypes.button"),
    dropdown: t("panelTypes.dropdown"),
  }), [t]);

  const PANEL_MODE_LABELS: Record<string, string> = useMemo(() => ({
    toggle: t("panelModes.toggle"),
    unique: t("panelModes.unique"),
    verify: t("panelModes.verify"),
  }), [t]);

  const { data: panels, isLoading } = useRolePanels(guildId);
  const createPanel = useCreateRolePanel(guildId);
  const updatePanel = useUpdateRolePanel(guildId);
  const deletePanel = useDeleteRolePanel(guildId);
  const sendPanel = useSendRolePanel(guildId);
  const { data: channels } = useChannels(guildId);
  const { data: roles } = useRoles(guildId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<RolePanelItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"reaction" | "button" | "dropdown">("button");
  const [formMode, setFormMode] = useState<"toggle" | "unique" | "verify">("toggle");
  const [formChannelId, setFormChannelId] = useState("");
  const [formEmbedTitle, setFormEmbedTitle] = useState("");
  const [formEmbedDescription, setFormEmbedDescription] = useState("");
  const [formRoles, setFormRoles] = useState<RolePanelEntryItem[]>([EmptyRoleEntry()]);
  const [formMaxRoles, setFormMaxRoles] = useState("");
  const [formMinRoles, setFormMinRoles] = useState("");

  function resetForm() {
    setFormName("");
    setFormType("button");
    setFormMode("toggle");
    setFormChannelId("");
    setFormEmbedTitle("");
    setFormEmbedDescription("");
    setFormRoles([EmptyRoleEntry()]);
    setFormMaxRoles("");
    setFormMinRoles("");
    setEditingPanel(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(panel: RolePanelItem) {
    setEditingPanel(panel);
    setFormName(panel.name);
    setFormType(panel.type);
    setFormMode(panel.mode);
    setFormChannelId(panel.channelId);

    let embedConfig: { title?: string; description?: string } = {};
    try {
      embedConfig = JSON.parse(panel.embed) as typeof embedConfig;
    } catch { /* use defaults */ }
    setFormEmbedTitle(embedConfig.title ?? "");
    setFormEmbedDescription(embedConfig.description ?? "");

    setFormRoles(panel.roles.length > 0 ? [...panel.roles] : [EmptyRoleEntry()]);
    setFormMaxRoles(panel.maxRoles?.toString() ?? "");
    setFormMinRoles(panel.minRoles?.toString() ?? "");
    setDialogOpen(true);
  }

  function handleAddRoleEntry() {
    if (formRoles.length >= 25) {
      toast.error(t("toast.maxRolesReached"));
      return;
    }
    setFormRoles([...formRoles, EmptyRoleEntry()]);
  }

  function handleRemoveRoleEntry(index: number) {
    setFormRoles(formRoles.filter((_, i) => i !== index));
  }

  function handleRoleEntryChange(index: number, field: keyof RolePanelEntryItem, value: string | number) {
    const updated = [...formRoles];
    updated[index] = { ...updated[index], [field]: value };
    setFormRoles(updated);
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast.error(t("toast.nameRequired"));
      return;
    }
    if (!formChannelId) {
      toast.error(t("toast.channelRequired"));
      return;
    }

    const validRoles = formRoles.filter((r) => r.roleId && r.label);

    const embed = JSON.stringify({
      title: formEmbedTitle || undefined,
      description: formEmbedDescription || undefined,
    });

    if (editingPanel) {
      updatePanel.mutate(
        {
          panelId: editingPanel.id,
          data: {
            name: formName,
            type: formType,
            mode: formMode,
            channelId: formChannelId,
            embed,
            roles: validRoles,
            maxRoles: formMaxRoles ? parseInt(formMaxRoles, 10) : null,
            minRoles: formMinRoles ? parseInt(formMinRoles, 10) : null,
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
      const data: CreateRolePanelData = {
        name: formName,
        type: formType,
        mode: formMode,
        channelId: formChannelId,
        embed,
        roles: validRoles,
        maxRoles: formMaxRoles ? parseInt(formMaxRoles, 10) : undefined,
        minRoles: formMinRoles ? parseInt(formMinRoles, 10) : undefined,
      };

      createPanel.mutate(data, {
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

  function handleDelete(panelId: number) {
    setDeleteConfirmId(panelId);
  }

  function confirmDelete() {
    if (deleteConfirmId === null) return;
    deletePanel.mutate(deleteConfirmId, {
      onSuccess: () => toast.success(t("toast.deleted")),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.deleteFailed")),
    });
    setDeleteConfirmId(null);
  }

  function handleSend(panelId: number) {
    sendPanel.mutate(panelId, {
      onSuccess: (res) => toast.success(res.message),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t("toast.deployFailed")),
    });
  }

  const textChannels = channels?.filter((c) => c.type === 0) ?? [];

  if (isLoading) {
    return <PageSkeleton stats={3} tabCount={2} content="table" />;
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
          label={t("stats.totalPanels")}
          value={isLoading ? "..." : panels?.length ?? 0}
          icon={LayoutGrid}
          accent="primary"
        />
        <StatsCard
          label={t("stats.deployed")}
          value={isLoading ? "..." : panels?.filter((p) => p.messageId).length ?? 0}
          icon={Rocket}
          accent="success"
        />
        <StatsCard
          label={t("stats.totalRoles")}
          value={isLoading ? "..." : panels?.reduce((sum, p) => sum + p.roles.length, 0) ?? 0}
          icon={Users}
          accent="secondary"
        />
      </div>

      <Tabs defaultValue="panels">
        <TabsList>
          <TabsTrigger value="panels">{t("tabs.panels")}</TabsTrigger>
          <TabsTrigger value="preview">{t("tabs.preview")}</TabsTrigger>
        </TabsList>

        {/* Panel List */}
        <TabsContent value="panels">
          <Card className="bg-surface-container p-6 glass-edge">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-label text-lg font-semibold">{t("panelList.title")}</h3>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog}>
                    <Icon name="add" size={16} className="me-1" />
                    {t("dialog.createPanel")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPanel ? t("dialog.editPanel") : t("dialog.createPanel")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="panel-name">{t("form.name")}</Label>
                        <Input
                          id="panel-name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder={t("form.namePlaceholder")}
                        />
                      </div>
                      <div>
                        <Label htmlFor="panel-channel">{t("form.channel")}</Label>
                        <Select value={formChannelId} onValueChange={setFormChannelId}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("form.channelPlaceholder")} />
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
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="panel-type">{t("form.type")}</Label>
                        <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="button">{t("panelTypes.button")}</SelectItem>
                            <SelectItem value="dropdown">{t("panelTypes.dropdown")}</SelectItem>
                            <SelectItem value="reaction">{t("panelTypes.reaction")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="panel-mode">{t("form.mode")}</Label>
                        <Select value={formMode} onValueChange={(v) => setFormMode(v as typeof formMode)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="toggle">{t("panelModeDescriptions.toggle")}</SelectItem>
                            <SelectItem value="unique">{t("panelModeDescriptions.unique")}</SelectItem>
                            <SelectItem value="verify">{t("panelModeDescriptions.verify")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formType === "dropdown" && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="min-roles">{t("form.minRoles")}</Label>
                          <Input
                            id="min-roles"
                            type="number"
                            min={0}
                            value={formMinRoles}
                            onChange={(e) => setFormMinRoles(e.target.value)}
                            placeholder={t("form.minRolesPlaceholder")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-roles">{t("form.maxRoles")}</Label>
                          <Input
                            id="max-roles"
                            type="number"
                            min={1}
                            value={formMaxRoles}
                            onChange={(e) => setFormMaxRoles(e.target.value)}
                            placeholder={t("form.maxRolesPlaceholder")}
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Embed Config */}
                    <div>
                      <h4 className="mb-3 font-label text-sm font-semibold">{t("form.embedSection")}</h4>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="embed-title">{t("form.embedTitle")}</Label>
                          <Input
                            id="embed-title"
                            value={formEmbedTitle}
                            onChange={(e) => setFormEmbedTitle(e.target.value)}
                            placeholder={t("form.embedTitlePlaceholder")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="embed-description">{t("form.embedDescription")}</Label>
                          <Input
                            id="embed-description"
                            value={formEmbedDescription}
                            onChange={(e) => setFormEmbedDescription(e.target.value)}
                            placeholder={t("form.embedDescriptionPlaceholder")}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Role Entries */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-label text-sm font-semibold">
                          {t("form.rolesCount", { count: formRoles.length })}
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddRoleEntry}
                          disabled={formRoles.length >= 25}
                        >
                          <Icon name="add" size={14} className="me-1" />
                          {t("form.addRole")}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {formRoles.map((entry, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
                          >
                            <div className="flex-1">
                              <Label>{t("entry.role")}</Label>
                              <Select
                                value={entry.roleId}
                                onValueChange={(v) => handleRoleEntryChange(idx, "roleId", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t("entry.rolePlaceholder")} />
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
                            <div className="flex-1">
                              <Label>{t("entry.label")}</Label>
                              <Input
                                value={entry.label}
                                onChange={(e) => handleRoleEntryChange(idx, "label", e.target.value)}
                                placeholder={t("entry.labelPlaceholder")}
                              />
                            </div>
                            <div className="w-24">
                              <Label>{t("entry.emoji")}</Label>
                              <Input
                                value={entry.emoji ?? ""}
                                onChange={(e) => handleRoleEntryChange(idx, "emoji", e.target.value)}
                                placeholder={t("entry.emojiPlaceholder")}
                              />
                            </div>
                            {formType === "dropdown" && (
                              <div className="flex-1">
                                <Label>{t("entry.description")}</Label>
                                <Input
                                  value={entry.description ?? ""}
                                  onChange={(e) =>
                                    handleRoleEntryChange(idx, "description", e.target.value)
                                  }
                                  placeholder={t("entry.descriptionPlaceholder")}
                                />
                              </div>
                            )}
                            {formType === "button" && (
                              <div className="w-28">
                                <Label>{t("entry.style")}</Label>
                                <Select
                                  value={String(entry.style ?? 2)}
                                  onValueChange={(v) =>
                                    handleRoleEntryChange(idx, "style", parseInt(v, 10))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">{t("buttonStyles.primary")}</SelectItem>
                                    <SelectItem value="2">{t("buttonStyles.secondary")}</SelectItem>
                                    <SelectItem value="3">{t("buttonStyles.success")}</SelectItem>
                                    <SelectItem value="4">{t("buttonStyles.danger")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRoleEntry(idx)}
                              disabled={formRoles.length <= 1}
                            >
                              <Icon name="delete" size={16} className="text-danger" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        {t("actions.cancel")}
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={createPanel.isPending || updatePanel.isPending}
                      >
                        {editingPanel ? t("actions.update") : t("actions.create")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <TableSkeleton columns={5} />
            ) : panels && panels.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.name")}</TableHead>
                      <TableHead>{t("table.type")}</TableHead>
                      <TableHead>{t("table.mode")}</TableHead>
                      <TableHead>{t("table.roles")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {panels.map((panel) => (
                      <TableRow key={panel.id}>
                        <TableCell className="font-medium">{panel.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PANEL_TYPE_LABELS[panel.type] ?? panel.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {PANEL_MODE_LABELS[panel.mode] ?? panel.mode}
                          </Badge>
                        </TableCell>
                        <TableCell>{panel.roles.length}</TableCell>
                        <TableCell>
                          {panel.messageId ? (
                            <Badge className="bg-success/20 text-success">{t("status.deployed")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-text-muted">
                              {t("status.draft")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(panel)}
                              title={t("common:actions.edit")}
                            >
                              <Icon name="edit" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSend(panel.id)}
                              disabled={sendPanel.isPending || panel.roles.length === 0}
                              title={t("actions.deploy")}
                            >
                              <Icon name="send" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(panel.id)}
                              disabled={deletePanel.isPending}
                              title={t("common:actions.delete")}
                            >
                              <Icon name="delete" size={16} className="text-danger" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-text-muted">
                {t("empty")}
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Preview */}
        <TabsContent value="preview">
          <Card className="bg-surface-container p-6 glass-edge">
            <h3 className="mb-4 font-label text-lg font-semibold">{t("preview.title")}</h3>
            <p className="mb-4 text-sm text-text-muted">
              {t("preview.description")}
            </p>

            {panels && panels.length > 0 ? (
              <div className="space-y-6">
                {panels.map((panel) => (
                  <div key={panel.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="outline">
                        {PANEL_TYPE_LABELS[panel.type]}
                      </Badge>
                      <span className="text-sm font-medium">{panel.name}</span>
                    </div>

                    {/* Embed preview */}
                    <div className="rounded-md border-s-4 border-accent bg-surface-high p-4">
                      <p className="font-semibold text-text">
                        {(() => {
                          try {
                            const cfg = JSON.parse(panel.embed) as { title?: string };
                            return cfg.title || panel.name;
                          } catch {
                            return panel.name;
                          }
                        })()}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        {(() => {
                          try {
                            const cfg = JSON.parse(panel.embed) as { description?: string };
                            return cfg.description || panel.roles.map((r) => `${r.emoji ? `${r.emoji} ` : ""}${r.label}`).join(" | ");
                          } catch {
                            return panel.roles.map((r) => `${r.emoji ? `${r.emoji} ` : ""}${r.label}`).join(" | ");
                          }
                        })()}
                      </p>
                    </div>

                    {/* Component preview */}
                    {panel.type === "button" && panel.roles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {panel.roles.map((entry, idx) => {
                          const styleClasses: Record<number, string> = {
                            1: "bg-[#5865f2] text-white",
                            2: "bg-[#4f545c] text-white",
                            3: "bg-[#3ba55d] text-white",
                            4: "bg-[#ed4245] text-white",
                          };
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${styleClasses[entry.style ?? 2] ?? styleClasses[2]}`}
                            >
                              {entry.emoji && <span>{entry.emoji}</span>}
                              {entry.label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {panel.type === "dropdown" && panel.roles.length > 0 && (
                      <div className="mt-3">
                        <div className="inline-flex items-center rounded border border-[#4f545c] bg-[#2f3136] px-3 py-1.5 text-sm text-[#b9bbbe]">
                          {t("preview.selectRoles")}
                          <Icon name="expand_more" size={16} className="ms-2" />
                        </div>
                      </div>
                    )}

                    {panel.type === "reaction" && panel.roles.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {panel.roles.map((entry, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded bg-[#2f3136] px-2 py-1 text-sm"
                            title={entry.label}
                          >
                            {entry.emoji || "?"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted">{t("preview.noPreview")}</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Panel Confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title={t("common:actions.delete", { defaultValue: "Delete Panel" })}
        description={t("common:actions.confirmDelete", { defaultValue: "Are you sure you want to delete this role panel? This action cannot be undone." })}
        confirmLabel={t("common:actions.delete", { defaultValue: "Delete" })}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
