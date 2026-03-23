import { Link } from "@tanstack/react-router";
import { Card } from "./ui/card";
import type { Guild } from "../lib/schemas";

function guildIconUrl(guild: Guild): string | null {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

export function GuildCard({ guild }: { guild: Guild }) {
  return (
    <Link
      to="/guild/$guildId/overview"
      params={{ guildId: guild.id }}
      className="hover:no-underline"
    >
      <Card className="group relative border border-transparent p-5 transition-all duration-300 hover:border-outline-variant/20">
        <div className="mb-4">
          {guild.icon ? (
            <img
              src={guildIconUrl(guild)!}
              alt={guild.name}
              className="h-16 w-16 rounded-xl border border-outline-variant/10 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-hover text-2xl font-bold text-secondary">
              {guild.name.charAt(0)}
            </div>
          )}
        </div>
        <h3 className="text-lg font-bold tracking-tight text-text transition-colors group-hover:text-accent">
          {guild.name}
        </h3>
      </Card>
    </Link>
  );
}
