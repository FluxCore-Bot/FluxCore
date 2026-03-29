import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  TicketListResponseSchema,
  TicketPanelListSchema,
  TicketSettingsSchema,
  TicketPanelSchema,
  type TicketListResponse,
  type TicketPanelItem,
  type TicketSettingsItem,
  type TicketCategoryItem,
} from "../schemas";

interface TicketFilters {
  status?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export function useTickets(guildId: string, filters: TicketFilters = {}) {
  return useQuery<TicketListResponse>({
    queryKey: ["guilds", guildId, "tickets", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.userId) params.set("userId", filters.userId);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/tickets${qs ? `?${qs}` : ""}`,
      );
      return TicketListResponseSchema.parse(data);
    },
  });
}

export function useCloseTicket(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: number) => {
      await apiFetch(`/api/guilds/${guildId}/tickets/${ticketId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "tickets"] });
    },
  });
}

export function useTicketPanels(guildId: string) {
  return useQuery<TicketPanelItem[]>({
    queryKey: ["guilds", guildId, "ticket-panels"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/ticket-panels`,
      );
      return TicketPanelListSchema.parse(data);
    },
  });
}

export function useCreateTicketPanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      channelId: string;
      name: string;
      embed?: string;
      categories?: TicketCategoryItem[];
    }) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/ticket-panels`,
        { method: "POST", body: JSON.stringify(data) },
      );
      return TicketPanelSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "ticket-panels"] });
    },
  });
}

export function useUpdateTicketPanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      panelId,
      data,
    }: {
      panelId: number;
      data: Partial<{
        channelId: string;
        name: string;
        embed: string;
        categories: TicketCategoryItem[];
      }>;
    }) => {
      const result = await apiFetch<unknown>(
        `/api/guilds/${guildId}/ticket-panels/${panelId}`,
        { method: "PUT", body: JSON.stringify(data) },
      );
      return TicketPanelSchema.parse(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "ticket-panels"] });
    },
  });
}

export function useDeleteTicketPanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (panelId: number) => {
      await apiFetch(`/api/guilds/${guildId}/ticket-panels/${panelId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "ticket-panels"] });
    },
  });
}

export function useSendTicketPanel(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (panelId: number) => {
      return apiFetch(`/api/guilds/${guildId}/ticket-panels/${panelId}/send`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "ticket-panels"] });
    },
  });
}

export function useTicketSettings(guildId: string) {
  return useQuery<TicketSettingsItem>({
    queryKey: ["guilds", guildId, "ticket-settings"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/ticket-settings`,
      );
      return TicketSettingsSchema.parse(data);
    },
  });
}

export function useUpdateTicketSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Omit<TicketSettingsItem, "guildId" | "ticketCounter">>) => {
      return apiFetch<TicketSettingsItem>(`/api/guilds/${guildId}/ticket-settings`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guilds", guildId, "ticket-settings"] });
    },
  });
}
