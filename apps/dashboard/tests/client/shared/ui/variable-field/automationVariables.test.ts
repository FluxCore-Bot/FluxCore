import { describe, it, expect } from "vitest";
import { buildAutomationVariables } from "../../../../../src/client/shared/ui/variable-field/automationVariables";

const constants = {
  eventTypeVariables: {
    memberJoin: ["{user}", "{guild}", "{guild.memberCount}"],
    memberBanned: ["{user}", "{ban.reason}"],
  },
  templateVariables: {
    "{user}": "User mention (e.g. @User)",
    "{guild}": "Server name",
    "{guild.memberCount}": "Server member count",
    "{ban.reason}": "Ban reason",
  },
};

describe("buildAutomationVariables", () => {
  it("returns descriptors for the event's tokens with descriptions from templateVariables", () => {
    const vars = buildAutomationVariables(constants, "memberJoin");
    expect(vars.map((v) => v.token)).toEqual(["{user}", "{guild}", "{guild.memberCount}"]);
    expect(vars[0].description).toBe("User mention (e.g. @User)");
    expect(vars.find((v) => v.token === "{guild}")?.realKey).toBe("serverName");
  });
  it("includes event-only tokens like {ban.reason} for memberBanned", () => {
    expect(buildAutomationVariables(constants, "memberBanned").map((v) => v.token)).toContain("{ban.reason}");
  });
  it("excludes {ban.reason} for memberJoin (event scoping)", () => {
    expect(buildAutomationVariables(constants, "memberJoin").map((v) => v.token)).not.toContain("{ban.reason}");
  });
  it("returns [] for an unknown event type", () => {
    expect(buildAutomationVariables(constants, "nope")).toEqual([]);
  });
});
