import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  GiveawayListResponseSchema,
  GiveawaySchema,
  type GiveawayListResponse,
} from "../schemas";

interface GiveawayFilters {
  active?: boolean;
  page?: number;
  limit?: number;
}

export function useGiveaways(guildId: string, filters: GiveawayFilters = {}) {
  return useQuery<GiveawayListResponse>({
    queryKey: ["guilds", guildId, "giveaways", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.active !== undefined) params.set("active", String(filters.active));
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/giveaways${qs ? `?${qs}` : ""}`,
      );
      return GiveawayListResponseSchema.parse(data);
    },
  });
}

export function useCreateGiveaway(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      channelId: string;
      prize: string;
      winners: number;
      durationMs: number;
      requiredRoleIds?: string[];
    }) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/giveaways`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      return GiveawaySchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "giveaways"],
      });
    },
  });
}

export function useEndGiveaway(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/giveaways/${id}/end`,
        { method: "PUT" },
      );
      return GiveawaySchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "giveaways"],
      });
    },
  });
}

export function useRerollGiveaway(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/giveaways/${id}/reroll`,
        { method: "POST" },
      );
      return GiveawaySchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "giveaways"],
      });
    },
  });
}
