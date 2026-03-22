import { useAuth } from "../lib/hooks/useAuth";
import { useGuilds } from "../lib/hooks/useGuilds";
import { GuildCard } from "../components/GuildCard";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/ui/skeleton";

export function IndexPage() {
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: guilds, isLoading: guildsLoading } = useGuilds(!!user);

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
    return (
      <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="mb-10 text-center">
            <div className="mb-6 inline-flex items-center justify-center">
              <div className="rounded-lg bg-surface-high p-3 shadow-[0px_0px_20px_0px_rgba(163,166,255,0.1)] glass-edge">
                <Icon name="bolt" className="text-accent" size={36} />
              </div>
            </div>
            <h1 className="mb-2 text-3xl font-extrabold tracking-tighter text-text">FluxCore</h1>
            <p className="text-sm font-medium text-text-muted">The obsidian engine for next-gen automation.</p>
          </div>

          {/* Login Card */}
          <div className="rounded-lg bg-surface-low p-8 shadow-2xl glass-edge">
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-lg font-semibold tracking-tight text-text">Welcome back</h2>
                <p className="mt-1 text-sm text-text-muted">Manage your servers with the most powerful bot framework.</p>
              </div>

              <a
                href="/auth/login"
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-md bg-discord font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              >
                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.006 14.006 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
                </svg>
                <span className="tracking-tight">Sign in with Discord</span>
              </a>

              {/* Security Badge */}
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-surface-lowest px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="font-label text-[10px] font-bold uppercase tracking-[0.15em] text-accent">Secure Auth Gateway</span>
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-outline-variant/5 bg-surface-lowest/30 p-4">
              <Icon name="shield" className="mb-2 block text-xl text-accent" />
              <h3 className="mb-1 text-xs font-semibold">Privacy Focused</h3>
              <p className="text-[11px] leading-relaxed text-text-muted">We only request minimum necessary scopes to function.</p>
            </div>
            <div className="rounded-lg border border-outline-variant/5 bg-surface-lowest/30 p-4">
              <Icon name="terminal" className="mb-2 block text-xl text-secondary" />
              <h3 className="mb-1 text-xs font-semibold">Developer Ready</h3>
              <p className="text-[11px] leading-relaxed text-text-muted">Instant API key generation after first login.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 bg-bg py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon name="bolt" className="text-accent" size={16} />
              <span className="font-bold tracking-tighter text-text">FluxCore</span>
            </div>
            <p className="text-xs text-text/40">© 2024 FluxCore Technologies. All rights reserved.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-8">
            {["Documentation", "Support", "Privacy Policy", "API", "GitHub"].map((link) => (
              <a key={link} href="#" className="text-xs text-text/40 underline-offset-4 transition-colors hover:text-text hover:underline">
                {link}
              </a>
            ))}
          </nav>
        </div>
      </footer>
      </div>
    );
  }

  if (guildsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
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
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-2 text-4xl font-semibold tracking-tight">Your Servers</h1>
        <p className="text-lg text-text-muted">Choose a server to manage and configure.</p>
        <div className="py-12">
          <EmptyState
            icon="dns"
            title="No servers found"
            description="Make sure the bot is added to a server where you have the Manage Server permission."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-12">
        <h1 className="mb-2 text-4xl font-semibold tracking-tight">Your Servers</h1>
        <p className="text-lg text-text-muted">Choose a server to manage and configure.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {guilds.map((guild) => (
          <GuildCard key={guild.id} guild={guild} />
        ))}
      </div>
    </div>
  );
}
