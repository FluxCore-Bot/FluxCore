import { describe, it, expect } from "vitest";
import {
  welcomeVariables,
  customCommandVariables,
  levelingVariables,
  tempvoiceVariables,
  knownTokenSet,
  buildRealData,
  buildTokenValues,
} from "../../../../../src/client/shared/ui/variable-field/registry";
import { WELCOME_VARIABLES } from "@fluxcore/systems/welcome/constants";
import { TEMPLATE_VARIABLES as CUSTOM_CMD_VARS } from "@fluxcore/systems/customCommands/variables";

describe("registry drift guard", () => {
  it("welcome descriptors match the canonical WELCOME_VARIABLES tokens exactly", () => {
    expect(new Set(welcomeVariables.map((v) => v.token))).toEqual(new Set(Object.keys(WELCOME_VARIABLES)));
  });
  it("custom-command descriptors match the canonical customCommands TEMPLATE_VARIABLES tokens", () => {
    expect(new Set(customCommandVariables.map((v) => v.token))).toEqual(new Set(Object.keys(CUSTOM_CMD_VARS)));
  });
  it("leveling exposes {user} and {level}", () => {
    expect(levelingVariables.map((v) => v.token).sort()).toEqual(["{level}", "{user}"]);
  });
  it("tempvoice exposes at least {user}", () => {
    expect(tempvoiceVariables.map((v) => v.token)).toContain("{user}");
  });
});

describe("knownTokenSet", () => {
  it("collects tokens into a Set", () => {
    expect(knownTokenSet(levelingVariables).has("{level}")).toBe(true);
  });
});

describe("buildRealData", () => {
  it("uses real guild/user data and builds CDN URLs", () => {
    const real = buildRealData(
      { id: "42", name: "Acme", icon: "abc" },
      { userId: "7", username: "Ada", avatar: "def" },
    );
    expect(real.serverName).toBe("Acme");
    expect(real.serverIcon).toBe("https://cdn.discordapp.com/icons/42/abc.png");
    expect(real.userName).toBe("Ada");
    expect(real.userMention).toBe("@Ada");
    expect(real.userAvatar).toBe("https://cdn.discordapp.com/avatars/7/def.png");
    expect(real.memberCount).toBe("1,234"); // sample: not available client-side
  });
  it("falls back to defaults when data is missing", () => {
    const real = buildRealData(undefined, undefined);
    expect(real.serverName).toBe("My Server");
    expect(real.userName).toBe("User");
    expect(real.userAvatar).toBe("https://cdn.discordapp.com/embed/avatars/0.png");
  });
});

describe("buildTokenValues", () => {
  it("maps real values where realKey is set and samples otherwise", () => {
    const real = buildRealData({ id: "42", name: "Acme", icon: null }, undefined);
    const map = buildTokenValues(welcomeVariables, real);
    expect(map.get("{server}")).toBe("Acme");
    expect(map.get("{membercount}")).toBe("1,234");
  });
});
