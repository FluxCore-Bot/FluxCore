import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

const MODULE_TAGS: { name: string; description: string }[] = [
  { name: "Meta", description: "Server-level metadata and health endpoints." },
  { name: "Auth", description: "Discord OAuth login, callback, session and logout." },
  { name: "Guilds", description: "Guild listing, metadata and manual refresh." },
  { name: "TempVoice", description: "Temporary voice channel configuration." },
  { name: "Actions", description: "Event-driven automation rules and actions." },
  { name: "Discord", description: "Discord-side lookups (channels, roles, guild state)." },
  { name: "Music", description: "Music player settings and queue management." },
  { name: "Logging", description: "Audit/event logging configuration." },
  { name: "Moderation", description: "Moderation settings and case management." },
  { name: "Warnings", description: "Warning issuance, listing and removal." },
  { name: "Welcome", description: "Welcome/farewell messages, images and auto-roles." },
  { name: "RolePanels", description: "Reaction/button role panel management." },
  { name: "Leveling", description: "XP/leveling configuration and rewards." },
  { name: "ScheduledMessages", description: "Scheduled announcement messages." },
  { name: "CustomCommands", description: "Server-defined custom slash commands." },
  { name: "AntiRaid", description: "Anti-raid / raid-protection configuration." },
  { name: "Tickets", description: "Support ticket system configuration." },
  { name: "Giveaways", description: "Giveaway creation and management." },
  { name: "Suggestions", description: "Suggestion system configuration." },
  { name: "Starboard", description: "Starboard configuration." },
  { name: "DashboardPermissions", description: "Dashboard staff permissions and roles." },
  { name: "DashboardRoles", description: "Dashboard role definitions and assignments." },
];

/**
 * Register the official Fastify Swagger plugins and the shared schema
 * components. Must be called BEFORE routes are registered so the swagger
 * `onRoute` hook captures every route.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "FluxCore Dashboard API",
        description:
          "HTTP API for the FluxCore Discord bot admin dashboard.\n\n" +
          "Authentication uses a signed `session` cookie. Interactive \"Try it out\" " +
          "for mutating endpoints may be blocked by CSRF protection; use GET endpoints " +
          "to explore the API.",
        version: "1.0.0",
      },
      tags: MODULE_TAGS,
      components: {
        securitySchemes: {
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "session",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      tryItOutEnabled: true,
    },
  });
}
