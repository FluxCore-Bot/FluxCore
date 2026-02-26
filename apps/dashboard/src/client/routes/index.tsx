import { useAuth } from "../lib/hooks/useAuth";
import { useGuilds } from "../lib/hooks/useGuilds";
import { GuildCard } from "../components/GuildCard";

export function IndexPage() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: guilds, isLoading: guildsLoading } = useGuilds(!!user);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center pt-32">
        <h2 className="mb-4 text-2xl font-semibold">FluxCore Dashboard</h2>
        <p className="mb-6 text-text-muted">
          Manage your Discord bot settings
        </p>
        <a
          href="/auth/login"
          className="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Login with Discord
        </a>
      </div>
    );
  }

  if (guildsLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <h2 className="mb-6 text-xl font-semibold">Your Servers</h2>
        <p className="text-text-muted">Loading servers...</p>
      </div>
    );
  }

  if (!guilds || guilds.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <h2 className="mb-6 text-xl font-semibold">Your Servers</h2>
        <p className="text-center text-text-muted py-10">
          No servers found. Make sure the bot is added to a server where you
          have the Manage Server permission.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8">
      <h2 className="mb-6 text-xl font-semibold">Your Servers</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {guilds.map((guild) => (
          <GuildCard key={guild.id} guild={guild} />
        ))}
      </div>
    </div>
  );
}
