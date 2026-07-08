import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { DirectionProvider } from "@radix-ui/react-direction";
import { i18nReady } from "./shared/lib/i18n";
import { AppDirectionContext, useDirectionState } from "./shared/hooks/useDirection";
import { PageSkeleton } from "./shared/ui/skeletons";
// Shell components load eagerly — they are needed for the first paint.
import { RootLayout } from "./routes/__root";
import { IndexPage } from "./routes/index";
import { GuildLayout } from "./routes/guild/$guildId";
import "./styles.css";

/**
 * Wraps a dynamically-imported page in its own Suspense boundary so that only
 * the content area (inside the guild layout's <Outlet />) shows a skeleton
 * while the route chunk loads — the sidebar and top bar stay mounted.
 * Each call becomes a separate Vite chunk, keeping the initial bundle small.
 */
function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  const LazyComponent = lazy(loader);
  return function LazyPage() {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <LazyComponent />
      </Suspense>
    );
  };
}

const OverviewPage = lazyPage(() =>
  import("./routes/guild/$guildId/overview").then((m) => ({ default: m.OverviewPage })),
);
const RulesPage = lazyPage(() =>
  import("./routes/guild/$guildId/rules").then((m) => ({ default: m.RulesPage })),
);
const TempVoicePage = lazyPage(() =>
  import("./routes/guild/$guildId/tempvoice").then((m) => ({ default: m.TempVoicePage })),
);
const SettingsPage = lazyPage(() =>
  import("./routes/guild/$guildId/settings").then((m) => ({ default: m.SettingsPage })),
);
const LogsPage = lazyPage(() =>
  import("./routes/guild/$guildId/logs").then((m) => ({ default: m.LogsPage })),
);
const MusicPage = lazyPage(() =>
  import("./routes/guild/$guildId/music").then((m) => ({ default: m.MusicPage })),
);
const WarningsPage = lazyPage(() =>
  import("./routes/guild/$guildId/warnings").then((m) => ({ default: m.WarningsPage })),
);
const ModerationPage = lazyPage(() =>
  import("./routes/guild/$guildId/moderation").then((m) => ({ default: m.ModerationPage })),
);
const WelcomePage = lazyPage(() =>
  import("./routes/guild/$guildId/welcome").then((m) => ({ default: m.WelcomePage })),
);
const RolesPage = lazyPage(() =>
  import("./routes/guild/$guildId/roles").then((m) => ({ default: m.RolesPage })),
);
const LevelingPage = lazyPage(() =>
  import("./routes/guild/$guildId/leveling").then((m) => ({ default: m.LevelingPage })),
);
const ScheduledMessagesPage = lazyPage(() =>
  import("./routes/guild/$guildId/scheduled").then((m) => ({ default: m.ScheduledMessagesPage })),
);
const SecurityPage = lazyPage(() =>
  import("./routes/guild/$guildId/security").then((m) => ({ default: m.SecurityPage })),
);
const TicketsPage = lazyPage(() =>
  import("./routes/guild/$guildId/tickets").then((m) => ({ default: m.TicketsPage })),
);
const GiveawaysPage = lazyPage(() =>
  import("./routes/guild/$guildId/giveaways").then((m) => ({ default: m.GiveawaysPage })),
);
const SuggestionsPage = lazyPage(() =>
  import("./routes/guild/$guildId/suggestions").then((m) => ({ default: m.SuggestionsPage })),
);
const StarboardPage = lazyPage(() =>
  import("./routes/guild/$guildId/starboard").then((m) => ({ default: m.StarboardPage })),
);
const CommandsPage = lazyPage(() =>
  import("./routes/guild/$guildId/commands").then((m) => ({ default: m.CommandsPage })),
);
const PermissionsPage = lazyPage(() =>
  import("./routes/guild/$guildId/permissions").then((m) => ({ default: m.PermissionsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const guildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guild/$guildId",
  component: GuildLayout,
});

const guildIndexRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/guild/$guildId/overview", params });
  },
});

const overviewRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/overview",
  component: OverviewPage,
});

const rulesRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/rules",
  component: RulesPage,
});

const tempvoiceRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/tempvoice",
  component: TempVoicePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/settings",
  component: SettingsPage,
});

const logsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/logs",
  component: LogsPage,
});

const musicRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/music",
  component: MusicPage,
});

const warningsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/warnings",
  component: WarningsPage,
});

const moderationRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/moderation",
  component: ModerationPage,
});

const welcomeRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/welcome",
  component: WelcomePage,
});

const rolesRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/roles",
  component: RolesPage,
});

const levelingRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/leveling",
  component: LevelingPage,
});

const scheduledRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/scheduled",
  component: ScheduledMessagesPage,
});

const securityRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/security",
  component: SecurityPage,
});

const ticketsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/tickets",
  component: TicketsPage,
});

const giveawaysRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/giveaways",
  component: GiveawaysPage,
});

const suggestionsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/suggestions",
  component: SuggestionsPage,
});

const starboardRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/starboard",
  component: StarboardPage,
});

const commandsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/commands",
  component: CommandsPage,
});

const permissionsRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/permissions",
  component: PermissionsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  guildRoute.addChildren([
    guildIndexRoute,
    overviewRoute,
    rulesRoute,
    tempvoiceRoute,
    musicRoute,
    warningsRoute,
    moderationRoute,
    welcomeRoute,
    rolesRoute,
    levelingRoute,
    scheduledRoute,
    securityRoute,
    ticketsRoute,
    giveawaysRoute,
    suggestionsRoute,
    starboardRoute,
    commandsRoute,
    permissionsRoute,
    settingsRoute,
    logsRoute,
  ]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App({ initialDir }: { initialDir: "ltr" | "rtl" }) {
  const direction = useDirectionState(initialDir);

  return (
    <AppDirectionContext.Provider value={direction}>
      <DirectionProvider dir={direction.dir}>
        <Suspense fallback={null}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </Suspense>
      </DirectionProvider>
    </AppDirectionContext.Provider>
  );
}

// Wait for i18n to load before rendering
i18nReady.then(async (i18n) => {
  // Set initial document direction based on detected language
  const { isRtl } = await import("@fluxcore/i18n");
  const initialDir = isRtl(i18n.language) ? "rtl" : "ltr";
  document.documentElement.dir = initialDir;
  document.documentElement.lang = i18n.language;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App initialDir={initialDir as "ltr" | "rtl"} />
      </I18nextProvider>
    </StrictMode>,
  );
});
