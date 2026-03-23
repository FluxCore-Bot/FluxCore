import { useAuth } from "../lib/hooks/useAuth";
import { useGuilds } from "../lib/hooks/useGuilds";
import { useBotInfo } from "../lib/hooks/useBotInfo";
import { GuildCard } from "../components/GuildCard";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { LandingPage } from "../components/landing/LandingPage";
import { Skeleton } from "../components/ui/skeleton";

export function IndexPage() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: guilds, isLoading: guildsLoading } = useGuilds(!!user);
  const { data: botInfo } = useBotInfo();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (guildsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-2 text-4xl font-semibold tracking-tight">Your Servers</h1>
        <p className="mb-8 text-lg text-text-muted">Loading servers...</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!guilds || guilds.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-2 text-4xl font-semibold tracking-tight">Your Servers</h1>
        <p className="text-lg text-text-muted">Choose a server to manage and configure.</p>
        <div className="py-12">
          <EmptyState
            icon="dns"
            title="No servers found"
            description="Make sure the bot is added to a server where you have the Manage Server permission."
            action={
              botInfo?.inviteUrl && (
                <a
                  href={botInfo.inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Icon name="add_circle" size={16} />
                  Add to Server
                </a>
              )
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your Servers</h1>
          <p className="text-base text-text-muted sm:text-lg">Choose a server to manage and configure.</p>
        </div>
        {botInfo?.inviteUrl && (
          <a
            href={botInfo.inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Icon name="add_circle" size={16} />
            Add to Server
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {guilds.map((guild) => (
          <GuildCard key={guild.id} guild={guild} />
        ))}
      </div>
    </div>
  );
}
