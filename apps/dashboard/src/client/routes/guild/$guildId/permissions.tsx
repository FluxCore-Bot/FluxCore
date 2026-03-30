import { useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "../../../components/PageHeader";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { Icon } from "../../../components/Icon";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Separator } from "../../../components/ui/separator";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
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
} from "../../../lib/hooks/usePermissions";
import type { DashboardRole } from "../../../lib/schemas";
import {
  PERMISSION_REGISTRY,
  ROLE_PRESETS,
} from "@fluxcore/types";

// ─── Main Page ───

export function PermissionsPage() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
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
        title="Roles & Permissions"
        subtitle="Control who can access and manage each dashboard module."
        actions={
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Icon name="add" size={16} className="mr-1" />
            Create Role
          </Button>
        }
      />

      {/* Enable/Disable Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">Permission System</p>
            <p className="text-sm text-text-muted">
              {requirePermissions
                ? "Active — admins are restricted to their assigned permissions."
                : "Inactive — all admins with MANAGE_GUILD have full access."}
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
                        ? "Permission system enabled"
                        : "Permission system disabled — all admins have full access",
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
          <Icon name="info" size={16} className="mr-2 inline-block align-text-bottom" />
          The permission system is disabled. All dashboard admins currently have full access. Enable it above to enforce granular permissions.
        </div>
      )}

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <div className="flex gap-6">
            {/* Role List */}
            <div className="w-64 shrink-0 space-y-2">
              <p className="section-label text-text-muted">Dashboard Roles</p>
              <div className="space-y-1">
                {roles?.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
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
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        Default
                      </Badge>
                    )}
                  </button>
                ))}
                {(!roles || roles.length === 0) && (
                  <p className="px-3 py-4 text-center text-xs text-text-muted">
                    No roles created yet.
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
                  Select a role to edit, or create a new one.
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
        onSuccess: () => toast.success("Role updated"),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleDelete() {
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        toast.success("Role deleted");
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
          <h3 className="text-lg font-semibold">{role.name}</h3>
          <Badge variant="outline" className="text-xs">
            {role.memberCount} member{role.memberCount !== 1 ? "s" : ""}
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
          <Label>Role Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded-md border border-outline-variant/20 bg-transparent"
          />
        </div>
        <div className="flex items-end gap-2 pb-0.5">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          <Label className="text-sm text-text-muted">Default role</Label>
        </div>
      </div>

      {/* Permission Grid */}
      <div className="space-y-2">
        <Label>Permissions</Label>
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
                      <Badge variant="secondary" className="text-[10px]">
                        All
                      </Badge>
                    )}
                  </div>
                  <div className="ml-6 mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
          {updateRole.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Delete Confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role "{role.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            This will remove the role and unassign all members. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Preset Dropdown ───

function PresetDropdown({ guildId }: { guildId: string }) {
  const createFromPreset = useCreateRoleFromPreset(guildId);

  function handlePreset(key: string) {
    createFromPreset.mutate(key, {
      onSuccess: () => toast.success(`Created "${ROLE_PRESETS[key].name}" role`),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="space-y-1">
      <p className="section-label text-text-muted">Quick Add from Preset</p>
      {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
        <button
          key={key}
          onClick={() => handlePreset(key)}
          disabled={createFromPreset.isPending}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-surface-high/50 hover:text-text"
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
  const createRole = useCreateDashboardRole(guildId);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a3a6ff");

  function handleCreate() {
    createRole.mutate(
      { name: name.trim(), color, permissions: [] },
      {
        onSuccess: (role) => {
          toast.success(`Created role "${role.name}"`);
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
          <DialogTitle>Create Dashboard Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Moderator"
              maxLength={32}
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-outline-variant/20 bg-transparent"
              />
              <span className="font-mono text-xs text-text-muted">{color}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createRole.isPending}
          >
            {createRole.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit Log Tab ───

function AuditLogTab({ guildId }: { guildId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDashboardAuditLog(guildId, { page, limit: 25 });

  if (isLoading) return <PageSkeleton />;

  if (!data?.entries.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-muted">
        No audit log entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-outline-variant/20">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 border-b border-outline-variant/10 px-4 py-2 text-xs font-medium text-text-muted">
          <span>User</span>
          <span>Action</span>
          <span>Target</span>
          <span>When</span>
        </div>
        {data.entries.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 border-b border-outline-variant/5 px-4 py-2.5 text-sm last:border-0"
          >
            <span className="truncate text-text">{entry.username}</span>
            <span className="truncate font-mono text-xs text-accent">
              {entry.action}
            </span>
            <span className="truncate text-text-muted">
              {entry.targetType && (
                <Badge variant="outline" className="mr-1 text-[10px]">
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
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            Page {data.page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
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
