import { useTranslation } from "react-i18next";
import { Icon } from "../Icon";

const featureKeys = [
  { icon: "bolt", key: "automation" },
  { icon: "library_music", key: "music" },
  { icon: "settings_voice", key: "tempVoice" },
  { icon: "description", key: "logs" },
  { icon: "webhook", key: "webhooks" },
  { icon: "dashboard", key: "dashboard" },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation("landing");
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 section-label text-accent">
            {t("features.label")}
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-text md:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto max-w-lg text-text-muted">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featureKeys.map((feature) => (
            <div
              key={feature.key}
              className="group rounded-lg bg-surface-low p-6 transition-all duration-300 hover:bg-surface-high glass-edge"
            >
              <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-2.5">
                <Icon name={feature.icon} className="text-accent" size={22} />
              </div>
              <h3 className="mb-2 text-base font-semibold tracking-tight text-text">
                {t(`features.${feature.key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {t(`features.${feature.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
