import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/client";
import { GuildListSchema, type Guild } from "../lib/schemas";

export function useGuilds(enabled = true) {
  return useQuery<Guild[]>({
    queryKey: ["guilds"],
    queryFn: async () => {
      const data = await apiFetch<unknown>("/api/guilds");
      return GuildListSchema.parse(data);
    },
    enabled,
  });
}

/**
 * Force the server to re-fetch the user's guild list from Discord, so newly
 * granted roles (e.g. a fresh admin role) appear without re-authenticating.
 */
export function useRefreshGuilds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await apiFetch<unknown>("/api/guilds/refresh", {
        method: "POST",
      });
      return GuildListSchema.parse(data);
    },
    onSuccess: (guilds) => {
      queryClient.setQueryData(["guilds"], guilds);
    },
  });
}

export function useRefreshGuild(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<unknown>(`/api/guilds/${guildId}/refresh`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds"] });
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "roles"],
      });
    },
  });
}
