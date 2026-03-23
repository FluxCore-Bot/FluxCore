import { Icon } from "../Icon";
import { useBotInfo } from "../../lib/hooks/useBotInfo";

export function CTASection() {
  const { data: botInfo } = useBotInfo();
  return (
    <section className="px-6 py-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-surface-low p-12 text-center md:p-16 glass-edge">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[80px]" />
        </div>

        <div className="relative z-10">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-text md:text-4xl">
            Ready to upgrade your community?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-text-muted">
            Get started in minutes with zero configuration. Self-hosted, open-source, and completely free.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {botInfo?.inviteUrl && (
              <a
                href={botInfo.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-12 items-center gap-2.5 rounded-lg bg-accent px-8 font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                <Icon name="add_circle" size={18} />
                Add to Server
              </a>
            )}
            <a
              href="/auth/login"
              className="inline-flex h-12 items-center gap-2.5 rounded-lg border border-outline-variant/20 bg-surface-high px-8 font-semibold text-text transition-all duration-200 hover:bg-surface-hover active:scale-[0.98]"
            >
              <Icon name="bolt" size={18} />
              Open Dashboard
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
