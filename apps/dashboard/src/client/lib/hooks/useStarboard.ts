import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";

export interface StarboardEntry {
  id: number;
  guildId: string;
  originalMessageId: string;
  originalChannelId: string;
  starboardMessageId: string | null;
  authorId: string;
  starCount: number;
  createdAt: string;
}

export interface StarboardSettings {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoredChannels: string[];
  nsfwHandling: "ignore" | "separate";
}

export interface StarboardEntriesResponse {
  entries: StarboardEntry[];
  total: number;
}

export function useStarboardSettings(guildId: string) {
  return useQuery<StarboardSettings>({
    queryKey: ["guilds", guildId, "starboard-settings"],
    queryFn: () => apiFetch<StarboardSettings>(`/api/guilds/${guildId}/starboard-settings`),
  });
}

export function useUpdateStarboardSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<StarboardSettings, "guildId">>) =>
      apiFetch<StarboardSettings>(`/api/guilds/${guildId}/starboard-settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "starboard-settings"],
      });
    },
  });
}

export function useStarboardEntries(guildId: string, page = 1) {
  return useQuery<StarboardEntriesResponse>({
    queryKey: ["guilds", guildId, "starboard", page],
    queryFn: () =>
      apiFetch<StarboardEntriesResponse>(`/api/guilds/${guildId}/starboard?page=${page}`),
  });
}
