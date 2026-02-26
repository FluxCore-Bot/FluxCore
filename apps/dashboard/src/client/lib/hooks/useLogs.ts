import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { ActionLogListSchema, type ActionLog } from "../schemas";

export function useLogs(guildId: string, ruleName?: string) {
  return useQuery<ActionLog[]>({
    queryKey: ["guilds", guildId, "actions", "logs", { ruleName }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (ruleName) params.set("ruleName", ruleName);
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/logs?${params}`,
      );
      return ActionLogListSchema.parse(data);
    },
  });
}
