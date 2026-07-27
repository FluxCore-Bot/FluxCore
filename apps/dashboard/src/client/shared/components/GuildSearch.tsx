import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { Icon } from "./Icon";
import type { Guild } from "../lib/schemas";

/**
 * Case-insensitive substring match on the guild name. Purely client-side — the
 * full list is already in memory, so there is nothing to debounce or refetch.
 */
export function filterGuilds(guilds: Guild[], query: string): Guild[] {
  const q = query.trim().toLowerCase();
  if (!q) return guilds;
  return guilds.filter((g) => g.name.toLowerCase().includes(q));
}

export function GuildSearch({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
}) {
  const { t } = useTranslation("guilds");

  return (
    <div className="mb-6">
      <div className="relative max-w-sm">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        {/*
          Overrides the default recessed `surface-lowest` fill. At field width
          on a page of raised cards, a pure-black rectangle with no border reads
          as a hole punched through the layout rather than as an input. The
          tonal lift plus a visible edge matches the command palette trigger, so
          the two search affordances look like the same control.
        */}
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          data-testid="guild-search"
          className="h-10 rounded-lg border-border bg-surface-low ps-9 placeholder:text-text-secondary"
        />
      </div>
      {/*
        Announce the filtered count to screen readers as the user types.
        The interpolation is deliberately named `total`, not `count`: passing
        `count` makes i18next resolve plural suffixes, which would require the
        right categories (_few/_many/...) in all 48 locales. This phrasing needs
        none.
      */}
      <p aria-live="polite" role="status" className="sr-only">
        {t("search.resultCount", { total: resultCount })}
      </p>
    </div>
  );
}
