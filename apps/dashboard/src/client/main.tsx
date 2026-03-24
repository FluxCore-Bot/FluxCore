import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootLayout } from "./routes/__root";
import { IndexPage } from "./routes/index";
import { GuildLayout } from "./routes/guild/$guildId";
import { RulesPage } from "./routes/guild/$guildId/rules";
import { TempVoicePage } from "./routes/guild/$guildId/tempvoice";
import { SettingsPage } from "./routes/guild/$guildId/settings";
import { LogsPage } from "./routes/guild/$guildId/logs";
import { MusicPage } from "./routes/guild/$guildId/music";
import { OverviewPage } from "./routes/guild/$guildId/overview";
import { ModerationPage } from "./routes/guild/$guildId/moderation";
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

const moderationRoute = createRoute({
  getParentRoute: () => guildRoute,
  path: "/moderation",
  component: ModerationPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  guildRoute.addChildren([
    guildIndexRoute,
    overviewRoute,
    rulesRoute,
    tempvoiceRoute,
    musicRoute,
    moderationRoute,
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
