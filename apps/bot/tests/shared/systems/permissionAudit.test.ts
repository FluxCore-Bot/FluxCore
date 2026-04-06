import { describe, it, expect, vi, beforeEach } from "vitest";
import { Collection, PermissionsBitField, PermissionFlagsBits } from "discord.js";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

import { auditPermissions } from "../../../src/shared/systems/permissionAudit.js";

function createMockGuild({
  name = "Test Guild",
  hasAllPerms = true,
  hasBotMember = true,
}: {
  name?: string;
  hasAllPerms?: boolean;
  hasBotMember?: boolean;
} = {}) {
  const permissions = hasAllPerms
    ? new PermissionsBitField(PermissionFlagsBits.Administrator)
    : new PermissionsBitField();

  return {
    name,
    members: {
      me: hasBotMember ? { permissions } : null,
    },
  };
}

function createMockClient(guilds: ReturnType<typeof createMockGuild>[]) {
  const cache = new Collection<string, unknown>();
  guilds.forEach((g, i) => cache.set(`guild-${i}`, g));
  return {
    guilds: { cache },
  };
}

describe("auditPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs without errors for guilds with all permissions", () => {
    const client = createMockClient([createMockGuild()]);

    expect(() => auditPermissions(client as never)).not.toThrow();
  });

  it("runs without errors for guilds with missing permissions", () => {
    const client = createMockClient([
      createMockGuild({ hasAllPerms: false }),
    ]);

    expect(() => auditPermissions(client as never)).not.toThrow();
  });

  it("handles guild where bot member is null", () => {
    const client = createMockClient([
      createMockGuild({ hasBotMember: false }),
    ]);

    expect(() => auditPermissions(client as never)).not.toThrow();
  });

  it("handles multiple guilds", () => {
    const client = createMockClient([
      createMockGuild({ name: "Guild A" }),
      createMockGuild({ name: "Guild B", hasAllPerms: false }),
      createMockGuild({ name: "Guild C", hasBotMember: false }),
    ]);

    expect(() => auditPermissions(client as never)).not.toThrow();
  });

  it("handles empty guild list", () => {
    const client = createMockClient([]);

    expect(() => auditPermissions(client as never)).not.toThrow();
  });
});
