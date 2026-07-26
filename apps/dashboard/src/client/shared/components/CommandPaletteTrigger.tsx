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

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t("palette.open")}
      className="flex min-h-11 items-center gap-2 rounded-md px-2 text-text-muted transition-colors hover:bg-surface-high hover:text-text sm:px-3"
    >
      <Icon name="search" size={18} />
      <kbd className="hidden font-mono text-[0.625rem] text-text-muted sm:inline">
        {IS_APPLE ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
