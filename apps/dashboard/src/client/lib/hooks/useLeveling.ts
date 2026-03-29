import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  LeaderboardResponseSchema,
  LevelRewardListSchema,
  LevelSettingsSchema,
  type LeaderboardResponse,
  type LevelReward,
  type LevelSettings,
} from "../schemas";

interface LeaderboardFilters {
  page?: number;
  limit?: number;
}

export function useLeaderboard(guildId: string, filters: LeaderboardFilters = {}) {
  return useQuery<LeaderboardResponse>({
    queryKey: ["guilds", guildId, "leaderboard", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/leaderboard${qs ? `?${qs}` : ""}`,
      );
      return LeaderboardResponseSchema.parse(data);
    },
  });
}

export function useSetUserXp(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, xp }: { userId: string; xp: number }) => {
      return apiFetch(`/api/guilds/${guildId}/levels/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ xp }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "leaderboard"],
      });
    },
  });
}

export function useLevelSettings(guildId: string) {
  return useQuery<LevelSettings>({
    queryKey: ["guilds", guildId, "level-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/level-settings`,
      );
      return LevelSettingsSchema.parse(data);
    },
  });
}

export function useUpdateLevelSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<LevelSettings, "guildId">>) => {
      return apiFetch<LevelSettings>(`/api/guilds/${guildId}/level-settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "level-settings"],
      });
    },
  });
}

export function useLevelRewards(guildId: string) {
  return useQuery<LevelReward[]>({
    queryKey: ["guilds", guildId, "level-rewards"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/level-rewards`,
      );
      return LevelRewardListSchema.parse(data);
    },
  });
}

export function useAddLevelReward(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { level: number; roleId: string }) => {
      return apiFetch<LevelReward>(`/api/guilds/${guildId}/level-rewards`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "level-rewards"],
      });
    },
  });
}

export function useRemoveLevelReward(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/api/guilds/${guildId}/level-rewards/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "level-rewards"],
      });
    },
  });
}
