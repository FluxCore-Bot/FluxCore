import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@fluxcore/database", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Test builder and constants (no DB needed)
import { buildWelcomeEmbed } from "../../src/welcome/builder.js";
import { WELCOME_VARIABLES, DEFAULT_WELCOME_EMBED, DEFAULT_FAREWELL_EMBED } from "../../src/welcome/constants.js";
import type { EmbedConfig } from "../../src/welcome/types.js";
import type { GuildMember } from "discord.js";

function createMockMember({
  id = "user-123",
  tag = "TestUser#0001",
  username = "TestUser",
  guildName = "Test Server",
  guildId = "guild-456",
  memberCount = 42,
} = {}): GuildMember {
  return {
    id,
    user: {
      id,
      tag,
      username,
      displayAvatarURL: () => "https://cdn.example.com/avatar.png",
    },
    guild: {
      id: guildId,
      name: guildName,
      memberCount,
      iconURL: () => "https://cdn.example.com/icon.png",
    },
  } as unknown as GuildMember;
}

describe("welcome builder", () => {
  it("builds embed with title and description", () => {
    const config: EmbedConfig = {
      title: "Welcome!",
      description: "Hello there",
    };
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.title).toBe("Welcome!");
    expect(embed.data.description).toBe("Hello there");
    expect(embed.data.timestamp).toBeDefined();
  });

  it("replaces {user} variable with mention", () => {
    const config: EmbedConfig = {
      description: "Welcome {user}!",
    };
    const member = createMockMember({ id: "user-123" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.description).toBe("Welcome <@user-123>!");
  });

  it("replaces {user.tag} variable", () => {
    const config: EmbedConfig = {
      description: "Hello {user.tag}",
    };
    const member = createMockMember({ tag: "CoolUser#1234" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.description).toBe("Hello CoolUser#1234");
  });

  it("replaces {user.name} variable", () => {
    const config: EmbedConfig = {
      description: "{user.name} joined",
    };
    const member = createMockMember({ username: "cooluser" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.description).toBe("cooluser joined");
  });

  it("replaces {user.id} variable", () => {
    const config: EmbedConfig = {
      footer: "ID: {user.id}",
    };
    const member = createMockMember({ id: "12345" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.footer?.text).toBe("ID: 12345");
  });

  it("replaces {user.avatar} variable", () => {
    const config: EmbedConfig = {
      thumbnail: "{user.avatar}",
    };
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.thumbnail?.url).toBe("https://cdn.example.com/avatar.png");
  });

  it("replaces {server} variable", () => {
    const config: EmbedConfig = {
      title: "Welcome to {server}!",
    };
    const member = createMockMember({ guildName: "My Guild" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.title).toBe("Welcome to My Guild!");
  });

  it("replaces {server.id} variable", () => {
    const config: EmbedConfig = {
      footer: "Server: {server.id}",
    };
    const member = createMockMember({ guildId: "g-999" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.footer?.text).toBe("Server: g-999");
  });

  it("replaces {membercount} variable", () => {
    const config: EmbedConfig = {
      description: "You are member #{membercount}",
    };
    const member = createMockMember({ memberCount: 1500 });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.description).toBe("You are member #1,500");
  });

  it("replaces {server.icon} variable", () => {
    const config: EmbedConfig = {
      thumbnail: "{server.icon}",
    };
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.thumbnail?.url).toBe("https://cdn.example.com/icon.png");
  });

  it("replaces multiple variables in the same string", () => {
    const config: EmbedConfig = {
      description: "Hey {user}, welcome to {server}! You are member #{membercount}.",
    };
    const member = createMockMember({ id: "u-1", guildName: "Fun Server", memberCount: 100 });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.description).toBe(
      "Hey <@u-1>, welcome to Fun Server! You are member #100.",
    );
  });

  it("applies variables to field names and values", () => {
    const config: EmbedConfig = {
      fields: [
        { name: "Member", value: "{user.tag}", inline: true },
        { name: "Server", value: "{server}", inline: false },
      ],
    };
    const member = createMockMember({ tag: "Test#0001", guildName: "GuildX" });
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields![0].name).toBe("Member");
    expect(embed.data.fields![0].value).toBe("Test#0001");
    expect(embed.data.fields![0].inline).toBe(true);
    expect(embed.data.fields![1].value).toBe("GuildX");
    expect(embed.data.fields![1].inline).toBe(false);
  });

  it("sets color when provided", () => {
    const config: EmbedConfig = {
      color: 0xff0000,
    };
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.color).toBe(0xff0000);
  });

  it("sets image when provided", () => {
    const config: EmbedConfig = {
      image: "https://example.com/banner.png",
    };
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.image?.url).toBe("https://example.com/banner.png");
  });

  it("handles empty embed config", () => {
    const config: EmbedConfig = {};
    const member = createMockMember();
    const embed = buildWelcomeEmbed(config, member);

    expect(embed.data.title).toBeUndefined();
    expect(embed.data.description).toBeUndefined();
    expect(embed.data.timestamp).toBeDefined();
  });

  it("skips thumbnail when URL resolves to empty string", () => {
    // Create a member with guild that has no icon
    const member = {
      id: "user-1",
      user: {
        id: "user-1",
        tag: "User#0001",
        username: "User",
        displayAvatarURL: () => "https://cdn.example.com/avatar.png",
      },
      guild: {
        id: "guild-1",
        name: "No Icon Guild",
        memberCount: 10,
        iconURL: () => null,
      },
    } as unknown as GuildMember;

    const config: EmbedConfig = {
      thumbnail: "{server.icon}",
    };

    const embed = buildWelcomeEmbed(config, member);
    // When server.icon resolves to "", thumbnail should not be set
    expect(embed.data.thumbnail).toBeUndefined();
  });
});

describe("welcome constants", () => {
  it("has all expected variables", () => {
    const expectedKeys = [
      "{user}",
      "{user.tag}",
      "{user.name}",
      "{user.id}",
      "{user.avatar}",
      "{server}",
      "{server.id}",
      "{membercount}",
      "{server.icon}",
    ];
    for (const key of expectedKeys) {
      expect(WELCOME_VARIABLES).toHaveProperty(key);
      expect(typeof WELCOME_VARIABLES[key]).toBe("function");
    }
  });

  it("DEFAULT_WELCOME_EMBED has expected shape", () => {
    expect(DEFAULT_WELCOME_EMBED.title).toBeDefined();
    expect(DEFAULT_WELCOME_EMBED.description).toBeDefined();
    expect(DEFAULT_WELCOME_EMBED.color).toBe(0xa3a6ff);
  });

  it("DEFAULT_FAREWELL_EMBED has expected shape", () => {
    expect(DEFAULT_FAREWELL_EMBED.title).toBeDefined();
    expect(DEFAULT_FAREWELL_EMBED.description).toBeDefined();
    expect(DEFAULT_FAREWELL_EMBED.color).toBe(0x6b7280);
  });
});
