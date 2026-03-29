import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedConfig {
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: EmbedField[];
}

export interface WelcomeConfigData {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: EmbedConfig;
  farewellEnabled: boolean;
  farewellChannelId: string | null;
  farewellMessage: EmbedConfig;
  dmEnabled: boolean;
  dmMessage: EmbedConfig;
  autoRoleIds: string[];
}

export function useWelcomeConfig(guildId: string) {
  return useQuery<WelcomeConfigData>({
    queryKey: ["guilds", guildId, "welcome"],
    queryFn: async () => {
      return apiFetch<WelcomeConfigData>(`/api/guilds/${guildId}/welcome`);
    },
  });
}

export function useUpdateWelcomeConfig(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<WelcomeConfigData, "guildId">>) => {
      return apiFetch<WelcomeConfigData>(`/api/guilds/${guildId}/welcome`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "welcome"],
      });
    },
  });
}

export function useTestWelcome(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      return apiFetch<{ success: boolean; channelId: string }>(
        `/api/guilds/${guildId}/welcome/test`,
        { method: "POST" },
      );
    },
  });
}
