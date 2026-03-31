import { useState, useCallback } from "react";
import { Outlet, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/hooks/useAuth";
import { Toaster } from "../components/ui/sonner";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { RefreshDataWidget } from "../components/RefreshDataWidget";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { MobileSidebarContext } from "../lib/hooks/useMobileSidebar";

export function RootLayout() {
  const { t } = useTranslation();
  const { data: user } = useAuth();
  const params = useParams({ strict: false }) as { guildId?: string };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggle = useCallback(() => setSidebarOpen((o) => !o), []);
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <MobileSidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t("header.notifications")}>
                      <Icon name="notifications" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("header.notifications")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t("header.settings")} className="hidden sm:inline-flex">
                      <Icon name="settings" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("header.settings")}</TooltipContent>
                </Tooltip>
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
          <main id="main-content" className="flex-1" role="main">
            <Outlet />
          </main>
          <Toaster position="bottom-right" />
        </div>
      </TooltipProvider>
    </MobileSidebarContext.Provider>
  );
}
