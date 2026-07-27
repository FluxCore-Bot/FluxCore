import { useState, useCallback, useMemo } from "react";
import { Outlet, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../shared/hooks/useAuth";
import { useAppDirection } from "../shared/hooks/useDirection";
import { Toaster } from "../shared/ui/sonner";
import { Icon } from "../shared/components/Icon";
import { Button } from "../shared/ui/button";
import { Separator } from "../shared/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../shared/ui/tooltip";
import { RefreshDataWidget } from "../shared/components/RefreshDataWidget";
import { LanguageSwitcher } from "../shared/components/LanguageSwitcher";
import { MobileSidebarContext } from "../shared/hooks/useMobileSidebar";
import { CommandPaletteProvider } from "../shared/command-palette/useCommandPalette";
import { CommandPalette } from "../shared/command-palette/CommandPalette";
import { CommandPaletteTrigger } from "../shared/components/CommandPaletteTrigger";
import { pageCommands } from "../shared/command-palette/sources/pages";
import { serverCommands } from "../shared/command-palette/sources/servers";
import { actionCommands } from "../shared/command-palette/sources/actions";
import { useGuilds, useRefreshGuilds, useRefreshGuild } from "../shared/hooks/useGuilds";
import { useBotInfo } from "../shared/hooks/useBotInfo";
import { usePermissions } from "../features/permissions/hooks/usePermissions";
import { useRecentCommands } from "../shared/command-palette/useRecentCommands";
import type { Command } from "../shared/command-palette/types";

function AppCommandPalette({
  guildId, userId,
}: {
  guildId: string | undefined;
  userId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: guilds } = useGuilds();
  const { data: botInfo } = useBotInfo();
  const { can } = usePermissions(guildId ?? "");
  const refreshGuilds = useRefreshGuilds();
  const refreshGuild = useRefreshGuild(guildId ?? "");

  // Depend on `.mutate` itself (stable per TanStack Query — it's wrapped in
  // useCallback keyed on the mutation's internal observer, which is created
  // once via useState), not on the mutation objects `refreshGuild` /
  // `refreshGuilds`. Those objects are rebuilt with a fresh `{ ...result }`
  // spread on every render regardless of whether anything changed, so
  // depending on them would rebuild `commands` — and therefore re-render the
  // palette — on every render while it's open, defeating the memo.
  const staticCommands: Command[] = useMemo(
    () => [
      ...pageCommands({ guildId, t, can }),
      ...actionCommands({
        guildId,
        t,
        onRefreshGuild: () => refreshGuild.mutate(),
        onRefreshGuildList: () => refreshGuilds.mutate(),
        inviteUrl: botInfo?.inviteUrl ?? null,
      }),
      ...serverCommands({ guilds: guilds ?? [] }),
    ],
    [guildId, t, can, guilds, botInfo, refreshGuild.mutate, refreshGuilds.mutate],
  );

  // Recents are resolved against the static list, so they carry live titles and
  // drop out entirely once a destination stops being available. They are copies
  // re-grouped as "recent", so each one still appears in its own group too — a
  // page you visit often should be reachable from both.
  const { recent, remember } = useRecentCommands(staticCommands, userId);
  const commands: Command[] = useMemo(
    () => [...recent, ...staticCommands],
    [recent, staticCommands],
  );

  function onNavigate(command: Command) {
    // Recorded under the underlying id, which the re-grouped copy preserves.
    remember(command);
    if (command.href) {
      window.location.href = command.href;
      return;
    }
    if (command.onSelect) {
      command.onSelect();
      return;
    }
    if (command.to) {
      navigate({ to: command.to, params: command.params });
    }
  }

  return <CommandPalette commands={commands} onNavigate={onNavigate} />;
}

export function RootLayout() {
  const { t } = useTranslation();
  const { data: user } = useAuth();
  const { dir } = useAppDirection();
  const params = useParams({ strict: false }) as { guildId?: string };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggle = useCallback(() => setSidebarOpen((o) => !o), []);
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <MobileSidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
      <CommandPaletteProvider enabled={!!user}>
        <TooltipProvider>
          <div className="min-h-screen flex flex-col">
            {/* Skip to content — WCAG AA */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:inset-s-2 focus:z-100 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-surface focus:outline-none"
            >
              {t("accessibility.skipToContent")}
            </a>

            {/* Only show nav when authenticated */}
            {user && (
              <nav
                className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border/50 bg-surface-low px-3 text-sm font-medium tracking-tight shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)] sm:px-6"
                aria-label={t("brand.dashboard")}
              >
                <div className="flex items-center gap-3 sm:gap-8">
                  {/* Hamburger — visible only on mobile when inside a guild */}
                  {params.guildId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="lg:hidden"
                          onClick={toggle}
                          aria-label={t("header.toggleSidebar")}
                          aria-expanded={sidebarOpen}
                        >
                          <Icon name="menu" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("header.toggleSidebar")}</TooltipContent>
                    </Tooltip>
                  )}
                  <Link to="/" className="text-lg font-bold tracking-tighter text-text hover:no-underline">
                    {t("brand.name")}
                  </Link>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  {params.guildId && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label={t("header.settings")}
                          className="hidden sm:inline-flex"
                        >
                          <Link to="/guild/$guildId/settings" params={{ guildId: params.guildId }}>
                            <Icon name="settings" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("header.settings")}</TooltipContent>
                    </Tooltip>
                  )}
                  <CommandPaletteTrigger />
                  {params.guildId && <RefreshDataWidget guildId={params.guildId} />}
                  <Separator orientation="vertical" className="mx-1 h-8 hidden sm:block sm:mx-2" />
                  <LanguageSwitcher />
                  <Separator orientation="vertical" className="mx-1 h-8 hidden sm:block sm:mx-2" />
                  <span className="hidden text-text-muted sm:inline">{user.username}</span>
                  <a
                    href="/auth/logout"
                    className="rounded px-2 py-1.5 text-text-muted transition-colors hover:bg-surface-high hover:text-text sm:px-3"
                  >
                    {t("header.logout")}
                  </a>
                </div>
              </nav>
            )}
            {user && <AppCommandPalette guildId={params.guildId} userId={user.userId} />}
            <main id="main-content" className="flex-1" role="main">
              <Outlet />
            </main>
            <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
          </div>
        </TooltipProvider>
      </CommandPaletteProvider>
    </MobileSidebarContext.Provider>
  );
}
