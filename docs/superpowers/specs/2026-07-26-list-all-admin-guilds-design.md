# List All Admin Servers on "Your Servers" — Design Spec

**Date:** 2026-07-26
**Status:** Approved
**Branch:** `feat/dashboard-list-all-admin-guilds`

## Problem

The "Your Servers" page only lists guilds where the user is an admin **and** the
bot is already present. `buildManageableGuilds` in
[routes.ts](../../../apps/dashboard/src/server/features/guilds/routes.ts)
(lines 25–31) filters on `botPresent` and discards the rest:

```ts
return checks
  .filter((c) => c.botPresent)
  .map((c) => ({ id: c.guild.id, name: c.guild.name, icon: c.guild.icon }));
```

A user who administers five servers but has only added the bot to three sees
three cards, with no indication the other two exist or that adding the bot there
is possible. The generic "Add to Server" button sends them to Discord's guild
picker, where they must re-find the server themselves.

## Goal

List **every** server the user can manage, and mark the ones the bot has not
been added to — turning each such card into a direct, preselected invite. Since
that makes the list longer, add a client-side search over it.

## Non-goals

- No change to who may *manage* a guild. `requireGuildAdmin` keeps its
  `botNotInGuild` 403 ([middleware.ts](../../../apps/dashboard/src/server/shared/middleware.ts), line 65),
  so listing a bot-less server grants no access to it.
- No auto-detection of a completed invite. The user returns to the tab and uses
  the existing refresh button.
- No change to `canManageGuild` / the OAuth permission bits.
- No new Discord API calls (see below).

## Cost analysis

`isBotInGuild` is **already** called once per manageable guild — the result is
merely thrown away for absent bots. Returning it instead of filtering on it
changes no request count and no cache behaviour.

## Components

### 1. Server — `buildManageableGuilds`

Stop filtering; project `botPresent` onto each guild and sort.

```ts
return checks
  .map((c) => ({
    id: c.guild.id,
    name: c.guild.name,
    icon: c.guild.icon,
    botPresent: c.botPresent,
  }))
  .sort(
    (a, b) =>
      Number(b.botPresent) - Number(a.botPresent) ||
      a.name.localeCompare(b.name),
  );
```

Bot-present servers sort first so the actionable cards lead the grid; ties break
alphabetically. Guilds the user cannot manage are still excluded — that filter
is unchanged.

`GET /api/guilds` and `POST /api/guilds/refresh` both delegate here, so both
change together. Each route's OpenAPI response schema gains
`botPresent: { type: "boolean" }`.

### 2. Client — `GuildSchema`

Gains `botPresent: z.boolean()` in
[schemas.ts](../../../apps/dashboard/src/client/shared/lib/schemas.ts). Because
`GuildListSchema.parse` runs on every fetch, a server that forgot the field
fails loudly in dev rather than rendering every card as bot-less.

### 3. Client — `GuildCard`

Takes a new `inviteUrl?: string` prop and branches on `guild.botPresent`:

| `botPresent` | Renders |
| --- | --- |
| `true` | Today's `<Link to="/guild/$guildId/overview">`, unchanged |
| `false` + `inviteUrl` | `<a target="_blank" rel="noopener noreferrer">` to the invite, icon/name dimmed, "Bot not added" `Badge`, hover affordance reads "Add FluxCore" |
| `false`, no `inviteUrl` | Same card, non-interactive (no anchor) — never a dead link |

The invite URL is the existing `botInfo.inviteUrl` with
`&guild_id=<id>&disable_guild_select=true` appended, so Discord opens already
scoped to that server.

### 4. Client — `index.tsx`

Passes `inviteUrl={botInfo?.inviteUrl}` to each `GuildCard`. It already calls
`useBotInfo()` for the header button, so no new query.

The empty state now means "you administer no servers at all" rather than "the
bot is nowhere", so `empty.description` is corrected accordingly.

### 5. Client — search (`GuildSearch`)

Listing every admin server makes the grid longer, so the page gains a
client-side filter. `GuildSearch.tsx` exports two things:

- `filterGuilds(guilds, query)` — a pure, case-insensitive substring match on
  the guild name, trimming the query and preserving the server's ordering. Unit
  tested directly, with no rendering.
- `<GuildSearch>` — a controlled `Input` (`type="search"`, leading search icon)
  plus an `aria-live="polite"` region announcing the result count as the user
  types.

The whole list is already in memory, so there is nothing to debounce or refetch.
The field renders whenever the user has at least one server, rather than
appearing past a magic threshold. When a query matches nothing, the grid is
replaced by a `search.noResults` message quoting the query.

Matching is on name only — not guild ID — to keep behaviour predictable.

### 6. i18n

New keys in `guilds.json`:

- `badge.botNotAdded` — "Bot not added"
- `addBot` — "Add FluxCore"
- `addBotTo` — "Add FluxCore to {{name}}" (accessible name for the invite link)
- `search.placeholder`, `search.noResults`, `search.resultCount`

The whole `guilds` namespace is **fully translated in all 48 locales** — not
English-filled for the untranslated ones, which had been the prior precedent.
That also clears the debt already sitting in this namespace: `refresh` was
English in 39 locales, `hu` and `sk` were entirely untranslated, and `fr`/`sr`
had their diacritics stripped by an earlier pass.

`empty.description` is retranslated everywhere rather than just corrected in
`en`, because its meaning changed: an empty list now means "you administer no
servers", not "the bot isn't anywhere".

**`search.resultCount` is deliberately not pluralized.** Interpolating a
variable named `count` makes i18next resolve plural suffixes, which would
require the correct categories per language (`_few`/`_many` for ru/pl/cs,
`_zero`/`_two` for ar, and so on) — supplying only `_one`/`_other` silently
breaks those locales. The string is phrased "Servers found: {{total}}" and the
component interpolates `total`, so no plural machinery runs at all.

Because every value is authored, the locale files are written as normalized
JSON rather than surgically text-patched — there is no original formatting left
to preserve. Two guards run per locale before writing: the key shape must match
`en` exactly, and no `{{placeholder}}` may be dropped in translation.

## Testing

**`apps/dashboard/tests/server/features/guilds/guilds.test.ts`** — existing cases
assert bot-less guilds are *absent*; those invert:

- Guild with admin rights + bot absent → returned with `botPresent: false`
- Guild with admin rights + bot present → returned with `botPresent: true`
- Guild without admin rights → still excluded regardless of bot presence
- Ordering: bot-present first, then alphabetical
- `POST /api/guilds/refresh` returns the same shape

**`apps/dashboard/tests/client/shared/components/GuildCard.test.tsx`** (new) —

- `botPresent: true` → renders a router link to the guild overview, no badge
- `botPresent: false` → renders an external invite anchor carrying
  `guild_id=<id>`, plus the "Bot not added" badge
- `botPresent: false` with no `inviteUrl` → renders no anchor

**`apps/dashboard/tests/client/shared/components/GuildSearch.test.tsx`** (new) —

- `filterGuilds`: empty/whitespace query returns everything; case-insensitive
  substring match; query is trimmed; no match returns `[]`; server ordering is
  preserved; bot-less guilds filter like installed ones
- `GuildSearch`: reports each keystroke to the caller, announces the result
  count in an `aria-live` region, and exposes a labelled `searchbox` role

## Risks

- **Users administering many servers.** The grid grows to every admin server.
  Acceptable: the sort keeps managed servers on top, and the per-guild API cost
  is unchanged.
- **Stale `botPresent` after an invite.** `isBotInGuild` is cached briefly, so a
  card may stay marked for the cache TTL after adding the bot. The existing
  refresh button is the escape hatch; no auto-detection by design.
