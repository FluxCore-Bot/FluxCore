import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Icon } from "./Icon";
import type { Guild } from "../lib/schemas";

function guildIconUrl(guild: Guild): string | null {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

/**
 * Scope the generic bot-invite URL to one guild, so Discord opens with that
 * server already selected instead of making the user find it again.
 */
function guildInviteUrl(inviteUrl: string, guildId: string): string {
  return `${inviteUrl}&guild_id=${guildId}&disable_guild_select=true`;
}

function GuildIcon({ guild, dimmed }: { guild: Guild; dimmed: boolean }) {
  const className = dimmed ? "opacity-50" : "";

  if (guild.icon) {
    return (
      <img
        src={guildIconUrl(guild)!}
        alt=""
        className={`h-16 w-16 rounded-xl border border-outline-variant/10 object-cover shadow-lg ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-hover text-2xl font-bold text-secondary ${className}`}
    >
      {guild.name.charAt(0)}
    </div>
  );
}

/**
 * A server the user administers but has not added the bot to. The whole card is
 * an invite link preselected to this guild; it deliberately does not link into
 * the dashboard, which would 403 with `botNotInGuild`.
 */
function UninstalledGuildCard({
  guild,
  inviteUrl,
}: {
  guild: Guild;
  inviteUrl?: string;
}) {
  const { t } = useTranslation("guilds");

  const body = (
    <Card className="group relative h-full border border-dashed border-outline-variant/25 p-5 transition-all duration-300 hover:border-accent/40">
      <div className="mb-4">
        <GuildIcon guild={guild} dimmed />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-text-muted transition-colors group-hover:text-accent">
        {guild.name}
      </h3>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline">{t("badge.botNotAdded")}</Badge>
        {inviteUrl && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Icon name="add_circle" size={14} />
            {t("addBot")}
          </span>
        )}
      </div>
    </Card>
  );

  // Bot info still loading — render the card inert rather than as a dead link.
  if (!inviteUrl) {
    return (
      <div data-testid="guild-card-uninstalled" aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <a
      href={guildInviteUrl(inviteUrl, guild.id)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="guild-card-uninstalled"
      aria-label={t("addBotTo", { name: guild.name })}
      className="hover:no-underline"
    >
      {body}
    </a>
  );
}

export function GuildCard({
  guild,
  inviteUrl,
}: {
  guild: Guild;
  inviteUrl?: string;
}) {
  if (!guild.botPresent) {
    return <UninstalledGuildCard guild={guild} inviteUrl={inviteUrl} />;
  }

  return (
    <Link
      to="/guild/$guildId/overview"
      params={{ guildId: guild.id }}
      data-testid="guild-card"
      className="hover:no-underline"
    >
      <Card className="group relative h-full border border-transparent p-5 transition-all duration-300 hover:border-outline-variant/20">
        <div className="mb-4">
          <GuildIcon guild={guild} dimmed={false} />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-text transition-colors group-hover:text-accent">
          {guild.name}
        </h3>
      </Card>
    </Link>
  );
}
