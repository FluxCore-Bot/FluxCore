import type { Event } from "@fluxcore/types";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { getLogConfig } from "@fluxcore/systems/logging/config";
import { createLogEntry } from "@fluxcore/systems/logging/persistence";
import { sendLogEmbed } from "@fluxcore/systems/logging/sender";
import { formatMemberLeave } from "@fluxcore/systems/logging/formatter";
import { getWelcomeConfig } from "@fluxcore/systems/welcome/config";
import { deliverWelcomeMessage } from "@fluxcore/systems/welcome/send";

const event: Event<"guildMemberRemove"> = {
  name: "guildMemberRemove",
  async execute(member: GuildMember | PartialGuildMember) {
    // === Logging ===
    if (!member.user.bot) {
      const config = await getLogConfig(member.guild.id, "member");
      if (config?.enabled) {
        const embed = formatMemberLeave(member as GuildMember);
        await sendLogEmbed(member.guild, config.channelId, embed);

        const roles = member.roles.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => r.id);

        await createLogEntry({
          guildId: member.guild.id,
          category: "member",
          eventType: "memberLeave",
          targetId: member.id,
          content: {
            tag: member.user.tag,
            roles,
            memberCount: member.guild.memberCount,
          },
        });
      }
    }

    // === Farewell ===
    const welcomeConfig = await getWelcomeConfig(member.guild.id);
    if (!welcomeConfig?.farewellEnabled || !welcomeConfig.farewellChannelId) return;
    // Runtime safety check, NOT a type-checker requirement — deliverWelcomeMessage's
    // `member` parameter is the narrow structural `WelcomeMember` interface, which
    // both GuildMember and PartialGuildMember already satisfy, so removing this
    // guard would not produce a compile error. `member` is partial only when the
    // client opts into GuildMember partials, which this bot does not (see
    // ExtendedClient.ts's intents), so this never fires in production today. Kept
    // so a farewell card is never rendered from a cache-incomplete member if that
    // ever changes — do not delete this as "dead code" just because tsc allows it.
    if (member.partial) return;

    const channel = member.guild.channels.cache.get(welcomeConfig.farewellChannelId);
    if (channel?.isTextBased() && channel.isSendable()) {
      await deliverWelcomeMessage({
        channel,
        member,
        style: welcomeConfig.farewellMessageStyle,
        content: welcomeConfig.farewellContent,
        embedConfig: welcomeConfig.farewellMessage,
        imageEnabled: welcomeConfig.farewellImageEnabled,
        imageSettings: welcomeConfig.farewellImageConfig,
        attachmentName: "farewell.png",
        label: "farewell",
      });
    }
  },
};

export default event;
