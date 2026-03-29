import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";

export interface AntiRaidConfigData {
  guildId: string;
  enabled: boolean;
  joinThreshold: number;
  joinWindow: number;
  joinAction: string;
  accountAgeMinDays: number;
  accountAgeAction: string;
  antiNukeEnabled: boolean;
  antiNukeThreshold: number;
  lockdownOnRaid: boolean;
  whitelistedRoleIds: string[];
  logChannelId: string | null;
}

export interface RaidEventData {
  id: number;
  guildId: string;
  eventType: string;
  details: {
    userIds?: string[];
    executorId?: string;
    action?: string;
    reason?: string;
    count?: number;
    ageDays?: number;
  };
  triggeredAt: string;
}

export interface RaidEventsResponse {
  events: RaidEventData[];
  total: number;
}

export function useAntiRaidConfig(guildId: string) {
  return useQuery<AntiRaidConfigData>({
    queryKey: ["guilds", guildId, "antiraid-config"],
    queryFn: async () => {
      return apiFetch<AntiRaidConfigData>(`/api/guilds/${guildId}/antiraid-config`);
    },
  });
}

export function useUpdateAntiRaidConfig(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<AntiRaidConfigData, "guildId">>) => {
      return apiFetch<AntiRaidConfigData>(`/api/guilds/${guildId}/antiraid-config`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "antiraid-config"],
      });
    },
  });
}

export function useRaidEvents(guildId: string, page: number = 1) {
  return useQuery<RaidEventsResponse>({
    queryKey: ["guilds", guildId, "raid-events", page],
    queryFn: async () => {
      return apiFetch<RaidEventsResponse>(
        `/api/guilds/${guildId}/raid-events?page=${page}`,
      );
    },
  });
}
