import { Outlet, Link } from "@tanstack/react-router";
import { useAuth } from "../lib/hooks/useAuth";
import { Toaster } from "../components/ui/sonner";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";

export function RootLayout() {
  const { data: user } = useAuth();

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* Only show nav when authenticated */}
        {user && (
          <nav className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border/50 bg-surface-low px-6 text-sm font-medium tracking-tight shadow-[0px_1px_0px_0px_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-lg font-bold tracking-tighter text-text hover:no-underline">
                FluxCore
              </Link>
            </div>
            <div className="flex items-center gap-2">
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
                  <Button variant="ghost" size="icon" aria-label="Settings">
                    <Icon name="settings" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mx-2 h-8" />
              <span className="text-text/60">{user.username}</span>
              <a
                href="/auth/logout"
                className="rounded px-3 py-1.5 text-text/60 transition-colors hover:bg-surface-high hover:text-text"
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
  );
}
