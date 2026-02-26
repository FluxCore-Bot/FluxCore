import { useQuery } from "@tanstack/react-query";
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
