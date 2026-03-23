import { useState, useCallback } from "react";
import { Outlet, Link, useParams } from "@tanstack/react-router";
import { useAuth } from "../lib/hooks/useAuth";
import { Toaster } from "../components/ui/sonner";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { RefreshDataWidget } from "../components/RefreshDataWidget";
import { MobileSidebarContext } from "../lib/hooks/useMobileSidebar";

export function RootLayout() {
  const { data: user } = useAuth();
  const params = useParams({ strict: false }) as { guildId?: string };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggle = useCallback(() => setSidebarOpen((o) => !o), []);
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <MobileSidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          {/* Only show nav when authenticated */}
          {user && (
            <nav className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border/50 bg-surface-low px-3 text-sm font-medium tracking-tight shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)] sm:px-6">
              <div className="flex items-center gap-3 sm:gap-8">
                {/* Hamburger — visible only on mobile when inside a guild */}
                {params.guildId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={toggle}
                    aria-label="Toggle sidebar"
                  >
                    <Icon name="menu" />
                  </Button>
                )}
                <Link to="/" className="text-lg font-bold tracking-tighter text-text hover:no-underline">
                  FluxCore
                </Link>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Notifications">
                      <Icon name="notifications" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Settings" className="hidden sm:inline-flex">
                      <Icon name="settings" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
                {params.guildId && <RefreshDataWidget guildId={params.guildId} />}
                <Separator orientation="vertical" className="mx-1 h-8 hidden sm:block sm:mx-2" />
                <span className="hidden text-text/60 sm:inline">{user.username}</span>
                <a
                  href="/auth/logout"
                  className="rounded px-2 py-1.5 text-text/60 transition-colors hover:bg-surface-high hover:text-text sm:px-3"
                >
                  Logout
                </a>
              </div>
            </nav>
          )}
          <main className="flex-1">
            <Outlet />
          </main>
          <Toaster position="bottom-right" />
        </div>
      </TooltipProvider>
    </MobileSidebarContext.Provider>
  );
}
