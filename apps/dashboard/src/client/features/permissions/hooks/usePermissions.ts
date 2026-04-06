import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiFetch } from "../../../shared/lib/client";
import {
  MyPermissionsSchema,
  DashboardRoleListSchema,
  DashboardGuildSettingsSchema,
  DashboardAuditResponseSchema,
  type MyPermissions,
  type DashboardRole,
  type DashboardGuildSettings,
  type DashboardAuditResponse,
  type DashboardRoleMember,
} from "../../../shared/lib/schemas";

// ─── Permission Matching (client-side mirror of server logic) ───

function matchPermission(granted: Set<string>, required: string): boolean {
  if (granted.has("*")) return true;
  if (granted.has(required)) return true;

  const parts = required.split(".");
  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 1; i--) {
      const wildcard = parts.slice(0, i).join(".") + ".*";
      if (granted.has(wildcard)) return true;
    }
  }

  for (const perm of granted) {
    if (!perm.includes("*")) continue;
    if (wildcardMatch(perm, required)) return true;
  }

  return false;
}

function wildcardMatch(pattern: string, key: string): boolean {
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    if (prefix === "*") return true;
    const prefixParts = prefix.split(".");
    const keyParts = key.split(".");
    if (keyParts.length < prefixParts.length) return false;
    return prefixParts.every((seg, i) => seg === "*" || seg === keyParts[i]);
  }

  const patternParts = pattern.split(".");
  const keyParts = key.split(".");
  if (patternParts.length !== keyParts.length) return false;
  return patternParts.every((seg, i) => seg === "*" || seg === keyParts[i]);
}

// ─── My Permissions ───

export function usePermissions(guildId: string) {
  const { data, isLoading } = useQuery<MyPermissions>({
    queryKey: ["guilds", guildId, "my-permissions"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/my-permissions`);
      return MyPermissionsSchema.parse(raw);
    },
    staleTime: 60_000,
  });

  const can = useCallback(
    (key: string): boolean => {
      if (!data) return false;
      if (data.isOwner) return true;
      return matchPermission(new Set(data.permissions), key);
    },
    [data],
  );

  return {
    can,
    permissions: data?.permissions ?? [],
    effectivePermissions: data?.effectivePermissions ?? [],
    roles: data?.roles ?? [],
    isOwner: data?.isOwner ?? false,
    isLoading,
  };
}

// ─── Dashboard Roles ───

export function useDashboardRoles(guildId: string) {
  return useQuery<DashboardRole[]>({
    queryKey: ["guilds", guildId, "dashboard-roles"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/dashboard-roles`);
      return DashboardRoleListSchema.parse(raw);
    },
  });
}

export function useCreateDashboardRole(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; color?: string | null; isDefault?: boolean; permissions: string[] }) => {
      return apiFetch<DashboardRole>(`/api/guilds/${guildId}/dashboard-roles`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
    },
  });
}

export function useUpdateDashboardRole(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: Partial<{ name: string; color: string | null; position: number; isDefault: boolean; permissions: string[] }> }) => {
      return apiFetch<DashboardRole>(`/api/guilds/${guildId}/dashboard-roles/${roleId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "my-permissions"] });
    },
  });
}

export function useDeleteDashboardRole(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleId: string) => {
      await apiFetch(`/api/guilds/${guildId}/dashboard-roles/${roleId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "my-permissions"] });
    },
  });
}

export function useCreateRoleFromPreset(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preset: string) => {
      return apiFetch<DashboardRole>(`/api/guilds/${guildId}/dashboard-roles/from-preset`, {
        method: "POST",
        body: JSON.stringify({ preset }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
    },
  });
}

// ─── Role Members ───

export function useRoleMembers(guildId: string, roleId: string | null) {
  return useQuery<DashboardRoleMember[]>({
    queryKey: ["guilds", guildId, "dashboard-roles", roleId, "members"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/dashboard-roles/${roleId}/members`);
      return raw as DashboardRoleMember[];
    },
    enabled: roleId !== null,
  });
}

export function useAssignRoleMember(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      await apiFetch(`/api/guilds/${guildId}/dashboard-roles/${roleId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: (_data, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles", roleId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
    },
  });
}

export function useRemoveRoleMember(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      await apiFetch(`/api/guilds/${guildId}/dashboard-roles/${roleId}/members/${userId}`, { method: "DELETE" });
    },
    onSuccess: (_data, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles", roleId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-roles"] });
    },
  });
}

// ─── Dashboard Settings ───

export function useDashboardSettings(guildId: string) {
  return useQuery<DashboardGuildSettings>({
    queryKey: ["guilds", guildId, "dashboard-settings"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/dashboard-settings`);
      return DashboardGuildSettingsSchema.parse(raw);
    },
  });
}

export function useUpdateDashboardSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<{ auditRetentionDays: number; requirePermissions: boolean }>) => {
      await apiFetch(`/api/guilds/${guildId}/dashboard-settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "dashboard-settings"] });
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "my-permissions"] });
    },
  });
}

// ─── Audit Log ───

export function useDashboardAuditLog(guildId: string, params?: { page?: number; limit?: number; userId?: string; action?: string }) {
  const queryString = new URLSearchParams();
  if (params?.page) queryString.set("page", String(params.page));
  if (params?.limit) queryString.set("limit", String(params.limit));
  if (params?.userId) queryString.set("userId", params.userId);
  if (params?.action) queryString.set("action", params.action);

  return useQuery<DashboardAuditResponse>({
    queryKey: ["guilds", guildId, "dashboard-audit", params],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/api/guilds/${guildId}/dashboard-audit?${queryString}`);
      return DashboardAuditResponseSchema.parse(raw);
    },
  });
}
