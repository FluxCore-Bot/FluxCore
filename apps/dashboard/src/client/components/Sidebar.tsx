import { Link, useMatchRoute } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { useBotInfo } from "../lib/hooks/useBotInfo";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: "/guild/$guildId/overview", label: "Overview", icon: "dashboard" },
  { path: "/guild/$guildId/rules", label: "Automation", icon: "bolt" },
  { path: "/guild/$guildId/music", label: "Music", icon: "library_music" },
  { path: "/guild/$guildId/tempvoice", label: "TempVoice", icon: "settings_voice" },
  { path: "/guild/$guildId/welcome", label: "Welcome", icon: "waving_hand" },
  { path: "/guild/$guildId/moderation", label: "Moderation", icon: "shield" },
  { path: "/guild/$guildId/warnings", label: "Warnings", icon: "warning" },
  { path: "/guild/$guildId/roles", label: "Role Panels", icon: "badge" },
  { path: "/guild/$guildId/leveling", label: "Leveling", icon: "trending_up" },
  { path: "/guild/$guildId/scheduled", label: "Scheduled", icon: "schedule" },
  { path: "/guild/$guildId/commands", label: "Commands", icon: "terminal" },
  { path: "/guild/$guildId/security", label: "Security", icon: "security" },
  { path: "/guild/$guildId/tickets", label: "Tickets", icon: "confirmation_number" },
  { path: "/guild/$guildId/giveaways", label: "Giveaways", icon: "celebration" },
  { path: "/guild/$guildId/suggestions", label: "Suggestions", icon: "lightbulb" },
  { path: "/guild/$guildId/starboard", label: "Starboard", icon: "star" },
  { path: "/guild/$guildId/logs", label: "Logs", icon: "description" },
  { path: "/guild/$guildId/settings", label: "Settings", icon: "tune" },
];

interface SidebarProps {
  guildId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ guildId, isOpen, onClose }: SidebarProps) {
  const matchRoute = useMatchRoute();
  const { data: botInfo } = useBotInfo();

  return (
    <aside
      className={`fixed left-0 top-14 z-50 flex h-[calc(100vh-56px)] w-60 flex-col border-r border-border bg-bg p-4 text-sm tracking-tight transition-transform duration-300 lg:z-auto lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Close button — mobile only */}
      <button
        onClick={onClose}
        className="mb-2 flex items-center justify-end lg:hidden"
        aria-label="Close sidebar"
      >
        <Icon name="close" size={20} className="text-text/50" />
      </button>

      {/* Brand */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-hover">
          <Icon name="bolt" filled />
        </div>
        <div>
          <h1 className="font-label font-bold leading-none text-accent">FluxCore Engine</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            <span className="section-label text-text-muted">Online</span>
            <span className="section-label text-text-muted/50">|</span>
            <span className="font-mono text-[0.625rem] text-text-muted">{botInfo?.latency ?? "—"}ms</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-1">
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
                    ? "bg-surface-high font-semibold text-accent shadow-[0px_0px_12px_0px_rgba(163,166,255,0.1)]"
                    : "text-text/50 hover:bg-surface-high/50 hover:text-text"
                }`}
              >
                <Icon name={item.icon} filled={isActive} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="mt-auto space-y-4 pt-4">
        <Separator />

        {botInfo?.inviteUrl && (
          <a
            href={botInfo.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/15"
          >
            <Icon name="add_circle" size={16} />
            Add to Server
          </a>
        )}

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
  );
}
