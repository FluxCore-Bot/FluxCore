import { useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../shared/components/PageHeader";
import { PageSkeleton } from "../../../shared/ui/skeletons";
import { Icon } from "../../../shared/components/Icon";
import { Button } from "../../../shared/ui/button";
import { Input } from "../../../shared/ui/input";
import { Label } from "../../../shared/ui/label";
import { Switch } from "../../../shared/ui/switch";
import { Badge } from "../../../shared/ui/badge";
import { Card, CardContent } from "../../../shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs";
import { Separator } from "../../../shared/ui/separator";
import { ColorPicker } from "../../../shared/ui/color-picker";
import { ScrollArea } from "../../../shared/ui/scroll-area";
import { Checkbox } from "../../../shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../shared/ui/dialog";
import {
  usePermissions,
  useDashboardRoles,
  useCreateDashboardRole,
  useUpdateDashboardRole,
  useDeleteDashboardRole,
  useCreateRoleFromPreset,
  useDashboardSettings,
  useUpdateDashboardSettings,
  useDashboardAuditLog,
} from "../../../features/permissions/hooks/usePermissions";
import type { DashboardRole } from "../../../shared/lib/schemas";
import {
  PERMISSION_REGISTRY,
  ROLE_PRESETS,
} from "@fluxcore/types";

// ─── Main Page ───

export function PermissionsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { t } = useTranslation("permissions");
  const { isOwner, isLoading: permLoading } = usePermissions(guildId);
  const { data: roles, isLoading: rolesLoading } = useDashboardRoles(guildId);
  const { data: settings, isLoading: settingsLoading } = useDashboardSettings(guildId);
  const updateSettings = useUpdateDashboardSettings(guildId);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const selectedRole = useMemo(
    () => roles?.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  // Auto-select first role
  useEffect(() => {
    if (!selectedRoleId && roles?.length) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  if (permLoading || rolesLoading || settingsLoading) return <PageSkeleton />;

  const requirePermissions = settings?.requirePermissions ?? false;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Icon name="add" size={16} className="me-1" />
            {t("actions.createRole")}
          </Button>
        }
      />

      {/* Enable/Disable Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">{t("permissionSystem.title")}</p>
            <p className="text-sm text-text-muted">
              {requirePermissions
                ? t("permissionSystem.active")
                : t("permissionSystem.inactive")}
            </p>
          </div>
          <Switch
            checked={requirePermissions}
            disabled={!isOwner || updateSettings.isPending}
            onCheckedChange={(checked) => {
              updateSettings.mutate(
                { requirePermissions: checked },
                {
                  onSuccess: () =>
                    toast.success(
                      checked
                        ? t("permissionSystem.enabledToast")
                        : t("permissionSystem.disabledToast"),
                    ),
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          />
        </CardContent>
      </Card>

      {!requirePermissions && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <Icon name="info" size={16} className="me-2 inline-block align-text-bottom" />
          {t("warning.disabled")}
        </div>
      )}

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
          <TabsTrigger value="audit">{t("tabs.auditLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Role List */}
            <div className="w-full shrink-0 space-y-2 md:w-64">
              <p className="section-label text-text-muted">{t("roleList.title")}</p>
              <div className="space-y-1">
                {roles?.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm transition-colors ${
                      selectedRoleId === role.id
                        ? "bg-surface-high text-text"
                        : "text-text-muted hover:bg-surface-high/50 hover:text-text"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color ?? "#666" }}
                    />
                    <span className="truncate">{role.name}</span>
                    {role.isDefault && (
                      <Badge variant="secondary" className="ms-auto text-xs">
                        {t("roleList.default")}
                      </Badge>
                    )}
                  </button>
                ))}
                {(!roles || roles.length === 0) && (
                  <p className="px-3 py-4 text-center text-xs text-text-muted">
                    {t("roleList.empty")}
                  </p>
                )}
              </div>
              <Separator className="my-3" />
              <PresetDropdown guildId={guildId} />
            </div>

            {/* Role Editor */}
            <div className="min-w-0 flex-1">
              {selectedRole ? (
                <RoleEditor
                  key={selectedRole.id}
                  guildId={guildId}
                  role={selectedRole}
                  onDelete={() => setSelectedRoleId(null)}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-text-muted">
                  {t("roleList.selectHint")}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogTab guildId={guildId} />
        </TabsContent>
      </Tabs>

      <CreateRoleDialog
        guildId={guildId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={(role) => {
          setSelectedRoleId(role.id);
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}

// ─── Role Editor ───

function RoleEditor({
  guildId,
  role,
  onDelete,
}: {
  guildId: string;
  role: DashboardRole;
  onDelete: () => void;
}) {
  const { t } = useTranslation("permissions");
  const updateRole = useUpdateDashboardRole(guildId);
  const deleteRole = useDeleteDashboardRole(guildId);
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color ?? "#a3a6ff");
  const [isDefault, setIsDefault] = useState(role.isDefault);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(role.permissions));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name !== role.name ||
    color !== (role.color ?? "#a3a6ff") ||
    isDefault !== role.isDefault ||
    !setsEqual(permissions, new Set(role.permissions));

  function handleSave() {
    updateRole.mutate(
      {
        roleId: role.id,
        data: {
          name: name.trim(),
          color,
          isDefault,
          permissions: [...permissions],
        },
      },
      {
        onSuccess: () => toast.success(t("toast.roleUpdated")),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleDelete() {
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        toast.success(t("toast.roleDeleted"));
        onDelete();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function togglePermission(key: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModuleWildcard(moduleKey: string) {
    const wildcard = `${moduleKey}.*`;
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(wildcard)) {
        next.delete(wildcard);
      } else {
        // Remove individual permissions for this module, add wildcard
        const modulePerms = PERMISSION_REGISTRY.find((m) => m.key === moduleKey);
        if (modulePerms) {
          for (const p of modulePerms.permissions) next.delete(p.key);
        }
        next.add(wildcard);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="font-label text-lg font-semibold">{role.name}</h3>
          <Badge variant="outline" className="text-xs">
            {t("roleEditor.memberCount", { count: role.memberCount })}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Icon name="delete" size={16} />
        </Button>
      </div>

      {/* Name & Color */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Label>{t("roleEditor.name")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("roleEditor.color")}</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          <Label className="text-sm text-text-muted">{t("roleEditor.defaultRole")}</Label>
        </div>
      </div>

      {/* Permission Grid */}
      <div className="space-y-2">
        <Label>{t("roleEditor.permissions")}</Label>
        <ScrollArea className="h-[400px] rounded-md border border-outline-variant/20 bg-surface-low p-4">
          <div className="space-y-6">
            {PERMISSION_REGISTRY.map((mod) => {
              const wildcard = `${mod.key}.*`;
              const hasWildcard = permissions.has(wildcard);
              const allGranted =
                hasWildcard ||
                mod.permissions.every((p) => permissions.has(p.key));

              return (
                <div key={mod.key}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allGranted}
                      onCheckedChange={() => toggleModuleWildcard(mod.key)}
                    />
                    <span className="font-label text-sm font-semibold">
                      {mod.label}
                    </span>
                    {hasWildcard && (
                      <Badge variant="secondary" className="text-xs">
                        {t("roleEditor.allBadge")}
                      </Badge>
                    )}
                  </div>
                  <div className="ms-6 mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {mod.permissions.map((perm) => {
                      const checked = hasWildcard || permissions.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-high/50"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={hasWildcard}
                            onCheckedChange={() => togglePermission(perm.key)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-text">{perm.label}</span>
                            <p className="text-xs text-text-muted">
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={!dirty || updateRole.isPending}>
          {updateRole.isPending ? t("saveButton.saving") : t("saveButton.save")}
        </Button>
      </div>

      {/* Delete Confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirm.deleteTitle", { name: role.name })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            {t("confirm.deleteMessage")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? t("deleteButton.deleting") : t("deleteButton.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Preset Dropdown ───

function PresetDropdown({ guildId }: { guildId: string }) {
  const { t } = useTranslation("permissions");
  const createFromPreset = useCreateRoleFromPreset(guildId);

  function handlePreset(key: string) {
    createFromPreset.mutate(key, {
      onSuccess: () => toast.success(t("presets.createdToast", { name: ROLE_PRESETS[key].name })),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="space-y-1">
      <p className="section-label text-text-muted">{t("presets.title")}</p>
      {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
        <button
          key={key}
          onClick={() => handlePreset(key)}
          disabled={createFromPreset.isPending}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-start text-xs text-text-muted transition-colors hover:bg-surface-high/50 hover:text-text"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: preset.color }}
          />
          {preset.name}
        </button>
      ))}
    </div>
  );
}

// ─── Create Role Dialog ───

function CreateRoleDialog({
  guildId,
  open,
  onOpenChange,
  onCreated,
}: {
  guildId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (role: DashboardRole) => void;
}) {
  const { t } = useTranslation("permissions");
  const createRole = useCreateDashboardRole(guildId);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a3a6ff");

  function handleCreate() {
    createRole.mutate(
      { name: name.trim(), color, permissions: [] },
      {
        onSuccess: (role) => {
          toast.success(t("toast.roleCreated", { name: role.name }));
          setName("");
          onCreated(role);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("createDialog.name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createDialog.namePlaceholder")}
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("createDialog.color")}</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createRole.isPending}
          >
            {createRole.isPending ? t("createButton.creating") : t("createButton.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit Log Tab ───

function AuditLogTab({ guildId }: { guildId: string }) {
  const { t } = useTranslation("permissions");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDashboardAuditLog(guildId, { page, limit: 25 });

  if (isLoading) return <PageSkeleton />;

  if (!data?.entries.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-muted">
        {t("audit.noEntries")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-outline-variant/20">
        <div className="min-w-[32rem] grid grid-cols-[1fr_1fr_1fr_auto] gap-4 border-b border-outline-variant/10 px-4 py-2 text-xs font-medium text-text-muted">
          <span>{t("audit.table.user")}</span>
          <span>{t("audit.table.action")}</span>
          <span>{t("audit.table.target")}</span>
          <span>{t("audit.table.timestamp")}</span>
        </div>
        {data.entries.map((entry) => (
          <div
            key={entry.id}
            className="min-w-[32rem] grid grid-cols-[1fr_1fr_1fr_auto] gap-4 border-b border-outline-variant/5 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="truncate text-text">{entry.username}</span>
            <span className="truncate font-mono text-xs text-accent">
              {entry.action}
            </span>
            <span className="truncate text-text-muted">
              {entry.targetType && (
                <Badge variant="outline" className="me-1 text-xs">
                  {entry.targetType}
                </Badge>
              )}
              {entry.targetId ?? "—"}
            </span>
            <span className="whitespace-nowrap text-xs text-text-muted">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("pagination.previous")}
          </Button>
          <span className="text-xs text-text-muted">
            {t("pagination.page", { current: data.page, total: data.pages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
