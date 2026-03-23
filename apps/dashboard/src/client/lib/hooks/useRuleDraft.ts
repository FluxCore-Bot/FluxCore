import { useCallback, useEffect, useRef } from "react";
import type { ActionConditions, ActionConfig, RuleStep } from "../schemas";

export interface RuleDraftData {
  name: string;
  eventType: string;
  actions: ActionConfig[];
  steps?: RuleStep[];
  entryStepId?: string;
  conditions: ActionConditions;
  priority: number;
  enabled: boolean;
  savedAt: number;
}

const STORAGE_PREFIX = "fluxcore:rule-draft";

function draftKey(guildId: string, ruleId?: number): string {
  return ruleId
    ? `${STORAGE_PREFIX}:${guildId}:${ruleId}`
    : `${STORAGE_PREFIX}:${guildId}:new`;
}

export function useRuleDraft(guildId: string, ruleId?: number) {
  const key = draftKey(guildId, ruleId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(
    (data: Omit<RuleDraftData, "savedAt">) => {
      // Debounce saves to avoid thrashing localStorage
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const draft: RuleDraftData = { ...data, savedAt: Date.now() };
          localStorage.setItem(key, JSON.stringify(draft));
        } catch {
          // Storage full or unavailable — silently skip
        }
      }, 500);
    },
    [key],
  );

  const loadDraft = useCallback((): RuleDraftData | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const draft = JSON.parse(raw) as RuleDraftData;
      // Discard drafts older than 24 hours
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(key);
  }, [key]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}
