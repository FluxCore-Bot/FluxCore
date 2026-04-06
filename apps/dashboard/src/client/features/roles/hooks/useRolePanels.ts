import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  RolePanelListSchema,
  type RolePanelItem,
  type RolePanelEntryItem,
} from "../../../shared/lib/schemas";

export function useRolePanels(guildId: string) {
  return useQuery<RolePanelItem[]>({
    queryKey: ["guilds", guildId, "role-panels"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/role-panels`,
      );
      return RolePanelListSchema.parse(data);
    },
  });
}

export interface CreateRolePanelData {
  name: string;
  type: "reaction" | "button" | "dropdown";
  mode?: "toggle" | "unique" | "verify";
  channelId: string;
  embed?: string;
  roles?: RolePanelEntryItem[];
  maxRoles?: number;
  minRoles?: number;
}

export function useCreateRolePanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateRolePanelData) => {
      return apiFetch<RolePanelItem>(`/api/guilds/${guildId}/role-panels`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "role-panels"],
      });
    },
  });
}

export interface UpdateRolePanelData {
  name?: string;
  type?: "reaction" | "button" | "dropdown";
  mode?: "toggle" | "unique" | "verify";
  channelId?: string;
  embed?: string;
  roles?: RolePanelEntryItem[];
  maxRoles?: number | null;
  minRoles?: number | null;
}

export function useUpdateRolePanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ panelId, data }: { panelId: number; data: UpdateRolePanelData }) => {
      return apiFetch<RolePanelItem>(
        `/api/guilds/${guildId}/role-panels/${panelId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "role-panels"],
      });
    },
  });
}

export function useDeleteRolePanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (panelId: number) => {
      await apiFetch(`/api/guilds/${guildId}/role-panels/${panelId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "role-panels"],
      });
    },
  });
}

export function useSendRolePanel(guildId: string) {
  return useMutation({
    mutationFn: async (panelId: number) => {
      return apiFetch<{ success: boolean; message: string }>(
        `/api/guilds/${guildId}/role-panels/${panelId}/send`,
        { method: "POST" },
      );
    },
  });
}
