import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { GuildListSchema, type Guild } from "../schemas";

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
