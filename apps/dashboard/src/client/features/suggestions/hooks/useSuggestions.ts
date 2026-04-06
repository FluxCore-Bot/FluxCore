import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  SuggestionListResponseSchema,
  SuggestionSettingsSchema,
  SuggestionSchema,
  type SuggestionListResponse,
  type SuggestionSettings,
} from "../../../shared/lib/schemas";

interface SuggestionFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export function useSuggestions(guildId: string, filters: SuggestionFilters = {}) {
  return useQuery<SuggestionListResponse>({
    queryKey: ["guilds", guildId, "suggestions", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/suggestions${qs ? `?${qs}` : ""}`,
      );
      return SuggestionListResponseSchema.parse(data);
    },
  });
}

export function useUpdateSuggestionStatus(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: number;
      status: string;
      reason?: string;
    }) => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/suggestions/${id}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status, reason }),
        },
      );
      return SuggestionSchema.parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "suggestions"],
      });
    },
  });
}

export function useDeleteSuggestion(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/guilds/${guildId}/suggestions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "suggestions"],
      });
    },
  });
}

export function useSuggestionSettings(guildId: string) {
  return useQuery<SuggestionSettings>({
    queryKey: ["guilds", guildId, "suggestion-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/suggestion-settings`,
      );
      return SuggestionSettingsSchema.parse(data);
    },
  });
}

export function useUpdateSuggestionSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<SuggestionSettings, "guildId">>) => {
      return apiFetch<SuggestionSettings>(
        `/api/guilds/${guildId}/suggestion-settings`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "suggestion-settings"],
      });
    },
  });
}
