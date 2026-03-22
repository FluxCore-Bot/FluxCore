# Music System Setup Report

**Date**: 2026-03-22
**Status**: In Progress - Lavalink YouTube playback issue being resolved

---

## Overview

We implemented a full music system for the FluxCore Discord bot. The system supports two configuration modes per guild, a queue manager, library management, DJ roles, 24/7 mode, and auto-disconnect. The audio backend is **Lavalink v4** connected via **Shoukaku** (Node.js client).

---

## What Was Built

### Architecture

```
User (Discord) --> Bot (discord.js v14 + Shoukaku) --> Lavalink (Java, Docker) --> Discord Voice
                                                            |
                                                       YouTube Plugin (dev.lavalink.youtube)
                                                       + OAuth (Google burner account)
```

### Two Music Modes

1. **Open Mode** (default) - Users can play any URL or search query (YouTube, SoundCloud, Bandcamp, direct links, etc.)
2. **Library Mode** - Moderators curate albums/tracks. Users can only play from the library via autocomplete.

### Files Created

#### Bot Commands (`apps/bot/src/commands/music/`)
| File | Purpose |
|------|---------|
| `play.ts` | Play URL/search/library track, autocomplete support |
| `pause.ts` | Pause playback (DJ required) |
| `resume.ts` | Resume playback (DJ required) |
| `skip.ts` | Skip current track (DJ required) |
| `stop.ts` | Stop and disconnect (DJ required) |
| `nowplaying.ts` | Show current track with progress bar |
| `volume.ts` | Get/set volume 0-100 |
| `loop.ts` | Set loop mode: off / track / queue |
| `shuffle.ts` | Fisher-Yates shuffle on queue |
| `queue.ts` | View (paginated), remove, clear queue |
| `library.ts` | CRUD for albums/tracks (ManageGuild required) |
| `music-config.ts` | Configure mode, DJ role, volume, queue size, auto-disconnect, 24/7 |

#### Bot Systems (`apps/bot/src/systems/music/`)
| File | Purpose |
|------|---------|
| `shoukaku.ts` | Lavalink connector via Shoukaku, event logging, reconnect config |
| `queue.ts` | `GuildMusicQueue` class - per-guild queue with player lifecycle |
| `guards.ts` | Permission checks (voice channel, DJ role, queue existence) |
| `embeds.ts` | Now-playing, track-added, queue-view embeds |
| `events.ts` | Player events: start, end, stuck, exception, closed |

#### Shared Systems (`packages/systems/src/music/`)
| File | Purpose |
|------|---------|
| `types.ts` | MusicMode, LoopMode, QueueTrack, settings/library interfaces |
| `config.ts` | Guild settings cache + Prisma upsert, 24/7 guild list |
| `library.ts` | Prisma CRUD for albums/tracks, search with autocomplete |
| `constants.ts` | DEFAULT_VOLUME=50, MAX_QUEUE=500, MAX_ALBUMS=50, MAX_TRACKS=100 |

#### Database
- **Migration**: `packages/database/prisma/migrations/20260322000000_add_music_system/`
- **Models**: `MusicGuildSettings`, `MusicLibraryAlbum`, `MusicLibraryTrack`

#### Infrastructure
- **Lavalink config**: `lavalink/application.yml`
- **Docker**: Lavalink service added to `docker-compose.yml` and `docker-compose.prod.yml`
- **Environment**: `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD` added to `.env.dev` and `.env.example`
- **Config package**: `lavalinkHost`, `lavalinkPort`, `lavalinkPassword` fields added to `@fluxcore/config`

---

## Setup Steps Completed

### 1. Database Migration
```bash
pnpm db:generate   # Regenerated Prisma client with music models
pnpm db:deploy     # Applied migration to create music tables
```

### 2. Docker Compose Healthcheck Fix
The original Lavalink healthcheck hit `/version` without auth header. Lavalink v4 requires authorization on all endpoints.

**Before (broken)**:
```yaml
test: ["CMD-SHELL", "wget -qO- http://localhost:2333/version || exit 1"]
```

**After (fixed)**:
```yaml
test: ["CMD-SHELL", "wget -qO- --header='Authorization: youshallnotpass' http://localhost:2333/version || exit 1"]
```

Applied to both `docker-compose.yml` and `docker-compose.prod.yml`.

### 3. YouTube Plugin Setup

Lavalink v4 removed the built-in YouTube source. We added the `youtube-source` plugin.

**Plugin version journey**:
1. Started with `1.11.5` - initial setup
2. Updated to `1.18.0` - latest stable
3. Switched to snapshot `ab5062530eca741d13fd8d1c414ff53cde7c4448` - for latest fixes

### 4. YouTube OAuth Authentication

YouTube blocks server-side requests without authentication. We set up OAuth:

1. Enabled `oauth.enabled: true` in `lavalink/application.yml`
2. Restarted Lavalink - it printed a device code
3. Went to https://www.google.com/device and entered the code with a **burner Google account**
4. Lavalink output the refresh token
5. Saved the refresh token in `application.yml` so it persists across restarts

**Refresh token** (stored in `lavalink/application.yml`):
```
1//03ZBRjPYrOJjyCgYIARAAGAMSNwF-L9IrxhQ0spy4xQa5oYz9QgV4MIAqjwHjE4-XvYKYckrwBkze-mryRjwwPVQmlOftQWVlGGA
```

### 5. YouTube Client Configuration

We went through several client combinations to find one that works with OAuth:

**Attempt 1**: `MUSIC, WEB, ANDROID_TESTSUITE`
- Result: WEB cipher extraction failed, IOS 400 error

**Attempt 2**: `MUSIC, IOS, WEB`
- Result: Same failures. OAuth warning: "no OAuth-compatible clients"

**Attempt 3**: `MUSIC, ANDROID_MUSIC, TVHTML5EMBEDDED`
- Result: `TVHTML5EMBEDDED` doesn't exist in this version. Same OAuth warning.

**Attempt 4 (current)**: `TV, MUSIC, TVHTML5_SIMPLY`
- Result: `TV` resolves to `TVHTML5` (the **only** OAuth-compatible client per the docs)
- No more OAuth incompatibility warning
- Initialised as: `TVHTML5, WEB_REMIX, TVHTML5_SIMPLY`

---

## Current Status & Known Issue

### What Works
- Lavalink starts and connects to Shoukaku successfully
- Bot joins voice channel
- Track **resolution** works (metadata, search, playlists load fine)
- OAuth token refreshes successfully
- 24/7 mode rejoins on restart
- All music commands registered and functional
- Library CRUD works
- Guild settings persist in database

### What Needs Testing
- **YouTube playback** - The `TV` (TVHTML5) client with OAuth was the last configuration applied. Need to verify that it actually streams audio successfully, since previous client combos could resolve tracks but failed during stream playback with cipher/400 errors.
- **SoundCloud, Bandcamp, Twitch, Vimeo, direct HTTP** - These sources should work without issues (no YouTube-specific problems)
- **Library mode end-to-end** - Adding tracks to library, then playing via autocomplete
- **Queue operations** - Loop modes, shuffle, remove, clear under real conditions
- **Auto-disconnect** - Timer-based disconnect after idle period
- **Error recovery** - Stuck tracks, WebSocket closes, reconnection

---

## Current Lavalink Configuration

```yaml
# lavalink/application.yml
server:
  port: 2333
  address: 0.0.0.0

plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowDirectPlaylistIds: true
    clients:
      - TV            # Only OAuth-compatible client (resolves to TVHTML5)
      - MUSIC         # YouTube Music search (WEB_REMIX)
      - TVHTML5_SIMPLY # Fallback for search/playlists
    oauth:
      enabled: true
      refreshToken: "1//03ZBRjPYrOJjyCgYIARAAGAMSNwF-L9IrxhQ0spy4xQa5oYz9QgV4MIAqjwHjE4-XvYKYckrwBkze-mryRjwwPVQmlOftQWVlGGA"

lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:ab5062530eca741d13fd8d1c414ff53cde7c4448"
      snapshot: true
      repository: "https://maven.lavalink.dev/snapshots"
  server:
    password: "youshallnotpass"
    sources:
      youtube: false   # Disabled built-in (broken), using plugin instead
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
```

---

## Troubleshooting Reference

### YouTube "All clients failed" Error
- **Root cause**: YouTube blocks unauthenticated server-side requests
- **Solution**: Use `TV` client with OAuth. Only `TV` supports OAuth per the plugin docs.
- **Client table** (from youtube-source README):
  - `TV` - OAuth: **Yes**, Playback: Yes + Livestream
  - All other clients - OAuth: **No**

### Lavalink Healthcheck Failing
- Lavalink v4 requires `Authorization` header on all endpoints including `/version`
- Fix: Add `--header='Authorization: youshallnotpass'` to wget in healthcheck

### OAuth Token Expired
- If token stops working, remove `refreshToken` from config, restart Lavalink
- It will print a new device code to authorize at https://www.google.com/device
- Use a **burner Google account** (NOT your main)

### Plugin Version
- Using snapshot because stable 1.18.0 may have client registration bugs
- When a new stable release comes out, switch back:
  ```yaml
  - dependency: "dev.lavalink.youtube:youtube-plugin:VERSION"
    snapshot: false
  ```
  (and remove the `repository` line)

---

## Next Steps

1. **Verify YouTube playback** works with the TV+OAuth client config
2. **Test all commands** end-to-end in Discord
3. **Test library mode** - create albums, add tracks, play from autocomplete
4. **Test non-YouTube sources** - SoundCloud, direct URLs, Bandcamp
5. **Consider poToken** as alternative/supplement if OAuth alone isn't enough for WEB client
6. **Production deployment** - ensure `docker-compose.prod.yml` lavalink config matches
7. **Monitor** OAuth token expiry and refresh behavior over time
