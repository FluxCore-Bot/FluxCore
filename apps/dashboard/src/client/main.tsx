import { StrictMode, Suspense } from "react";
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
import { RootLayout } from "./routes/__root";
import { IndexPage } from "./routes/index";
import { GuildLayout } from "./routes/guild/$guildId";
import { RulesPage } from "./routes/guild/$guildId/rules";
import { TempVoicePage } from "./routes/guild/$guildId/tempvoice";
import { SettingsPage } from "./routes/guild/$guildId/settings";
import { LogsPage } from "./routes/guild/$guildId/logs";
import { MusicPage } from "./routes/guild/$guildId/music";
import { OverviewPage } from "./routes/guild/$guildId/overview";
import { WarningsPage } from "./routes/guild/$guildId/warnings";
import { ModerationPage } from "./routes/guild/$guildId/moderation";
import { WelcomePage } from "./routes/guild/$guildId/welcome";
import { RolesPage } from "./routes/guild/$guildId/roles";
import { LevelingPage } from "./routes/guild/$guildId/leveling";
import { ScheduledMessagesPage } from "./routes/guild/$guildId/scheduled";
import { SecurityPage } from "./routes/guild/$guildId/security";
import { TicketsPage } from "./routes/guild/$guildId/tickets";
import { GiveawaysPage } from "./routes/guild/$guildId/giveaways";
import { SuggestionsPage } from "./routes/guild/$guildId/suggestions";
import { StarboardPage } from "./routes/guild/$guildId/starboard";
import { CommandsPage } from "./routes/guild/$guildId/commands";
import { PermissionsPage } from "./routes/guild/$guildId/permissions";
import "./styles.css";

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
