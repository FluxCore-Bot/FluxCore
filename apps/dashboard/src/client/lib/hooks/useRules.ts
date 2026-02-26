import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import {
  ActionRuleListSchema,
  ActionRuleSchema,
  type ActionRule,
  type RuleFormData,
} from "../schemas";

export function useRules(guildId: string) {
  return useQuery<ActionRule[]>({
    queryKey: ["guilds", guildId, "actions", "rules"],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/rules`,
      );
      return ActionRuleListSchema.parse(data);
    },
  });
}

export function useCreateRule(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RuleFormData) => {
      const res = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/rules`,
        { method: "POST", body: JSON.stringify(data) },
      );
      return ActionRuleSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "actions", "rules"],
      });
    },
  });
}

export function useUpdateRule(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleId,
      data,
    }: {
      ruleId: number;
      data: Partial<RuleFormData>;
    }) => {
      const res = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/rules/${ruleId}`,
        { method: "PUT", body: JSON.stringify(data) },
      );
      return ActionRuleSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "actions", "rules"],
      });
    },
  });
}

export function useDeleteRule(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: number) => {
      await apiFetch(`/api/guilds/${guildId}/actions/rules/${ruleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "actions", "rules"],
      });
    },
  });
}
