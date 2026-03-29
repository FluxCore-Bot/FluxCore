import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "../../../lib/client";
import { PageHeader } from "../../../components/PageHeader";
import {
  useRolePanels,
  useCreateRolePanel,
  useUpdateRolePanel,
  useDeleteRolePanel,
  useSendRolePanel,
  type CreateRolePanelData,
} from "../../../lib/hooks/useRolePanels";
import { useChannels } from "../../../lib/hooks/useChannels";
import { useRoles } from "../../../lib/hooks/useRoles";
import type { RolePanelItem, RolePanelEntryItem } from "../../../lib/schemas";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card } from "../../../components/ui/card";
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
import { Badge } from "../../../components/ui/badge";
import { Separator } from "../../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Icon } from "../../../components/Icon";

const PANEL_TYPE_LABELS: Record<string, string> = {
  reaction: "Reaction",
  button: "Button",
  dropdown: "Dropdown",
};

const PANEL_MODE_LABELS: Record<string, string> = {
  toggle: "Toggle",
  unique: "Unique",
  verify: "Verify",
};

const BUTTON_STYLE_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Secondary",
  3: "Success",
  4: "Danger",
};

function EmptyRoleEntry(): RolePanelEntryItem {
  return { roleId: "", label: "", emoji: "", description: "", style: 2 };
}

export function RolesPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });

  const { data: panels, isLoading } = useRolePanels(guildId);
  const createPanel = useCreateRolePanel(guildId);
  const updatePanel = useUpdateRolePanel(guildId);
  const deletePanel = useDeleteRolePanel(guildId);
  const sendPanel = useSendRolePanel(guildId);
  const { data: channels } = useChannels(guildId);
  const { data: roles } = useRoles(guildId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<RolePanelItem | null>(null);

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
      toast.error("Maximum 25 roles per panel");
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
      toast.error("Panel name is required");
      return;
    }
    if (!formChannelId) {
      toast.error("Channel is required");
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
            toast.success("Panel updated");
            setDialogOpen(false);
            resetForm();
          },
          onError: (err) =>
            toast.error(err instanceof ApiError ? err.message : "Failed to update panel"),
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
          toast.success("Panel created");
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Failed to create panel"),
      });
    }
  }

  function handleDelete(panelId: number) {
    deletePanel.mutate(panelId, {
      onSuccess: () => toast.success("Panel deleted"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to delete panel"),
    });
  }

  function handleSend(panelId: number) {
    sendPanel.mutate(panelId, {
      onSuccess: (res) => toast.success(res.message),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to send panel"),
    });
  }

  const textChannels = channels?.filter((c) => c.type === 0) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Role Panels"
        subtitle="Create self-assignable role panels using buttons, dropdowns, or reactions."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Total Panels</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {isLoading ? "..." : panels?.length ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Deployed</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {isLoading ? "..." : panels?.filter((p) => p.messageId).length ?? 0}
          </p>
        </Card>
        <Card className="bg-surface p-4">
          <p className="section-label text-text-muted">Total Roles</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {isLoading ? "..." : panels?.reduce((sum, p) => sum + p.roles.length, 0) ?? 0}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="panels">
        <TabsList>
          <TabsTrigger value="panels">Panels</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Panel List */}
        <TabsContent value="panels">
          <Card className="bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">All Panels</h3>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog}>
                    <Icon name="add" size={16} className="mr-1" />
                    Create Panel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPanel ? "Edit Panel" : "Create Panel"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="panel-name">Name</Label>
                        <Input
                          id="panel-name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g. Color Roles"
                        />
                      </div>
                      <div>
                        <Label htmlFor="panel-channel">Channel</Label>
                        <Select value={formChannelId} onValueChange={setFormChannelId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel" />
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
                        <Label htmlFor="panel-type">Type</Label>
                        <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="button">Button</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="reaction">Reaction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="panel-mode">Mode</Label>
                        <Select value={formMode} onValueChange={(v) => setFormMode(v as typeof formMode)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="toggle">Toggle (add/remove)</SelectItem>
                            <SelectItem value="unique">Unique (one at a time)</SelectItem>
                            <SelectItem value="verify">Verify (add only)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formType === "dropdown" && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="min-roles">Min Roles</Label>
                          <Input
                            id="min-roles"
                            type="number"
                            min={0}
                            value={formMinRoles}
                            onChange={(e) => setFormMinRoles(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-roles">Max Roles</Label>
                          <Input
                            id="max-roles"
                            type="number"
                            min={1}
                            value={formMaxRoles}
                            onChange={(e) => setFormMaxRoles(e.target.value)}
                            placeholder="All"
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Embed Config */}
                    <div>
                      <h4 className="mb-3 text-sm font-semibold">Embed</h4>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="embed-title">Title</Label>
                          <Input
                            id="embed-title"
                            value={formEmbedTitle}
                            onChange={(e) => setFormEmbedTitle(e.target.value)}
                            placeholder="Panel title (defaults to panel name)"
                          />
                        </div>
                        <div>
                          <Label htmlFor="embed-description">Description</Label>
                          <Input
                            id="embed-description"
                            value={formEmbedDescription}
                            onChange={(e) => setFormEmbedDescription(e.target.value)}
                            placeholder="Description text"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Role Entries */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">
                          Roles ({formRoles.length}/25)
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddRoleEntry}
                          disabled={formRoles.length >= 25}
                        >
                          <Icon name="add" size={14} className="mr-1" />
                          Add Role
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {formRoles.map((entry, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end"
                          >
                            <div className="flex-1">
                              <Label>Role</Label>
                              <Select
                                value={entry.roleId}
                                onValueChange={(v) => handleRoleEntryChange(idx, "roleId", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
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
                              <Label>Label</Label>
                              <Input
                                value={entry.label}
                                onChange={(e) => handleRoleEntryChange(idx, "label", e.target.value)}
                                placeholder="Button label"
                              />
                            </div>
                            <div className="w-24">
                              <Label>Emoji</Label>
                              <Input
                                value={entry.emoji ?? ""}
                                onChange={(e) => handleRoleEntryChange(idx, "emoji", e.target.value)}
                                placeholder="e.g. star"
                              />
                            </div>
                            {formType === "dropdown" && (
                              <div className="flex-1">
                                <Label>Description</Label>
                                <Input
                                  value={entry.description ?? ""}
                                  onChange={(e) =>
                                    handleRoleEntryChange(idx, "description", e.target.value)
                                  }
                                  placeholder="Option description"
                                />
                              </div>
                            )}
                            {formType === "button" && (
                              <div className="w-28">
                                <Label>Style</Label>
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
                                    <SelectItem value="1">Primary</SelectItem>
                                    <SelectItem value="2">Secondary</SelectItem>
                                    <SelectItem value="3">Success</SelectItem>
                                    <SelectItem value="4">Danger</SelectItem>
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
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={createPanel.isPending || updatePanel.isPending}
                      >
                        {editingPanel ? "Update" : "Create"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <p className="text-text-muted">Loading panels...</p>
            ) : panels && panels.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
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
                          <Badge className="bg-success/20 text-success">Deployed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-text-muted">
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(panel)}
                            title="Edit"
                          >
                            <Icon name="edit" size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSend(panel.id)}
                            disabled={sendPanel.isPending || panel.roles.length === 0}
                            title="Send to channel"
                          >
                            <Icon name="send" size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(panel.id)}
                            disabled={deletePanel.isPending}
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
            ) : (
              <p className="text-text-muted">
                No role panels created yet. Click "Create Panel" to get started.
              </p>
            )}
          </Card>
        </TabsContent>

        {/* Preview */}
        <TabsContent value="preview">
          <Card className="bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Live Preview</h3>
            <p className="mb-4 text-sm text-text-muted">
              Preview how your panels will appear in Discord.
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
                    <div className="rounded-md border-l-4 border-accent bg-surface-high p-4">
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
                          Select roles...
                          <Icon name="expand_more" size={16} className="ml-2" />
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
              <p className="text-text-muted">No panels to preview.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
