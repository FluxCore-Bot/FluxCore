import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/client";
import { ChannelListSchema, type Channel } from "../lib/schemas";

export function useChannels(guildId: string, options?: { enabled?: boolean }) {
  return useQuery<Channel[]>({
    queryKey: ["guilds", guildId, "channels"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/channels`,
      );
      return ChannelListSchema.parse(data);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (server caches for 60s)
    enabled: options?.enabled ?? true,
  });
}
