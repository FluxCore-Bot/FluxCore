import { Outlet, Link, useParams, useMatchRoute } from "@tanstack/react-router";
import { Icon } from "../../components/Icon";

const navItems = [
  { path: "/guild/$guildId/rules" as const, label: "Automation", icon: "bolt" },
  { path: "/guild/$guildId/music" as const, label: "Music", icon: "library_music" },
  { path: "/guild/$guildId/tempvoice" as const, label: "TempVoice", icon: "settings_voice" },
  { path: "/guild/$guildId/logs" as const, label: "Logs", icon: "description" },
  { path: "/guild/$guildId/settings" as const, label: "Settings", icon: "tune" },
];

export function GuildLayout() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const matchRoute = useMatchRoute();

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-14 flex h-[calc(100vh-56px)] w-60 flex-col border-r border-border p-4 text-sm tracking-tight">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-hover">
            <Icon name="bolt" filled />
          </div>
          <div>
            <h1 className="font-label font-bold text-accent leading-none">FluxCore Engine</h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">Active Instance</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = !!matchRoute({
              to: item.path,
              params: { guildId },
            });
            return (
              <Link
                key={item.path}
                to={item.path}
                params={{ guildId }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 hover:no-underline ${
                  isActive
                    ? "bg-surface-high text-accent font-semibold shadow-[0px_0px_12px_0px_rgba(163,166,255,0.1)]"
                    : "text-text/50 hover:bg-surface-high/50 hover:text-text"
                }`}
              >
                <Icon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 pt-4">
          <div className="space-y-1">
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-1.5 text-xs text-text/40 transition-colors hover:text-text"
            >
              <Icon name="menu_book" size={16} />
              Docs
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-1.5 text-xs text-text/40 transition-colors hover:text-text"
            >
              <Icon name="help" size={16} />
              Support
            </a>
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-1.5 text-xs text-text/40 transition-colors hover:text-text hover:no-underline"
          >
            <Icon name="arrow_back" size={16} />
            Back to Servers
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 w-full min-h-full">
        <div className="mx-auto max-w-5xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
