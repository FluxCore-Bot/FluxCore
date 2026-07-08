import { useTranslation } from "react-i18next";
import { Icon } from "../../shared/components/Icon";

export function LandingHeader() {
  const { t } = useTranslation("landing");

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href="/"
          className="flex items-center gap-2 hover:no-underline"
          aria-label={t("footer.brand")}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-hover">
            <Icon name="bolt" filled size={18} />
          </span>
          <span className="text-lg font-bold tracking-tighter text-text">
            {t("footer.brand")}
          </span>
        </a>

        <div className="flex items-center gap-2">
          <a
            href="#features"
            className="hidden px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text sm:inline-flex"
          >
            {t("cta.exploreFeatures")}
          </a>
          <a
            href="/auth/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-bg transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            {t("cta.openDashboard")}
          </a>
        </div>
      </div>
    </header>
  );
}
