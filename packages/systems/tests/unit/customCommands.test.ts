import { describe, it, expect, vi } from "vitest";

vi.mock("@fluxcore/config", () => ({
  config: {
    token: "test-token",
    clientId: "test-client-id",
    logLevel: "info",
  },
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

const { matchesTrigger, isAllowed } = await import(
  "../../src/customCommands/matcher.js"
);

const { replaceVariables } = await import(
  "../../src/customCommands/variables.js"
);

function makeCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    guildId: "guild-1",
    name: "hello",
    triggerType: "command" as const,
    response: { type: "text" as const, content: "Hi!" },
    actions: [],
    enabled: true,
    cooldown: 0,
    allowedRoles: [] as string[],
    allowedChannels: [] as string[],
    deletesTrigger: false,
    dmResponse: false,
    createdBy: "user-1",
    createdAt: new Date(),
    ...overrides,
  };
}

// --- matchesTrigger ---
describe("matchesTrigger", () => {
  describe("command trigger", () => {
    it("matches exact !command", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "command" });
      expect(matchesTrigger(cmd, "!hello")).toBe(true);
    });

    it("is case insensitive", () => {
      const cmd = makeCommand({ name: "Hello", triggerType: "command" });
      expect(matchesTrigger(cmd, "!hello")).toBe(true);
      expect(matchesTrigger(cmd, "!HELLO")).toBe(true);
    });

    it("does not match without prefix", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "command" });
      expect(matchesTrigger(cmd, "hello")).toBe(false);
    });

    it("does not match partial", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "command" });
      expect(matchesTrigger(cmd, "!helloworld")).toBe(false);
    });
  });

  describe("keyword trigger", () => {
    it("matches when keyword is contained", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "keyword" });
      expect(matchesTrigger(cmd, "oh hello there")).toBe(true);
    });

    it("is case insensitive", () => {
      const cmd = makeCommand({ name: "Hello", triggerType: "keyword" });
      expect(matchesTrigger(cmd, "HELLO WORLD")).toBe(true);
    });

    it("does not match when keyword is absent", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "keyword" });
      expect(matchesTrigger(cmd, "goodbye world")).toBe(false);
    });
  });

  describe("startsWith trigger", () => {
    it("matches when message starts with trigger", () => {
      const cmd = makeCommand({ name: "!info", triggerType: "startsWith" });
      expect(matchesTrigger(cmd, "!info about the server")).toBe(true);
    });

    it("does not match when trigger is in the middle", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "startsWith" });
      expect(matchesTrigger(cmd, "say hello")).toBe(false);
    });
  });

  describe("regex trigger", () => {
    it("matches a valid regex pattern", () => {
      const cmd = makeCommand({ name: "hel+o", triggerType: "regex" });
      expect(matchesTrigger(cmd, "hellllo world")).toBe(true);
    });

    it("is case insensitive", () => {
      const cmd = makeCommand({ name: "hello", triggerType: "regex" });
      expect(matchesTrigger(cmd, "HELLO")).toBe(true);
    });

    it("returns false for invalid regex", () => {
      const cmd = makeCommand({ name: "[invalid", triggerType: "regex" });
      expect(matchesTrigger(cmd, "anything")).toBe(false);
    });

    it("does not match when pattern does not match", () => {
      const cmd = makeCommand({ name: "^hello$", triggerType: "regex" });
      expect(matchesTrigger(cmd, "say hello")).toBe(false);
    });
  });

  describe("unknown trigger type", () => {
    it("returns false for unknown trigger type", () => {
      const cmd = makeCommand({ triggerType: "unknown" });
      expect(matchesTrigger(cmd, "anything")).toBe(false);
    });
  });
});

// --- isAllowed ---
describe("isAllowed", () => {
  it("allows all when no restrictions set", () => {
    const cmd = makeCommand({ allowedRoles: [], allowedChannels: [] });
    expect(isAllowed(cmd, ["role-1"], "channel-1")).toBe(true);
  });

  it("allows when channel is in allowed list", () => {
    const cmd = makeCommand({ allowedChannels: ["channel-1", "channel-2"] });
    expect(isAllowed(cmd, ["role-1"], "channel-1")).toBe(true);
  });

  it("denies when channel is not in allowed list", () => {
    const cmd = makeCommand({ allowedChannels: ["channel-1"] });
    expect(isAllowed(cmd, ["role-1"], "channel-99")).toBe(false);
  });

  it("allows when member has an allowed role", () => {
    const cmd = makeCommand({ allowedRoles: ["role-1", "role-2"] });
    expect(isAllowed(cmd, ["role-2", "role-3"], "channel-1")).toBe(true);
  });

  it("denies when member lacks allowed roles", () => {
    const cmd = makeCommand({ allowedRoles: ["role-1"] });
    expect(isAllowed(cmd, ["role-99"], "channel-1")).toBe(false);
  });

  it("checks both channel and role restrictions", () => {
    const cmd = makeCommand({
      allowedChannels: ["channel-1"],
      allowedRoles: ["role-1"],
    });
    // Wrong channel
    expect(isAllowed(cmd, ["role-1"], "channel-99")).toBe(false);
    // Wrong role
    expect(isAllowed(cmd, ["role-99"], "channel-1")).toBe(false);
    // Both correct
    expect(isAllowed(cmd, ["role-1"], "channel-1")).toBe(true);
  });
});

// --- replaceVariables ---
describe("replaceVariables", () => {
  const context = {
    userId: "123456",
    username: "TestUser",
    serverName: "Test Server",
    channelId: "ch-1",
    channelName: "general",
    memberCount: 42,
  };

  it("replaces {user} with mention", () => {
    expect(replaceVariables("Hello {user}!", context)).toBe(
      "Hello <@123456>!",
    );
  });

  it("replaces {username} with display name", () => {
    expect(replaceVariables("Hi {username}", context)).toBe("Hi TestUser");
  });

  it("replaces {userId}", () => {
    expect(replaceVariables("ID: {userId}", context)).toBe("ID: 123456");
  });

  it("replaces {server}", () => {
    expect(replaceVariables("Welcome to {server}", context)).toBe(
      "Welcome to Test Server",
    );
  });

  it("replaces {channel}", () => {
    expect(replaceVariables("In {channel}", context)).toBe("In <#ch-1>");
  });

  it("replaces {channelName}", () => {
    expect(replaceVariables("In #{channelName}", context)).toBe(
      "In #general",
    );
  });

  it("replaces {memberCount}", () => {
    expect(replaceVariables("Members: {memberCount}", context)).toBe(
      "Members: 42",
    );
  });

  it("replaces multiple variables in one string", () => {
    expect(
      replaceVariables(
        "Hey {user}, welcome to {server}! We have {memberCount} members.",
        context,
      ),
    ).toBe(
      "Hey <@123456>, welcome to Test Server! We have 42 members.",
    );
  });

  it("replaces multiple occurrences of the same variable", () => {
    expect(replaceVariables("{user} {user}", context)).toBe(
      "<@123456> <@123456>",
    );
  });

  it("returns string unchanged if no variables", () => {
    expect(replaceVariables("No variables here", context)).toBe(
      "No variables here",
    );
  });
});
