import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import { AnalyticsResponseSchema, type AnalyticsResponse } from "../../../shared/lib/schemas";

export function useAnalytics(guildId: string, days: number = 7) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["guilds", guildId, "actions", "analytics", { days }],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/analytics?days=${days}`,
      );
      return AnalyticsResponseSchema.parse(data);
    },
  });
}
