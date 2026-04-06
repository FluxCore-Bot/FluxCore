import { useTranslation } from "react-i18next";
import { Icon } from "../../shared/components/Icon";
import { useBotInfo } from "../../shared/hooks/useBotInfo";

export function HeroSection() {
  const { t } = useTranslation("landing");
  const { data: botInfo } = useBotInfo();
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-4 py-20 sm:min-h-[90vh] sm:px-6 sm:py-32">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute right-1/4 top-2/3 h-[400px] w-[400px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-surface-low px-4 py-2 glass-edge">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="section-label text-accent">
            {t("hero.badge")}
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-extrabold leading-[1.1] tracking-tighter text-text md:text-7xl">
          {t("hero.titleLine1")}
          <br />
          <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
            {t("hero.titleLine2")}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-text-muted md:text-xl">
          {t("hero.subtitle")}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          {botInfo?.inviteUrl && (
            <a
              href={botInfo.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex h-12 items-center gap-2.5 rounded-lg bg-accent px-8 font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            >
              <Icon name="add_circle" size={18} />
              {t("cta.addToServer")}
            </a>
          )}
          <a
            href="/auth/login"
            className="inline-flex h-12 items-center gap-2.5 rounded-lg border border-outline-variant/20 bg-surface-low px-8 font-semibold text-text transition-all duration-200 hover:bg-surface-high active:scale-[0.98]"
          >
            <Icon name="bolt" size={18} />
            {t("cta.openDashboard")}
          </a>
          <a
            href="#features"
            className="inline-flex h-12 items-center gap-2.5 rounded-lg border border-outline-variant/20 bg-surface-low/50 px-8 font-semibold text-text-secondary transition-all duration-200 hover:bg-surface-high active:scale-[0.98]"
          >
            <Icon name="explore" size={18} />
            {t("cta.exploreFeatures")}
          </a>
        </div>

        {/* Stats strip */}
        <div className="mt-12 grid grid-cols-2 gap-6 text-text-tertiary sm:mt-16 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-8 md:gap-12">
          {[
            { value: t("stats.serversValue"), label: t("stats.servers") },
            { value: t("stats.latencyValue"), label: t("stats.latency") },
            { value: t("stats.uptimeValue"), label: t("stats.uptime") },
            { value: t("stats.modulesValue"), label: t("stats.modules") },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-mono text-xl font-bold text-text-secondary sm:text-2xl">{stat.value}</p>
              <p className="section-label">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
