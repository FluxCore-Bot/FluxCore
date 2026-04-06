import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  TempVoiceConfigListSchema,
  type TempVoiceConfig,
  type TempVoiceFormData,
} from "../../../shared/lib/schemas";

export function useTempVoiceConfigs(guildId: string) {
  return useQuery<TempVoiceConfig[]>({
    queryKey: ["guilds", guildId, "tempvoice"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/tempvoice`,
      );
      return TempVoiceConfigListSchema.parse(data);
    },
  });
}

export function useCreateTempVoice(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TempVoiceFormData) => {
      return apiFetch<TempVoiceConfig>(`/api/guilds/${guildId}/tempvoice`, {
        method: "POST",
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

export function useUpdateTempVoice(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      configId,
      data,
    }: {
      configId: number;
      data: Partial<TempVoiceFormData>;
    }) => {
      return apiFetch<TempVoiceConfig>(
        `/api/guilds/${guildId}/tempvoice/${configId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
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
    mutationFn: async (configId: number) => {
      await apiFetch(`/api/guilds/${guildId}/tempvoice/${configId}`, {
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
