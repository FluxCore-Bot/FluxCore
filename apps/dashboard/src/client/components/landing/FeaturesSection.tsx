import { Icon } from "../Icon";

const features = [
  {
    icon: "bolt",
    title: "Automation Rules",
    description:
      "Create complex event-driven workflows without code. If-this-then-that triggers with 23 event types and 10 action types.",
  },
  {
    icon: "library_music",
    title: "Music System",
    description:
      "High-fidelity audio streaming with multi-platform support. Queue management, DJ controls, and library mode.",
  },
  {
    icon: "settings_voice",
    title: "TempVoice",
    description:
      "Dynamic voice channel management. Auto-creation with custom naming templates, permissions, and cleanup.",
  },
  {
    icon: "description",
    title: "Activity Logs",
    description:
      "Full audit trail of every automation execution. Search, filter, and debug your rules with detailed logs.",
  },
  {
    icon: "webhook",
    title: "Webhooks & API",
    description:
      "Send data to external services with HTTP webhooks. Custom headers, body templates, and variable interpolation.",
  },
  {
    icon: "dashboard",
    title: "Real-time Dashboard",
    description:
      "Manage everything from a sleek web dashboard. Analytics, configuration, and monitoring in one place.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Capabilities
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-text md:text-4xl">
            Everything your server needs
          </h2>
          <p className="mx-auto max-w-lg text-text-muted">
            A modular toolkit designed for communities that demand reliability, flexibility, and control.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-lg bg-surface-low p-6 transition-all duration-300 hover:bg-surface-high glass-edge"
            >
              <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-2.5">
                <Icon name={feature.icon} className="text-accent" size={22} />
              </div>
              <h3 className="mb-2 text-base font-semibold tracking-tight text-text">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
