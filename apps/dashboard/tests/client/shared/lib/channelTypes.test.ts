import { describe, it, expect } from "vitest";
import {
  CHANNEL_TYPE,
  isMessageableChannel,
  channelIconName,
} from "../../../../src/client/shared/lib/channelTypes";

/**
 * Three components each hardcoded their own idea of "a channel you can post
 * to" (`c.type === 0 || c.type === 2`), which silently excluded announcement,
 * stage and forum channels everywhere. A rule could not be scoped to an
 * announcement channel, and a Send Message action could not target one.
 */
describe("isMessageableChannel", () => {
  it("accepts every channel type a message or filter can target", () => {
    for (const type of [
      CHANNEL_TYPE.GuildText,
      CHANNEL_TYPE.GuildVoice,
      CHANNEL_TYPE.GuildAnnouncement,
      CHANNEL_TYPE.GuildStageVoice,
      CHANNEL_TYPE.GuildForum,
      CHANNEL_TYPE.GuildMedia,
    ]) {
      expect(isMessageableChannel(type), String(type)).toBe(true);
    }
  });

  it("rejects categories, which hold no messages", () => {
    expect(isMessageableChannel(CHANNEL_TYPE.GuildCategory)).toBe(false);
  });

  it("rejects unknown types rather than guessing", () => {
    expect(isMessageableChannel(999)).toBe(false);
  });
});

describe("channelIconName", () => {
  it("distinguishes voice, stage, announcement, forum and text", () => {
    const names = new Set([
      channelIconName(CHANNEL_TYPE.GuildVoice),
      channelIconName(CHANNEL_TYPE.GuildStageVoice),
      channelIconName(CHANNEL_TYPE.GuildAnnouncement),
      channelIconName(CHANNEL_TYPE.GuildForum),
      channelIconName(CHANNEL_TYPE.GuildText),
    ]);
    expect(names.size).toBe(5);
  });

  it("falls back to the text icon for anything unrecognised", () => {
    expect(channelIconName(999)).toBe(channelIconName(CHANNEL_TYPE.GuildText));
  });
});
