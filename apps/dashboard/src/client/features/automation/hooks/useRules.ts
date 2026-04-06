import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../shared/lib/client";
import {
  ActionRuleListSchema,
  ActionRuleSchema,
  RuleAnalyticsSchema,
  type ActionRule,
  type RuleFormData,
  type RuleAnalytics,
} from "../../../shared/lib/schemas";

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

export function useBulkRuleAction(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ruleIds,
      action,
    }: {
      ruleIds: number[];
      action: "enable" | "disable" | "delete";
    }) => {
      await apiFetch(`/api/guilds/${guildId}/actions/rules/bulk`, {
        method: "PATCH",
        body: JSON.stringify({ ruleIds, action }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["guilds", guildId, "actions", "rules"],
      });
    },
  });
}

export function useRuleAnalytics(
  guildId: string,
  ruleId: number | null,
  days: number = 7,
) {
  return useQuery<RuleAnalytics>({
    queryKey: ["guilds", guildId, "actions", "rules", ruleId, "analytics", { days }],
    queryFn: async () => {
      const data = await apiFetch<unknown>(
        `/api/guilds/${guildId}/actions/rules/${ruleId}/analytics?days=${days}`,
      );
      return RuleAnalyticsSchema.parse(data);
    },
    enabled: ruleId !== null,
  });
}
