import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";

export function Footer() {
  const { t } = useTranslation("landing");

  const footerLinks = [
    { label: t("footer.links.documentation"), href: "#" },
    { label: t("footer.links.support"), href: "#" },
    { label: t("footer.links.privacy"), href: "#" },
    { label: t("footer.links.api"), href: "#" },
    { label: t("footer.links.github"), href: "#" },
  ];

  return (
    <footer className="border-t border-outline-variant/10 bg-bg px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon name="bolt" className="text-accent" size={16} />
            <span className="font-bold tracking-tighter text-text">{t("footer.brand")}</span>
          </div>
          <p className="text-xs text-text-tertiary">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-4 sm:gap-8">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs text-text-tertiary underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
