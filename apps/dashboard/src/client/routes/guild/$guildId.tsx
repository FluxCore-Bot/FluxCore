import { useEffect } from "react";
import { Outlet, useParams, useLocation } from "@tanstack/react-router";
import { Sidebar } from "../../shared/components/Sidebar";
import { useMobileSidebar } from "../../shared/hooks/useMobileSidebar";

export function GuildLayout() {
  const { guildId } = useParams({ from: "/guild/$guildId" });
  const { isOpen, close } = useMobileSidebar();
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      <Sidebar guildId={guildId} isOpen={isOpen} onClose={close} />

      <main className="w-full min-h-full lg:ms-60">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
