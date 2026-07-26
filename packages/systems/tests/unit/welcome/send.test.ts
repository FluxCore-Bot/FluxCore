import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WelcomeMember } from "../../../src/welcome/types.js";

vi.mock("@fluxcore/utils", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGenerateWelcomeImage = vi.fn().mockResolvedValue(Buffer.from("fake-image"));
const mockCreateStorageAdapter = vi.fn().mockReturnValue({});
vi.mock("../../../src/welcome/image/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/welcome/image/index.js")>();
  return {
    ...actual,
    // Keep the real sanitizeDisplayName — it's exactly what this file is
    // proving gets applied uniformly. Only the (slow, canvas-backed)
    // renderer and storage adapter are stubbed.
    generateWelcomeImage: (...args: unknown[]) => mockGenerateWelcomeImage(...args),
    createStorageAdapter: (...args: unknown[]) => mockCreateStorageAdapter(...args),
  };
});

const { buildSendPayloads, deliverWelcomeMessage } = await import("../../../src/welcome/send.js");
const { DEFAULT_WELCOME_IMAGE_SETTINGS } = await import("../../../src/welcome/image/constants.js");

const EMBED = { title: "Welcome" };

describe("plain message style", () => {
  it("sends content and files with no embeds key", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome <@1>!", embed: EMBED, files: ["img"], sendMode: "with",
    });
    expect(msgs).toEqual([{ content: "Welcome <@1>!", files: ["img"] }]);
    expect(msgs[0]).not.toHaveProperty("embeds");
  });

  it("sends the image alone when content is whitespace only", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "   ", embed: EMBED, files: ["img"], sendMode: "with",
    });
    expect(msgs).toEqual([{ files: ["img"] }]);
  });

  it("sends text alone when image generation produced nothing", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome!", embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs).toEqual([{ content: "Welcome!" }]);
  });

  it("sends nothing when both content and files are empty", () => {
    expect(buildSendPayloads({
      style: "plain", content: "", embed: EMBED, files: [], sendMode: "with",
    })).toEqual([]);
  });

  it("ignores sendMode entirely", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      const msgs = buildSendPayloads({
        style: "plain", content: "Hi", embed: EMBED, files: ["img"], sendMode,
      });
      expect(msgs, sendMode).toEqual([{ content: "Hi", files: ["img"] }]);
    }
  });

  it("truncates content to Discord's 2000-character limit", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "x".repeat(2500), embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs[0]!.content).toHaveLength(2000);
  });
});

describe("embed message style is unchanged", () => {
  it("sends embed and files together for sendMode=with", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "with",
    })).toEqual([{ embeds: [EMBED], files: ["img"] }]);
  });

  it("sends only the image for sendMode=only", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "only",
    })).toEqual([{ files: ["img"] }]);
  });

  it("sends image then embed for sendMode=before", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "before",
    })).toEqual([{ files: ["img"] }, { embeds: [EMBED] }]);
  });

  it("falls back to the embed alone when there is no image", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      expect(buildSendPayloads({
        style: "embed", content: "", embed: EMBED, files: [], sendMode,
      }), sendMode).toEqual([{ embeds: [EMBED], files: [] }]);
    }
  });

  it("ignores content in embed mode", () => {
    const msgs = buildSendPayloads({
      style: "embed", content: "ignored", embed: EMBED, files: [], sendMode: "with",
    });
    expect(msgs[0]).not.toHaveProperty("content");
  });
});

// --- deliverWelcomeMessage test doubles ---
//
// WelcomeMember (types.ts) and the private MessageSink interface (send.ts)
// are narrow structural types — exactly the fields deliverWelcomeMessage's
// dependencies read, not discord.js's GuildMember/SendableChannels (each a
// large class/union with dozens of members nothing here touches). A real
// GuildMember/channel satisfies them for free in production, and here a
// bare object literal satisfies them for free too — no `as` cast needed at
// either end.
function mockMember(
  overrides: Partial<{ username: string; displayName: string; guildName: string }> = {},
): WelcomeMember {
  const { username = "Alice", displayName = username, guildName = "Test Server" } = overrides;
  return {
    id: "member-1",
    displayName,
    user: {
      tag: "Alice#0001",
      username,
      displayAvatarURL: () => "https://cdn.example.com/avatar.png",
    },
    guild: {
      id: "guild-1",
      name: guildName,
      memberCount: 10,
      iconURL: () => null,
    },
  };
}

function mockChannel() {
  const send = vi.fn().mockResolvedValue(undefined);
  return { channel: { send }, send };
}

describe("deliverWelcomeMessage sanitisation", () => {
  // Zero-width spaces + an RTL override — the same hostile-name shape used
  // by tests/events/welcome-sanitize.test.ts for the join path.
  const ZERO_WIDTH = "\u200B";
  const RTL_OVERRIDE = "\u202E";
  const HOSTILE = `a${ZERO_WIDTH}`.repeat(50) + `${RTL_OVERRIDE}evil\u202D`;

  beforeEach(() => {
    mockGenerateWelcomeImage.mockClear();
  });

  it("sanitizes names on the welcome (join) path", async () => {
    const { channel } = mockChannel();
    await deliverWelcomeMessage({
      channel,
      member: mockMember({ username: HOSTILE, displayName: HOSTILE, guildName: HOSTILE }),
      style: "embed",
      content: "",
      embedConfig: {},
      imageEnabled: true,
      imageSettings: DEFAULT_WELCOME_IMAGE_SETTINGS,
      attachmentName: "welcome.png",
      label: "welcome",
    });

    expect(mockGenerateWelcomeImage).toHaveBeenCalledTimes(1);
    const call = mockGenerateWelcomeImage.mock.calls[0]![0];
    expect(call.member.username).not.toContain(ZERO_WIDTH);
    expect(call.member.username).not.toContain(RTL_OVERRIDE);
    expect(call.member.displayName).not.toContain(ZERO_WIDTH);
    expect(call.guild.name).not.toContain(ZERO_WIDTH);
  });

  it("sanitizes names on the farewell (leave) path identically", async () => {
    const { channel } = mockChannel();
    await deliverWelcomeMessage({
      channel,
      member: mockMember({ username: HOSTILE, displayName: HOSTILE, guildName: HOSTILE }),
      style: "embed",
      content: "",
      embedConfig: {},
      imageEnabled: true,
      imageSettings: DEFAULT_WELCOME_IMAGE_SETTINGS,
      attachmentName: "farewell.png",
      label: "farewell",
    });

    expect(mockGenerateWelcomeImage).toHaveBeenCalledTimes(1);
    const call = mockGenerateWelcomeImage.mock.calls[0]![0];
    expect(call.member.username).not.toContain(ZERO_WIDTH);
    expect(call.member.username).not.toContain(RTL_OVERRIDE);
    expect(call.member.displayName).not.toContain(ZERO_WIDTH);
    expect(call.guild.name).not.toContain(ZERO_WIDTH);
  });

  it("skips rendering entirely when the image is disabled", async () => {
    const { channel, send } = mockChannel();
    await deliverWelcomeMessage({
      channel,
      member: mockMember(),
      style: "embed",
      content: "",
      embedConfig: { title: "Bye" },
      imageEnabled: false,
      imageSettings: DEFAULT_WELCOME_IMAGE_SETTINGS,
      attachmentName: "farewell.png",
      label: "farewell",
    });

    expect(mockGenerateWelcomeImage).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

// --- deliverWelcomeMessage: the plain-style feature, proven end to end ---
//
// The three tests above all use style: "embed" with content: "" — none of
// them exercise the headline feature of this task (plain-mode variable
// substitution into the message actually posted). These drive
// deliverWelcomeMessage in plain style and assert on the literal object
// handed to channel.send, not just a call count.
describe("deliverWelcomeMessage plain style end-to-end", () => {
  beforeEach(() => {
    mockGenerateWelcomeImage.mockClear();
  });

  it("substitutes {user} into a real mention, carries files, and omits embeds", async () => {
    const { channel, send } = mockChannel();
    await deliverWelcomeMessage({
      channel,
      member: mockMember(),
      style: "plain",
      content: "Welcome {user} to {server}!",
      embedConfig: { title: "never built in plain style" },
      imageEnabled: true,
      imageSettings: DEFAULT_WELCOME_IMAGE_SETTINGS,
      attachmentName: "welcome.png",
      label: "welcome",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.content).toBe("Welcome <@member-1> to Test Server!");
    expect(payload.files).toHaveLength(1);
    expect(payload).not.toHaveProperty("embeds");
  });

  it("posts text only, with no files key, when the image is disabled", async () => {
    const { channel, send } = mockChannel();
    await deliverWelcomeMessage({
      channel,
      member: mockMember(),
      style: "plain",
      content: "Bye {user}, {server} will miss you.",
      embedConfig: {},
      imageEnabled: false,
      imageSettings: DEFAULT_WELCOME_IMAGE_SETTINGS,
      attachmentName: "farewell.png",
      label: "farewell",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.content).toBe("Bye <@member-1>, Test Server will miss you.");
    expect(payload).not.toHaveProperty("files");
    expect(payload).not.toHaveProperty("embeds");
  });
});
