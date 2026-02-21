import { describe, it, expect, vi } from "vitest";

// Mock config to avoid needing real env vars
vi.mock("../../src/config/index.js", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    guildId: undefined,
    logLevel: "info",
  },
}));

import {
  checkPermissions,
  checkBotPermissions,
  isAboveTarget,
} from "../../src/utils/permissions.js";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

function createMockInteraction({
  memberPermissions = new PermissionsBitField(),
  botPermissions = new PermissionsBitField(),
  hasMember = true,
  hasGuild = true,
}: {
  memberPermissions?: PermissionsBitField;
  botPermissions?: PermissionsBitField;
  hasMember?: boolean;
  hasGuild?: boolean;
} = {}) {
  const reply = vi.fn();
  return {
    member: hasMember
      ? { permissions: memberPermissions }
      : null,
    guild: hasGuild
      ? {
          members: {
            me: { permissions: botPermissions },
          },
        }
      : null,
    reply,
    _reply: reply,
  } as unknown as Parameters<typeof checkPermissions>[0] & { _reply: ReturnType<typeof vi.fn> };
}

describe("checkPermissions", () => {
  it("returns true when user has required permissions", async () => {
    const interaction = createMockInteraction({
      memberPermissions: new PermissionsBitField([
        PermissionFlagsBits.BanMembers,
      ]),
    });

    const result = await checkPermissions(interaction, [
      PermissionFlagsBits.BanMembers,
    ]);

    expect(result).toBe(true);
    expect(interaction._reply).not.toHaveBeenCalled();
  });

  it("returns false and replies when user lacks permissions", async () => {
    const interaction = createMockInteraction({
      memberPermissions: new PermissionsBitField(),
    });

    const result = await checkPermissions(interaction, [
      PermissionFlagsBits.BanMembers,
    ]);

    expect(result).toBe(false);
    expect(interaction._reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("returns false when member is null (DM context)", async () => {
    const interaction = createMockInteraction({ hasMember: false });

    const result = await checkPermissions(interaction, [
      PermissionFlagsBits.BanMembers,
    ]);

    expect(result).toBe(false);
    expect(interaction._reply).toHaveBeenCalled();
  });
});

describe("checkBotPermissions", () => {
  it("returns true when bot has required permissions", async () => {
    const interaction = createMockInteraction({
      botPermissions: new PermissionsBitField([
        PermissionFlagsBits.KickMembers,
      ]),
    });

    const result = await checkBotPermissions(interaction, [
      PermissionFlagsBits.KickMembers,
    ]);

    expect(result).toBe(true);
    expect(interaction._reply).not.toHaveBeenCalled();
  });

  it("returns false and replies when bot lacks permissions", async () => {
    const interaction = createMockInteraction({
      botPermissions: new PermissionsBitField(),
    });

    const result = await checkBotPermissions(interaction, [
      PermissionFlagsBits.KickMembers,
    ]);

    expect(result).toBe(false);
    expect(interaction._reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("returns false when guild is null", async () => {
    const interaction = createMockInteraction({ hasGuild: false });

    const result = await checkBotPermissions(interaction, [
      PermissionFlagsBits.KickMembers,
    ]);

    expect(result).toBe(false);
    expect(interaction._reply).toHaveBeenCalled();
  });
});

describe("isAboveTarget", () => {
  function createMockMember(highestPosition: number) {
    return {
      roles: {
        highest: { position: highestPosition },
      },
    } as unknown as Parameters<typeof isAboveTarget>[0];
  }

  it("returns true when actor has higher role", () => {
    const actor = createMockMember(10);
    const target = createMockMember(5);

    expect(isAboveTarget(actor, target)).toBe(true);
  });

  it("returns false when actor has lower role", () => {
    const actor = createMockMember(5);
    const target = createMockMember(10);

    expect(isAboveTarget(actor, target)).toBe(false);
  });

  it("returns false when roles are equal (strict greater-than)", () => {
    const actor = createMockMember(5);
    const target = createMockMember(5);

    expect(isAboveTarget(actor, target)).toBe(false);
  });
});
