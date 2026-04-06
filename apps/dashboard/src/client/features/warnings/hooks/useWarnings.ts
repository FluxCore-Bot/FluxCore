import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  WarningListSchema,
  WarnPunishmentListSchema,
  WarnSettingsSchema,
  type Warning,
  type WarnPunishment,
  type WarnSettings,
} from "../../../shared/lib/schemas";

interface WarningsFilters {
  userId?: string;
  page?: number;
  limit?: number;
}

export function useWarnings(guildId: string, filters: WarningsFilters = {}) {
  return useQuery<{ warnings: Warning[]; total: number }>({
    queryKey: ["guilds", guildId, "warnings", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/warnings${qs ? `?${qs}` : ""}`,
      );
      return WarningListSchema.parse(data);
    },
  });
}

export function useCreateWarning(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; reason: string }) => {
      return apiFetch<Warning>(`/api/guilds/${guildId}/warnings`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warnings"],
      });
    },
  });
}

export function useDeleteWarning(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (warningId: number) => {
      await apiFetch(`/api/guilds/${guildId}/warnings/${warningId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warnings"],
      });
    },
  });
}

export function useClearUserWarnings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiFetch(`/api/guilds/${guildId}/warnings/user/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warnings"],
      });
    },
  });
}

export function useWarnPunishments(guildId: string) {
  return useQuery<WarnPunishment[]>({
    queryKey: ["guilds", guildId, "warn-punishments"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/warn-punishments`,
      );
      return WarnPunishmentListSchema.parse(data);
    },
  });
}

export function useAddPunishment(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { threshold: number; action: string; duration?: number | null }) => {
      return apiFetch<WarnPunishment>(`/api/guilds/${guildId}/warn-punishments`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warn-punishments"],
      });
    },
  });
}

export function useRemovePunishment(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/guilds/${guildId}/warn-punishments/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warn-punishments"],
      });
    },
  });
}

export function useWarnSettings(guildId: string) {
  return useQuery<WarnSettings>({
    queryKey: ["guilds", guildId, "warn-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/warn-settings`,
      );
      return WarnSettingsSchema.parse(data);
    },
  });
}

export function useUpdateWarnSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<WarnSettings, "guildId">>) => {
      return apiFetch<WarnSettings>(`/api/guilds/${guildId}/warn-settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "warn-settings"],
      });
    },
  });
}
