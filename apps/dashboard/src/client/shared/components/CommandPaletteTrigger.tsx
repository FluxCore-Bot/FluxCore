import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { useCommandPalette } from "../command-palette/useCommandPalette";

/**
 * Apple platforms render ⌘; everything else renders Ctrl. Read once at module
 * scope — the platform cannot change during a session, and `navigator` is
 * absent under SSR/node, so it falls back to the Ctrl label.
 */
const IS_APPLE =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandPaletteTrigger() {
  const { t } = useTranslation();
  const { open } = useCommandPalette();

  /*
   * Shaped like a search field rather than an icon button. A bare glyph with a
   * 10px shortcut beside it read as "some icon action" and hid the one feature
   * that has to be discoverable; the field shape plus a visible label is the
   * convention users already know from other tools.
   *
   * Below `sm` it collapses to the icon alone to stay out of a crowded mobile
   * nav, and the 44px minimum hit area holds at both sizes.
   */
  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("palette.open")}
      className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-low px-2.5 text-text-secondary transition-colors hover:border-outline-variant hover:bg-surface-container hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 sm:px-3"
    >
      <Icon name="search" size={16} className="shrink-0" />
      {/* text-start, not text-left — this nav mirrors in RTL. */}
      <span className="hidden flex-1 truncate text-start text-sm sm:inline">
        {t("palette.open")}
      </span>
      <kbd className="hidden shrink-0 rounded border border-border bg-surface-high px-1.5 py-0.5 font-mono text-xs sm:inline">
        {IS_APPLE ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
