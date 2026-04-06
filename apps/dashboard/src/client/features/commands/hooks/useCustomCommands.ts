import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import { CustomCommandListSchema, type CustomCommandItem } from "../../../shared/lib/schemas";

export function useCustomCommands(guildId: string) {
  return useQuery<CustomCommandItem[]>({
    queryKey: ["guilds", guildId, "custom-commands"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/custom-commands`,
      );
      return CustomCommandListSchema.parse(data);
    },
  });
}

export interface CreateCustomCommandData {
  name: string;
  triggerType: "command" | "keyword" | "startsWith" | "regex";
  response?: {
    type: "text" | "embed";
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      footer?: string;
      thumbnail?: string;
      image?: string;
    };
  };
  actions?: { type: "addRole" | "removeRole"; roleId: string }[];
  enabled?: boolean;
  cooldown?: number;
  allowedRoles?: string[];
  allowedChannels?: string[];
  deletesTrigger?: boolean;
  dmResponse?: boolean;
}

export function useCreateCustomCommand(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCustomCommandData) => {
      return apiFetch<CustomCommandItem>(
        `/api/guilds/${guildId}/custom-commands`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "custom-commands"],
      });
    },
  });
}

export interface UpdateCustomCommandData {
  name?: string;
  triggerType?: "command" | "keyword" | "startsWith" | "regex";
  response?: {
    type: "text" | "embed";
    content?: string;
    embed?: {
      title?: string;
      description?: string;
      color?: number;
      footer?: string;
      thumbnail?: string;
      image?: string;
    };
  };
  actions?: { type: "addRole" | "removeRole"; roleId: string }[];
  enabled?: boolean;
  cooldown?: number;
  allowedRoles?: string[];
  allowedChannels?: string[];
  deletesTrigger?: boolean;
  dmResponse?: boolean;
}

export function useUpdateCustomCommand(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commandId,
      data,
    }: {
      commandId: number;
      data: UpdateCustomCommandData;
    }) => {
      return apiFetch<CustomCommandItem>(
        `/api/guilds/${guildId}/custom-commands/${commandId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "custom-commands"],
      });
    },
  });
}

export function useDeleteCustomCommand(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commandId: number) => {
      await apiFetch(`/api/guilds/${guildId}/custom-commands/${commandId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "custom-commands"],
      });
    },
  });
}
