import type { TriggerType } from "./types.js";

export const MAX_COMMANDS_PER_GUILD = 50;
export const MAX_RESPONSE_LENGTH = 2000;
export const MAX_NAME_LENGTH = 100;

export const TRIGGER_TYPES: readonly TriggerType[] = [
  "command",
  "keyword",
  "startsWith",
  "regex",
] as const;

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  command: "Prefix Command (!name)",
  keyword: "Keyword (contains)",
  startsWith: "Starts With",
  regex: "Regex Pattern",
};
