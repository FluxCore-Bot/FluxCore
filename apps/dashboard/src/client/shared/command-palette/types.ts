export type CommandGroupKey = "recent" | "pages" | "actions" | "servers";

/**
 * The slice of i18next's TFunction the command sources actually call. Keeping
 * the parameter structural lets tests hand in a plain `(key) => key` without
 * impersonating the full TFunction type.
 */
export type Translate = (key: string) => string;

/** Fixed render order. Groups not listed here never render. */
export const GROUP_ORDER: CommandGroupKey[] = ["recent", "pages", "actions", "servers"];

export interface Command {
  /** Stable, unique, and safe to persist in localStorage. */
  id: string;
  group: CommandGroupKey;
  title: string;
  subtitle?: string;
  /** Icon name understood by shared/components/Icon.tsx */
  icon: string;
  /** Extra text folded into matching but never displayed. */
  keywords?: string;
  /** In-app navigation target (TanStack route path). */
  to?: string;
  params?: Record<string, string>;
  /** External link. Mutually exclusive with `to`. */
  href?: string;
  /** Imperative action. Mutually exclusive with `to` and `href`. */
  onSelect?: () => void;
}

export interface CommandGroup {
  key: CommandGroupKey;
  commands: Command[];
  /** Total available before capping — drives the "N more" affordance. */
  total: number;
}

/**
 * Rows rendered per group, before the "N more" affordance takes over.
 *
 * Pages and actions are deliberately uncapped: both are small, bounded,
 * already permission-filtered sets, and capping them would mean opening the
 * palette on an empty query showed only 5 of the 18 pages — breaking the
 * primary navigation use case. Servers and (later) record groups are unbounded
 * and do get capped.
 */
export const DEFAULT_GROUP_CAP = 5;

export const GROUP_CAPS: Partial<Record<CommandGroupKey, number>> = {
  pages: Number.POSITIVE_INFINITY,
  actions: Number.POSITIVE_INFINITY,
};

export function capFor(key: CommandGroupKey): number {
  return GROUP_CAPS[key] ?? DEFAULT_GROUP_CAP;
}
