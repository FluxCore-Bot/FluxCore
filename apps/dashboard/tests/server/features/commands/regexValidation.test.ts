import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: { token: "t", clientId: "c", dashboardSessionSecret: "s", logLevel: "info" },
}));

vi.mock("../../../../src/server/shared/session.js", () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    username: "u",
    guilds: [{ id: "guild-1", name: "T", permissions: BigInt(0x20).toString() }],
  }),
  touchSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../src/server/shared/discordApi.js", () => ({
  isBotInGuild: vi.fn().mockResolvedValue(true),
  getGuildOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));
vi.mock("../../../../src/server/shared/permissions.js", () => ({
  resolveUserPermissions: vi.fn().mockResolvedValue({ permissions: new Set(["*"]), isOwner: true }),
  hasPermission: vi.fn().mockReturnValue(true),
  invalidatePermissionCache: vi.fn(),
  createDashboardAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@fluxcore/systems/customCommands/persistence", () => ({
  getCustomCommands: vi.fn().mockResolvedValue([]),
  getCustomCommandCount: vi.fn().mockResolvedValue(0),
  createCustomCommand: vi.fn().mockResolvedValue({ id: 1 }),
  updateCustomCommand: vi.fn().mockResolvedValue({ id: 1 }),
  deleteCustomCommand: vi.fn(),
}));
vi.mock("@fluxcore/systems/customCommands/constants", () => ({
  MAX_COMMANDS_PER_GUILD: 100,
  TRIGGER_TYPES: ["exact", "startsWith", "contains", "regex"],
}));
vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import { registerCustomCommandRoutes } from "../../../../src/server/features/commands/routes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyCookie, { secret: "test-secret" });
  registerCustomCommandRoutes(app);
  await app.ready();
  return app;
}

describe("POST /custom-commands — regex safety", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("rejects catastrophic backtracking pattern (a+)+$", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "(a+)+$", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/unsafe|regex/i);
  });

  it("rejects nested quantifier pattern (a*)*", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "(a*)*", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts a simple safe regex", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/guilds/guild-1/custom-commands",
      cookies: { session: app.signCookie("valid") },
      payload: { name: "^hello", triggerType: "regex" },
    });
    expect(res.statusCode).toBe(201);
  });
});
