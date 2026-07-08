import { useTranslation } from "react-i18next";
import { Icon } from "../../shared/components/Icon";

export function Footer() {
  const { t } = useTranslation("landing");

  return (
    <footer className="border-t border-outline-variant/10 bg-bg px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <Icon name="bolt" className="text-accent" size={16} />
          <span className="font-bold tracking-tighter text-text">{t("footer.brand")}</span>
        </div>
        <p className="text-xs text-text-tertiary">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
