import { describe, it, expect } from "vitest";
import { canManageGuild } from "../../../src/server/shared/guildPermissions.js";

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);
const SEND_MESSAGES = BigInt(0x800);

describe("canManageGuild", () => {
  it("accepts users with the Manage Server permission", () => {
    expect(canManageGuild(MANAGE_GUILD.toString())).toBe(true);
  });

  it("accepts users with only the Administrator permission", () => {
    // An admin-only role: Administrator set, Manage Server not explicitly set.
    expect(canManageGuild(ADMINISTRATOR.toString())).toBe(true);
  });

  it("accepts a fully-expanded admin bitfield", () => {
    // Discord may return all bits set for admins/owners.
    const allBits = ((BigInt(1) << BigInt(49)) - BigInt(1)).toString();
    expect(canManageGuild(allBits)).toBe(true);
  });

  it("rejects users without Administrator or Manage Server", () => {
    expect(canManageGuild(SEND_MESSAGES.toString())).toBe(false);
    expect(canManageGuild("0")).toBe(false);
  });
});
