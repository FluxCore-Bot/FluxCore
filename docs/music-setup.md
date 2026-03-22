# Music System Setup Guide

This guide walks you through setting up the FluxCore music system from scratch.

---

## Prerequisites

- FluxCore bot already running (see main README)
- Docker and Docker Compose installed
- Discord bot token with the following intents enabled:
  - **Server Members Intent** (privileged)
  - **Message Content Intent** (privileged)
  - **Voice State Intent** (already required by TempVoice)

---

## Step 1: Environment Variables

Add the Lavalink configuration to your environment file.

**For development** (`.env.dev`):

```env
# === Lavalink (Music System) ===
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

**For production** (`.env.prod`):

```env
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=<generate-a-strong-password>
```

> If you change the password, also update it in `lavalink/application.yml` under `lavalink.server.password`.

---

## Step 2: Lavalink Configuration (Optional)

The default Lavalink config at `lavalink/application.yml` works out of the box. You can customize it to:

- Enable/disable audio sources (YouTube, SoundCloud, Bandcamp, etc.)
- Enable/disable audio filters (bass boost, nightcore, etc.)
- Adjust buffer sizes for performance
- Change the server port or password

```yaml
# lavalink/application.yml (key settings)
lavalink:
  server:
    password: "youshallnotpass"   # Must match LAVALINK_PASSWORD env var
    sources:
      youtube: true
      soundcloud: true
      bandcamp: true
      http: true                  # Direct URL streaming
```

---

## Step 3: Run Database Migration

Apply the music system database migration:

```bash
# Development
pnpm db:deploy

# Or manually inside Docker
docker compose --profile bot run --rm bot \
  pnpm --filter @fluxcore/database exec prisma migrate deploy
```

This creates three tables:
- `MusicGuildSettings` — per-guild configuration (mode, DJ role, volume, etc.)
- `MusicLibraryAlbum` — albums for library mode
- `MusicLibraryTrack` — tracks within albums

---

## Step 4: Register Slash Commands

Deploy the new music commands to Discord:

```bash
pnpm deploy:commands
```

This registers all the new `/play`, `/pause`, `/queue`, `/library`, `/music-config`, etc. commands.

---

## Step 5: Start the Bot

```bash
# Development (starts bot + postgres + lavalink)
pnpm dev:bot

# Production
pnpm start:bot
```

On startup, you should see in the logs:

```
[INFO] Lavalink node "main" connected
[INFO] Loaded music settings for 0 guild(s)
```

---

## Step 6: Configure Music in Your Server

Once the bot is running, use the `/music-config` command in your Discord server:

### Choose a Mode

```
/music-config mode mode:Open
```

or

```
/music-config mode mode:Library
```

| Mode | Description |
|------|-------------|
| **Open** | Anyone can play any URL or search term (YouTube, SoundCloud, etc.) |
| **Library** | Users can only play tracks that moderators have added to the library |

### Set a DJ Role (Optional)

Restrict playback control commands (pause, skip, stop, volume, etc.) to a specific role:

```
/music-config dj-role role:@DJ
```

Without a DJ role, everyone can control playback.

### Other Settings

```
/music-config default-volume volume:50        # Default volume for new sessions (0-100)
/music-config max-queue size:100              # Maximum tracks in the queue
/music-config auto-disconnect seconds:300     # Auto-leave after 5 min of inactivity (0 = off)
/music-config 24-7 enabled:True               # Bot stays in voice channel permanently
```

### View Current Settings

```
/music-config view
```

---

## Step 7: Using Library Mode

If you chose **Library** mode, moderators need to populate the library before users can play music.

### Create an Album

```
/library add-album name:Chill Vibes
```

### Add Tracks to an Album

```
/library add-track album:Chill Vibes title:Sunset Drive url:https://youtube.com/watch?v=...
/library add-track album:Chill Vibes title:Ocean Waves url:https://soundcloud.com/...
```

### List Albums / Tracks

```
/library list                        # List all albums
/library list album:Chill Vibes      # List tracks in an album
```

### Remove Tracks / Albums

```
/library remove-track album:Chill Vibes track:Sunset Drive
/library remove-album album:Chill Vibes    # Deletes album + all its tracks
```

### How Users Play in Library Mode

When a user types `/play`, the autocomplete suggests albums first. After selecting an album (typing `AlbumName:`), it shows the tracks within that album. Selecting a track fills in the URL automatically.

Users cannot play arbitrary URLs in library mode — only tracks from the library are allowed.

---

## Commands Reference

### Playback

| Command | Description | Requires DJ |
|---------|-------------|:-----------:|
| `/play <query>` | Play a URL, search term, or library track | No |
| `/pause` | Pause playback | Yes |
| `/resume` | Resume playback | Yes |
| `/skip` | Skip the current track | Yes |
| `/stop` | Stop playback, clear queue, disconnect | Yes |
| `/nowplaying` | Show current track with progress bar | No |
| `/volume [level]` | View or set volume (0-100) | Yes (to set) |
| `/loop <off\|track\|queue>` | Set loop mode | Yes |
| `/shuffle` | Shuffle the queue | Yes |

### Queue

| Command | Description | Requires DJ |
|---------|-------------|:-----------:|
| `/queue view [page]` | View the queue (paginated) | No |
| `/queue remove <position>` | Remove a track by position | Yes |
| `/queue clear` | Clear the entire queue | Yes |

### Library (Moderator — requires Manage Server)

| Command | Description |
|---------|-------------|
| `/library add-album <name>` | Create a new album |
| `/library remove-album <album>` | Delete an album and its tracks |
| `/library add-track <album> <title> <url>` | Add a track |
| `/library remove-track <album> <track>` | Remove a track |
| `/library list [album]` | List albums or tracks |

### Configuration (requires Manage Server)

| Command | Description |
|---------|-------------|
| `/music-config view` | View current settings |
| `/music-config mode <open\|library>` | Set music mode |
| `/music-config dj-role [role]` | Set or clear DJ role |
| `/music-config default-volume <0-100>` | Set default volume |
| `/music-config max-queue <1-500>` | Set max queue size |
| `/music-config auto-disconnect <seconds>` | Set idle timeout (0 = off) |
| `/music-config 24-7 <on\|off>` | Toggle 24/7 mode |

---

## Limits

| Resource | Limit |
|----------|-------|
| Albums per server | 50 |
| Tracks per album | 100 |
| Max queue size | 500 (configurable per guild, default 100) |
| Volume range | 0–100 |
| Auto-disconnect | 0–3600 seconds |

---

## Architecture

```
Discord Voice ←→ Bot (Shoukaku connector) ←→ Lavalink Server (Java)
                        ↓                           ↓
                  Queue Manager              Audio Processing
                        ↓                    (decode, transcode,
                  PostgreSQL                  filters, streaming)
              (settings, library)
```

- **Lavalink** runs as a separate Docker container and handles all audio processing
- **Shoukaku** is the Node.js connector that bridges discord.js with Lavalink
- The bot manages queues, permissions, and settings in-memory (backed by PostgreSQL)
- Each guild has its own independent queue and settings

---

## Troubleshooting

### "No audio server available"

Lavalink is not connected. Check:
1. Is the `lavalink` container running? (`docker compose ps`)
2. Do the password and port match between `.env` and `lavalink/application.yml`?
3. Check lavalink logs: `docker compose logs lavalink`

### "No results found"

- The URL or search term could not be resolved by Lavalink
- YouTube may be rate-limiting. Try a direct URL instead of a search term
- Check if the source is enabled in `lavalink/application.yml`

### Bot doesn't join voice channel

- Ensure the bot has **Connect** and **Speak** permissions in the voice channel
- The user must be in a voice channel before running `/play`

### Tracks skip immediately

- The audio source may be unavailable or geo-restricted
- Check bot logs for "Track stuck" or "Track exception" errors
- Try a different URL or source

### 24/7 mode doesn't persist across restarts

- The bot stores the last voice channel ID and rejoins on startup
- Ensure the channel still exists and the bot has permissions to join it
