import { Outlet, useParams } from "@tanstack/react-router";
import { Sidebar } from "../../components/Sidebar";
import { RefreshDataWidget } from "../../components/RefreshDataWidget";

export function GuildLayout() {
  const { guildId } = useParams({ from: "/guild/$guildId" });

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <Sidebar guildId={guildId} />
      <main className="ml-60 w-full min-h-full">
        <div className="mx-auto max-w-5xl p-8">
          <div className="mb-4 flex justify-end">
            <RefreshDataWidget guildId={guildId} />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
