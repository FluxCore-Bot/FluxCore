import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  LogEntryListResponseSchema,
  LogConfigResponseSchema,
  type LogEntryListResponse,
  type LogConfigResponse,
  type LogGuildConfigData,
} from "../../../shared/lib/schemas";

export interface LogFilters {
  category?: string;
  eventType?: string;
  targetId?: string;
  page?: number;
  limit?: number;
}

export function useLogEntries(guildId: string, filters: LogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.targetId) params.set("targetId", filters.targetId);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const queryString = params.toString();

  return useQuery<LogEntryListResponse>({
    queryKey: ["guilds", guildId, "log-entries", filters],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/logs${queryString ? `?${queryString}` : ""}`,
      );
      return LogEntryListResponseSchema.parse(data);
    },
  });
}

export function useLogConfig(guildId: string) {
  return useQuery<LogConfigResponse>({
    queryKey: ["guilds", guildId, "log-config"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/log-config`,
      );
      return LogConfigResponseSchema.parse(data);
    },
  });
}

export function useUpdateLogConfig(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      category,
      data,
    }: {
      category: string;
      data: LogGuildConfigData;
    }) => {
      return apiFetch<unknown>(
        `/api/guilds/${guildId}/log-config/${category}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "log-config"],
      });
    },
  });
}

export function usePurgeLogs(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiFetch<{ purged: number }>(
        `/api/guilds/${guildId}/logs`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "log-entries"],
      });
    },
  });
}
