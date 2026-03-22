import { Outlet, Link, useParams, useMatchRoute } from "@tanstack/react-router";

const tabs = [
  { path: "/guild/$guildId/rules" as const, label: "Rules" },
  { path: "/guild/$guildId/tempvoice" as const, label: "TempVoice" },
  { path: "/guild/$guildId/music" as const, label: "Music" },
  { path: "/guild/$guildId/settings" as const, label: "Settings" },
  { path: "/guild/$guildId/logs" as const, label: "Logs" },
];

export function GuildLayout() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const matchRoute = useMatchRoute();

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="text-text-muted transition hover:text-text"
        >
          &larr; Back
        </Link>
      </div>

      <nav className="mb-6 flex gap-0 border-b-2 border-border">
        {tabs.map((tab) => {
          const isActive = !!matchRoute({
            to: tab.path,
            params: { guildId },
          });
          return (
            <Link
              key={tab.path}
              to={tab.path}
              params={{ guildId }}
              className={`-mb-[2px] border-b-2 px-5 py-2.5 text-sm transition hover:no-underline ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
