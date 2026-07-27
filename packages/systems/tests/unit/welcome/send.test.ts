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

const MEMBER_ID = "member-1";
const LOCK = { parse: [], users: [MEMBER_ID] };

describe("plain message style", () => {
  it("sends content and files with no embeds key", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome <@1>!", embed: EMBED, files: ["img"], sendMode: "with", memberId: MEMBER_ID,
    });
    expect(msgs).toEqual([{ content: "Welcome <@1>!", files: ["img"], allowedMentions: LOCK }]);
    expect(msgs[0]).not.toHaveProperty("embeds");
  });

  it("sends the image alone when content is whitespace only", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "   ", embed: EMBED, files: ["img"], sendMode: "with", memberId: MEMBER_ID,
    });
    expect(msgs).toEqual([{ files: ["img"] }]);
  });

  it("sends text alone when image generation produced nothing", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "Welcome!", embed: EMBED, files: [], sendMode: "with", memberId: MEMBER_ID,
    });
    expect(msgs).toEqual([{ content: "Welcome!", allowedMentions: LOCK }]);
  });

  it("sends nothing when both content and files are empty", () => {
    expect(buildSendPayloads({
      style: "plain", content: "", embed: EMBED, files: [], sendMode: "with", memberId: MEMBER_ID,
    })).toEqual([]);
  });

  it("ignores sendMode entirely", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      const msgs = buildSendPayloads({
        style: "plain", content: "Hi", embed: EMBED, files: ["img"], sendMode, memberId: MEMBER_ID,
      });
      expect(msgs, sendMode).toEqual([{ content: "Hi", files: ["img"], allowedMentions: LOCK }]);
    }
  });

  it("truncates content to Discord's 2000-character limit", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "x".repeat(2500), embed: EMBED, files: [], sendMode: "with", memberId: MEMBER_ID,
    });
    expect(msgs[0]!.content).toHaveLength(2000);
  });

  // Finding 2 — plain-mode content used to be sent with no allowedMentions
  // restriction at all. Every other moderator-authored template path in
  // this codebase locks it (see messageCreate.ts's level-up announcement);
  // plain welcome/farewell content was the one gap, and it's now the
  // default style for new guilds. An admin writing "@everyone welcome
  // {user}!" must not be able to ping the whole server on every join.
  it("locks allowedMentions to just the member, blocking @everyone/@here/roles", () => {
    const msgs = buildSendPayloads({
      style: "plain",
      content: "@everyone welcome <@member-1>!",
      embed: EMBED,
      files: [],
      sendMode: "with",
      memberId: MEMBER_ID,
    });
    expect(msgs[0]!.allowedMentions).toEqual({ parse: [], users: [MEMBER_ID] });
  });

  it("scopes the mention lock to the specific member id passed in", () => {
    const msgs = buildSendPayloads({
      style: "plain", content: "hi", embed: EMBED, files: [], sendMode: "with", memberId: "some-other-id",
    });
    expect(msgs[0]!.allowedMentions).toEqual({ parse: [], users: ["some-other-id"] });
  });

  // Finding 3 — content.slice(0, 2000) is a raw UTF-16 code-unit cut. When
  // variable substitution (which runs AFTER the dashboard's 2000-char
  // stored-template cap) pushes the result past 2000 and the cut point
  // lands inside a surrogate pair, Discord gets handed a lone surrogate.
  // "😀" (U+1F600) is a two-code-unit grapheme; place it straddling the
  // boundary so a naive slice(0, 2000) would bisect it.
  it("truncates on a grapheme boundary instead of splitting a surrogate pair", () => {
    const emoji = "\u{1F600}"; // 😀 — one grapheme, two UTF-16 code units
    const content = "x".repeat(1999) + emoji + "y".repeat(10);

    // Sanity check on the fixture itself: a naive code-unit slice does
    // exactly what this test guards against — it cuts the emoji in half.
    const naiveSlice = content.slice(0, 2000);
    expect(naiveSlice.charCodeAt(naiveSlice.length - 1)).toBeGreaterThanOrEqual(0xd800);
    expect(naiveSlice.charCodeAt(naiveSlice.length - 1)).toBeLessThanOrEqual(0xdbff);

    const msgs = buildSendPayloads({
      style: "plain", content, embed: EMBED, files: [], sendMode: "with", memberId: MEMBER_ID,
    });
    const result = msgs[0]!.content!;

    expect(result.length).toBeLessThanOrEqual(2000);
    // The whole emoji must be dropped rather than bisected — including it
    // would push the result to 2001 code units.
    expect(result).toBe("x".repeat(1999));
    const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    expect(LONE_SURROGATE.test(result)).toBe(false);
  });
});

describe("embed message style is unchanged", () => {
  it("sends embed and files together for sendMode=with", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "with", memberId: MEMBER_ID,
    })).toEqual([{ embeds: [EMBED], files: ["img"] }]);
  });

  it("sends only the image for sendMode=only", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "only", memberId: MEMBER_ID,
    })).toEqual([{ files: ["img"] }]);
  });

  it("sends image then embed for sendMode=before", () => {
    expect(buildSendPayloads({
      style: "embed", content: "", embed: EMBED, files: ["img"], sendMode: "before", memberId: MEMBER_ID,
    })).toEqual([{ files: ["img"] }, { embeds: [EMBED] }]);
  });

  it("falls back to the embed alone when there is no image", () => {
    for (const sendMode of ["with", "before", "only"] as const) {
      expect(buildSendPayloads({
        style: "embed", content: "", embed: EMBED, files: [], sendMode, memberId: MEMBER_ID,
      }), sendMode).toEqual([{ embeds: [EMBED], files: [] }]);
    }
  });

  it("ignores content in embed mode", () => {
    const msgs = buildSendPayloads({
      style: "embed", content: "ignored", embed: EMBED, files: [], sendMode: "with", memberId: MEMBER_ID,
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
    // Finding 2 end-to-end: the joining member's real id drives the lock,
    // taken from `member.id` inside deliverWelcomeMessage itself.
    expect(payload.allowedMentions).toEqual({ parse: [], users: ["member-1"] });
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
    expect(payload.allowedMentions).toEqual({ parse: [], users: ["member-1"] });
  });
});
