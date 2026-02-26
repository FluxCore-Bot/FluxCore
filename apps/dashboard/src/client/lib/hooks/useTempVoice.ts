import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  TempVoiceConfigSchema,
  type TempVoiceConfig,
  type TempVoiceFormData,
} from "../schemas";

export function useTempVoice(guildId: string) {
  return useQuery<TempVoiceConfig>({
    queryKey: ["guilds", guildId, "tempvoice"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/tempvoice`,
      );
      return TempVoiceConfigSchema.parse(data);
    },
  });
}

export function useUpdateTempVoice(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TempVoiceFormData) => {
      await apiFetch(`/api/guilds/${guildId}/tempvoice`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "tempvoice"],
      });
    },
  });
}

export function useDeleteTempVoice(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/guilds/${guildId}/tempvoice`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "tempvoice"],
      });
    },
  });
}
