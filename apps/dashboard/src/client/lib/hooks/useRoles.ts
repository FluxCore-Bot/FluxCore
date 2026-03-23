import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { RoleListSchema, type Role } from "../schemas";

export function useRoles(guildId: string) {
  return useQuery<Role[]>({
    queryKey: ["guilds", guildId, "roles"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(`/api/guilds/${guildId}/roles`);
      return RoleListSchema.parse(data);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (server caches for 60s)
  });
}
