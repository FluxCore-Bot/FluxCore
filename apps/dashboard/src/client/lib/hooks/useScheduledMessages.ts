import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  ScheduledMessageListResponseSchema,
  ScheduledMessageSchema,
  CronPreviewResponseSchema,
  type ScheduledMessageListResponse,
  type ScheduledMessage,
  type ScheduledMessageContent,
  type CronPreviewResponse,
} from "../schemas";

interface ScheduledMessageFilters {
  page?: number;
  limit?: number;
}

export function useScheduledMessages(guildId: string, filters: ScheduledMessageFilters = {}) {
  return useQuery<ScheduledMessageListResponse>({
    queryKey: ["guilds", guildId, "scheduled-messages", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/scheduled-messages${qs ? `?${qs}` : ""}`,
      );
      return ScheduledMessageListResponseSchema.parse(data);
    },
  });
}

export function useCreateScheduledMessage(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      channelId: string;
      name: string;
      message: ScheduledMessageContent;
      cronExpr: string;
      timezone?: string;
      enabled?: boolean;
    }) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/scheduled-messages`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      return ScheduledMessageSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "scheduled-messages"],
      });
    },
  });
}

export function useUpdateScheduledMessage(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      channelId?: string;
      name?: string;
      message?: ScheduledMessageContent;
      cronExpr?: string;
      timezone?: string;
      enabled?: boolean;
    }) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/scheduled-messages/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
      return ScheduledMessageSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "scheduled-messages"],
      });
    },
  });
}

export function useDeleteScheduledMessage(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/guilds/${guildId}/scheduled-messages/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "scheduled-messages"],
      });
    },
  });
}

export function useTestScheduledMessage(guildId: string) {
  return useMutation({
    mutationFn: async (id: number) => {
      return apiFetch<{ success: boolean; channelId: string; message: ScheduledMessageContent }>(
        `/api/guilds/${guildId}/scheduled-messages/${id}/test`,
        { method: "POST" },
      );
    },
  });
}

export function useCronPreview(guildId: string, cronExpr: string, timezone: string = "UTC") {
  return useQuery<CronPreviewResponse>({
    queryKey: ["guilds", guildId, "cron-preview", cronExpr, timezone],
    queryFn: async () => {
      const params = new URLSearchParams({ cronExpr, timezone });
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/scheduled-messages/preview-cron?${params}`,
      );
      return CronPreviewResponseSchema.parse(data);
    },
    enabled: cronExpr.length > 0,
  });
}
