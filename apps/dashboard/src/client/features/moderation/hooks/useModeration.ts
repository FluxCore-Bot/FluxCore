import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  ModCaseListSchema,
  ModCaseSchema,
  ModSettingsSchema,
  type ModCase,
  type ModSettings,
} from "../../../shared/lib/schemas";

interface ModCaseFilters {
  userId?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export function useModCases(guildId: string, filters?: ModCaseFilters) {
  return useQuery({
    queryKey: ["guilds", guildId, "mod-cases", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.action) params.set("action", filters.action);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/cases${qs ? `?${qs}` : ""}`,
      );
      return ModCaseListSchema.parse(data);
    },
  });
}

export function useModCase(guildId: string, caseId: number | null) {
  return useQuery<ModCase>({
    queryKey: ["guilds", guildId, "mod-cases", caseId],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/cases/${caseId}`,
      );
      return ModCaseSchema.parse(data);
    },
    enabled: caseId !== null,
  });
}

export function useDeleteModCase(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (caseId: number) => {
      await apiFetch(`/api/guilds/${guildId}/cases/${caseId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "mod-cases"],
      });
    },
  });
}

export function useUpdateModCase(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, reason }: { caseId: number; reason: string }) => {
      return apiFetch<ModCase>(
        `/api/guilds/${guildId}/cases/${caseId}`,
        {
          method: "PUT",
          body: JSON.stringify({ reason }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "mod-cases"],
      });
    },
  });
}

export function useModSettings(guildId: string) {
  return useQuery<ModSettings>({
    queryKey: ["guilds", guildId, "mod-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/mod-settings`,
      );
      return ModSettingsSchema.parse(data);
    },
  });
}

export function useUpdateModSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<ModSettings, "guildId">>) => {
      return apiFetch<ModSettings>(
        `/api/guilds/${guildId}/mod-settings`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "mod-settings"],
      });
    },
  });
}
