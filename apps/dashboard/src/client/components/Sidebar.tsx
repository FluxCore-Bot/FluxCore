import { Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icon";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { useBotInfo } from "../lib/hooks/useBotInfo";
import { usePermissions } from "../lib/hooks/usePermissions";

interface NavItem {
  path: string;
  /** i18n key under the "nav" namespace (e.g. "overview" -> t("nav.overview")) */
  i18nKey: string;
  icon: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { path: "/guild/$guildId/overview", i18nKey: "nav.overview", icon: "dashboard" },
  { path: "/guild/$guildId/rules", i18nKey: "nav.automation", icon: "bolt", permission: "actions.rules.view" },
  { path: "/guild/$guildId/music", i18nKey: "nav.music", icon: "library_music", permission: "music.settings.view" },
  { path: "/guild/$guildId/tempvoice", i18nKey: "nav.tempvoice", icon: "settings_voice", permission: "tempvoice.config.view" },
  { path: "/guild/$guildId/welcome", i18nKey: "nav.welcome", icon: "waving_hand", permission: "welcome.config.view" },
  { path: "/guild/$guildId/moderation", i18nKey: "nav.moderation", icon: "shield", permission: "moderation.cases.view" },
  { path: "/guild/$guildId/warnings", i18nKey: "nav.warnings", icon: "warning", permission: "moderation.warnings.view" },
  { path: "/guild/$guildId/roles", i18nKey: "nav.rolePanels", icon: "badge", permission: "roles.panels.view" },
  { path: "/guild/$guildId/leveling", i18nKey: "nav.leveling", icon: "trending_up", permission: "leveling.leaderboard.view" },
  { path: "/guild/$guildId/scheduled", i18nKey: "nav.scheduled", icon: "schedule", permission: "scheduled.messages.view" },
  { path: "/guild/$guildId/commands", i18nKey: "nav.commands", icon: "terminal", permission: "commands.list.view" },
  { path: "/guild/$guildId/security", i18nKey: "nav.security", icon: "security", permission: "security.config.view" },
  { path: "/guild/$guildId/tickets", i18nKey: "nav.tickets", icon: "confirmation_number", permission: "tickets.list.view" },
  { path: "/guild/$guildId/giveaways", i18nKey: "nav.giveaways", icon: "celebration", permission: "giveaways.list.view" },
  { path: "/guild/$guildId/suggestions", i18nKey: "nav.suggestions", icon: "lightbulb", permission: "suggestions.list.view" },
  { path: "/guild/$guildId/starboard", i18nKey: "nav.starboard", icon: "star", permission: "starboard.entries.view" },
  { path: "/guild/$guildId/logs", i18nKey: "nav.logs", icon: "description", permission: "logging.entries.view" },
  { path: "/guild/$guildId/permissions", i18nKey: "nav.permissions", icon: "admin_panel_settings", permission: "dashboard.roles.view" },
  { path: "/guild/$guildId/settings", i18nKey: "nav.settings", icon: "tune", permission: "dashboard.settings.manage" },
];

interface SidebarProps {
  guildId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ guildId, isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const { data: botInfo } = useBotInfo();
  const { can } = usePermissions(guildId);

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || can(item.permission),
  );

  return (
    <aside
      className={`fixed inset-s-0 top-14 z-50 flex h-[calc(100vh-56px)] w-60 flex-col border-e border-border bg-bg p-4 text-sm tracking-tight transition-transform duration-300 lg:z-auto lg:translate-x-0 rtl:lg:translate-x-0 ${
        isOpen
          ? "translate-x-0 rtl:translate-x-0"
          : "-translate-x-full rtl:translate-x-full"
      }`}
      aria-label={t("brand.engine")}
    >
      {/* Close button — mobile only */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClose}
            className="mb-2 flex items-center justify-end lg:hidden"
            aria-label={t("sidebar.closeSidebar")}
          >
            <Icon name="close" size={20} className="text-text-muted" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("sidebar.closeSidebar")}</TooltipContent>
      </Tooltip>

      {/* Brand */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-hover">
          <Icon name="bolt" filled />
        </div>
        <div>
          <h1 className="font-label font-bold leading-none text-accent">{t("brand.engine")}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            <span className="section-label text-text-muted">{t("status.online")}</span>
            <span className="section-label text-text-muted/50" aria-hidden="true">|</span>
            <span className="font-mono text-[0.625rem] text-text-muted">
              {t("status.latency", { ms: botInfo?.latency ?? "\u2014" })}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav aria-label={t("nav.overview")} className="pe-2">
          <ul className="space-y-1" role="list">
            {visibleNavItems.map((item) => {
              const isActive = !!matchRoute({
                to: item.path,
                params: { guildId },
              });
              const label = t(item.i18nKey);
              return (
                <li key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        params={{ guildId }}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 hover:no-underline ${
                          isActive
                            ? "bg-surface-high font-semibold text-accent shadow-[0px_0px_12px_0px_rgba(163,166,255,0.1)]"
                            : "text-text-muted hover:bg-surface-high/50 hover:text-text"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon name={item.icon} filled={isActive} />
                        <span>{label}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{label}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
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
            {t("sidebar.addToServer")}
          </a>
        )}

        <div className="space-y-1">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <Icon name="menu_book" size={16} />
            {t("sidebar.docs")}
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <Icon name="help" size={16} />
            {t("sidebar.support")}
          </a>
        </div>
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text hover:no-underline"
        >
          <Icon name="arrow_back" size={16} className="rtl:rotate-180" />
          {t("sidebar.backToServers")}
        </Link>
      </div>
    </aside>
  );
}
