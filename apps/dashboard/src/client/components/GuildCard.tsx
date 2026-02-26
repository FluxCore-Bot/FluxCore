import { Link } from "@tanstack/react-router";
import type { Guild } from "../lib/schemas";

function guildIconUrl(guild: Guild): string | null {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

export function GuildCard({ guild }: { guild: Guild }) {
  return (
    <Link
      to="/guild/$guildId/rules"
      params={{ guildId: guild.id }}
      className="flex flex-col items-center rounded-lg border border-border bg-surface p-5 text-center transition hover:border-accent hover:no-underline"
    >
      {guild.icon ? (
        <img
          src={guildIconUrl(guild)!}
          alt={guild.name}
          className="mb-2 h-16 w-16 rounded-full"
        />
      ) : (
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-border text-2xl">
          {guild.name.charAt(0)}
        </div>
      )}
      <span className="text-sm font-medium text-text">{guild.name}</span>
    </Link>
  );
}
