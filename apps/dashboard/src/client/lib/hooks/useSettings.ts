import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { ActionSettingsSchema, type ActionSettings } from "../schemas";

export function useSettings(guildId: string) {
  return useQuery<ActionSettings>({
    queryKey: ["guilds", guildId, "actions", "settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/settings`,
      );
      return ActionSettingsSchema.parse(data);
    },
  });
}

export function useUpdateSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ActionSettings>) => {
      await apiFetch(`/api/guilds/${guildId}/actions/settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "actions", "settings"],
      });
    },
  });
}
