import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/client";
import { GuildMemberListSchema, type GuildMember } from "../lib/schemas";

/**
 * Search a guild's members by name.
 *
 * Disabled until there is something to search for: the endpoint fans out to
 * the Discord API on our bot token, so it must not fire on an empty box.
 * Callers should debounce the query they pass in.
 */
export function useMemberSearch(guildId: string, query: string) {
  const trimmed = query.trim();
  return useQuery<GuildMember[]>({
    queryKey: ["guilds", guildId, "members", "search", trimmed],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/members?q=${encodeURIComponent(trimmed)}`,
      );
      return GuildMemberListSchema.parse(data);
    },
    staleTime: 2 * 60 * 1000,
    enabled: trimmed.length > 0,
  });
}

/**
 * Resolve saved member ids to names, so a stored filter renders as "Ada"
 * rather than "123456789012345678".
 */
export function useMembersByIds(guildId: string, ids: string[]) {
  // Sorted and joined so the same set in a different order is one cache entry.
  const key = [...new Set(ids)].sort().join(",");
  return useQuery<GuildMember[]>({
    queryKey: ["guilds", guildId, "members", "byIds", key],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/members?ids=${encodeURIComponent(key)}`,
      );
      return GuildMemberListSchema.parse(data);
    },
    staleTime: 5 * 60 * 1000,
    enabled: key.length > 0,
  });
}
