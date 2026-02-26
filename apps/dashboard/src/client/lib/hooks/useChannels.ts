import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { ChannelListSchema, type Channel } from "../schemas";

export function useChannels(guildId: string) {
  return useQuery<Channel[]>({
    queryKey: ["guilds", guildId, "channels"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/channels`,
      );
      return ChannelListSchema.parse(data);
    },
  });
}
