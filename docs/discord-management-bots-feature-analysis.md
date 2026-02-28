# Discord Management Bots - Comprehensive Feature Analysis Report

> **Date:** February 28, 2026
> **Scope:** Public Discord management/moderation bots with focus on ProBot, MEE6, and comparable bots
> **Purpose:** Extract and catalog all features offered by major Discord management bots

---

## Table of Contents

1. [MEE6](#1-mee6)
2. [ProBot](#2-probot)
3. [Carl-bot](#3-carl-bot)
4. [Dyno](#4-dyno)
5. [YAGPDB](#5-yagpdb)
6. [Arcane](#6-arcane)
7. [UnbelievaBoat](#7-unbelievaboat)
8. [Wick Bot](#8-wick-bot)
9. [Ticket Tool](#9-ticket-tool)
10. [Zira](#10-zira)
11. [Statbot](#11-statbot)
12. [GearBot](#12-gearbot)
13. [Sapphire](#13-sapphire)
14. [Xenon](#14-xenon)
15. [Invite Tracker](#15-invite-tracker)
16. [Feature Comparison Matrix](#feature-comparison-matrix)

---

## 1. MEE6

**Website:** https://mee6.xyz
**Servers:** 19M+
**Pricing:** Free (limited) | $11.95/mo | $49.99/yr | $89.90 lifetime

### Moderation

| Feature | Description |
|---|---|
| Auto-Moderation | Automatically checks messages for prohibited language, spam, spoilers, and external links |
| Bad Words Filter | Customizable blacklist of banned words and phrases with auto-delete |
| Anti-Spam | Detects and punishes rapid message sending |
| Anti-Raid | Detects sudden influx of new accounts and takes protective action |
| Invite Filter | Automatically removes Discord invite links from messages |
| Link Filter | Blocks external URLs with configurable whitelists |
| Mass Mention Filter | Acts on messages mentioning too many users |
| Strike System | Escalating punishments: warn → mute → kick → ban based on accumulated violations |
| Ban | Permanently ban users with reason logging |
| Kick | Remove users from the server |
| Mute / Tempmute | Silence users permanently or for a specified duration |
| Tempban | Temporarily ban users with automatic unban |
| Warn | Issue formal warnings tracked per user |
| Purge / Clean | Bulk delete messages with filters (user, bots, links, attachments) |
| Mod Log | Dedicated channel logging all moderation actions with details |
| Message Audit | Audit editing and deletion of messages and posting of server invites |

### Leveling / XP System

| Feature | Description |
|---|---|
| XP Per Message | Users gain XP when they send messages with anti-spam cooldown |
| Level-Up Announcements | Notification sent in channel or DM when a user levels up |
| Role Rewards | Predefined role rewards for members reaching specific levels (Premium) |
| Leaderboard | Server-wide leaderboard page showing top members by XP |
| Custom Rank Cards | Customizable `/rank` cards for members (Premium) |
| XP Rate Control | Change the XP gain rate (Premium) |
| XP Management | `/give-xp` and `/remove-xp` commands to manually adjust XP (Premium) |
| Leaderboard Customization | Add banner to leaderboard, remove ads (Premium) |

### Welcome Messages

| Feature | Description |
|---|---|
| Welcome Messages | Customizable greeting for new members sent to channel or DM |
| Welcome Card | Visual welcome card with user avatar and server info |
| Custom Card Design | Design your own welcome card or keep default |
| Server Rules Notification | Inform newcomers about server rules, topic, or events |

### Custom Commands

| Feature | Description |
|---|---|
| Command Creation | Create commands that give/remove roles and send messages |
| Response to Channel | Send responses in the current channel |
| Response via DM | Send responses directly to user's DM |
| Role Assignment | Commands can automatically assign or remove roles |

### Reaction Roles

| Feature | Description |
|---|---|
| Reaction Roles | Members self-assign roles by reacting to a message (Premium) |
| Multiple Reactions | Multiple role-reaction pairs on a single message |
| Customizable | Full control over which emojis map to which roles |

### Social Media Alerts

| Feature | Description |
|---|---|
| Twitch Notifications | Alert when followed streamers go live with custom messages |
| YouTube Notifications | Notify when channels upload new videos |
| Reddit Notifications | Post new content from specified subreddits |
| Twitter/X Notifications | Alerts for new tweets from specified accounts |

### Music

| Feature | Description |
|---|---|
| Music Player | Play music from SoundCloud and Twitch streams |
| Music Quiz | Interactive music quiz game (Premium) |
| Queue System | Song queue management |

> **Note:** Direct YouTube playback was removed due to policy changes.

### Recording

| Feature | Description |
|---|---|
| Voice Recording | Record voice channel conversations (Premium) |
| Transcript Generation | Generate transcripts of recorded conversations |

### Auto-Role Assignment

| Feature | Description |
|---|---|
| Auto-Role on Join | Automatically assign roles to new members based on criteria |
| Criteria Options | Based on join date, time on server, and other conditions |

---

## 2. ProBot

**Website:** https://probot.io
**Servers:** 10M+
**Pricing:** Free (core) | Premium $5-$10/mo

### Moderation

| Feature | Description |
|---|---|
| Ban | Permanently ban users with optional reason and message deletion |
| Kick | Remove users from the server |
| Mute | Silence users using a dedicated mute role |
| Tempban | Temporarily ban for specified duration with auto-unban |
| Tempmute | Temporarily mute with auto-unmute |
| Timeout | Leverage Discord's native timeout feature |
| Warn | Issue formal warnings with configurable auto-punishments |
| Warn Punishments | Automatic escalation (e.g., 3 warns = mute, 5 warns = ban) |
| Softban | Ban and immediately unban to delete messages without permanent ban |
| Lock / Unlock Channel | Restrict or restore message sending in channels |
| Slowmode | Set per-user message cooldown in channels |
| Purge / Clear | Bulk delete with filters: by user, bots, links, attachments |
| Move | Move users between voice channels |
| Warn History | View full moderation history per user |
| Reset Warnings | Clear warnings for specific users or server-wide |

### Auto-Moderation

| Feature | Description |
|---|---|
| Anti-Spam | Detect and punish rapid message sending |
| Anti-Invite | Auto-delete Discord invite links with server whitelist |
| Anti-Links | Block external URLs with domain whitelist/blacklist |
| Anti-Mass Mention | Act on excessive mentions in a single message |
| Anti-Emoji Spam | Delete messages with too many emojis |
| Anti-Caps | Warn/delete messages predominantly in capitals |
| Anti-Repeated Text | Remove duplicate messages from users |
| Anti-Bad Words | Blacklist of banned words/phrases with wildcard support |
| Anti-Zalgo | Remove corrupted/glitchy text |
| Whitelisted Roles/Channels | Exempt specific roles or channels from rules |
| Configurable Punishments | Per-rule actions: delete, warn, mute, tempmute, kick, or ban |

### Anti-Raid

| Feature | Description |
|---|---|
| Anti-Raid Protection | Detect sudden account influx with auto-kick/ban/lockdown (Premium) |
| Account Age Filter | Block accounts younger than configurable age |
| Join Rate Limiting | Detect mass-join events and trigger protection |
| Anti-Nuke | Protect against mass channel/role deletion by compromised admins |

### Welcome & Farewell

| Feature | Description |
|---|---|
| Welcome Messages | Customizable join message to channel or DM |
| Welcome Image/Card | Visual card with user avatar, name, server name, member count |
| Custom Background | Fully customizable welcome card background and layout |
| Farewell Messages | Customizable leave message with variables |
| Welcome DM | Direct message to new members with rules/info |
| Auto-Role on Join | Assign roles automatically to new members |
| Embed Support | Rich embeds for welcome/farewell messages |
| Custom Variables | Placeholders: `{user}`, `{server}`, `{membercount}`, `{user.avatar}` |

### Leveling / XP System

| Feature | Description |
|---|---|
| XP per Message | Members earn XP for chatting with configurable cooldown |
| Level Roles | Auto-assign roles at specific levels |
| Rank Command | Visual rank card showing level, XP, and server rank |
| Leaderboard | Server-wide leaderboard on web dashboard |
| Custom Rank Card | Custom backgrounds and styling (Premium) |
| XP Multiplier Roles | Roles that earn XP faster |
| No-XP Channels/Roles | Exclude channels or roles from earning XP |
| Voice XP | Earn XP for voice channel time |
| Reset XP | Reset for individuals or entire server |

### Reaction Roles

| Feature | Description |
|---|---|
| Reaction Roles | Self-assign roles by reacting with emojis |
| Button Roles | Modern Discord button-based role assignment |
| Dropdown/Select Menu Roles | Select menu role assignment with categories |
| Exclusive/Unique Mode | Only one role from a group at a time |
| Custom Emojis | Support for custom server emojis |
| DM Confirmation | Optional DM when role is added/removed |
| Multiple Messages | Multiple reaction role setups across channels |

### Embed Messages

| Feature | Description |
|---|---|
| Embed Builder | Visual editor on dashboard with all embed fields |
| Send Embeds | Send to any channel via dashboard or command |
| Edit Embeds | Edit previously sent embeds without resending |
| Embed Variables | Dynamic variables in embeds |
| Multiple Fields | Inline and full-width fields |

### Logging / Audit

| Feature | Description |
|---|---|
| Message Logging | Log deleted/edited messages with content |
| Member Logging | Join, leave, ban, unban, kick, nickname changes |
| Role Logging | Creation, deletion, permission changes, assignments |
| Channel Logging | Creation, deletion, permission/settings changes |
| Voice Logging | Join, leave, switch, mute/deafen events |
| Server Logging | Server settings changes |
| Moderation Logging | All mod actions with moderator info and reasons |
| Multiple Log Channels | Different channels for different log categories |
| Invite Tracking | Track which invite link each member used |

### Music

| Feature | Description |
|---|---|
| Music Playback | Play from YouTube, Spotify, SoundCloud |
| Queue System | Add, view, skip, remove, shuffle songs |
| Loop/Repeat | Loop current song or entire queue |
| Volume Control | Adjust playback volume |
| Pause/Resume | Pause and resume playback |
| Seek | Jump to timestamp within track |
| Playlist Support | Load YouTube/Spotify playlists |
| DJ Role | Restrict music commands to DJ role |
| 24/7 Mode | Stay in voice channel continuously (Premium) |
| Audio Filters | Bass boost, nightcore, vaporwave, etc. |

### Custom Commands

| Feature | Description |
|---|---|
| Text Response Commands | Respond with custom text/embeds |
| Command Variables | `{user}`, `{channel}`, `{args}`, `{server}`, `{random}` |
| Command Actions | Add/remove roles, send messages, send DMs, create embeds |
| Conditional Responses | Channel/role-based conditions |
| Cooldowns | Per-user or per-channel cooldowns |
| Aliases | Multiple trigger names |
| Permission Restrictions | Role or channel restrictions |

### Social Media Alerts

| Feature | Description |
|---|---|
| YouTube Notifications | New video upload alerts |
| Twitch Notifications | Live stream alerts with stream details |
| Twitter/X Notifications | New tweet notifications |

### Additional Features

| Feature | Description |
|---|---|
| Starboard | Popular messages reposted to a highlights channel |
| Giveaways | Timed giveaways with role requirements and multiple winners |
| Ticket System | Private support channels with categories, logs, auto-close |
| Temporary Voice Channels | Auto-created/deleted temp channels with owner controls |
| Auto-Responder | Automatic replies on keyword triggers with pattern matching |
| Economy / Credits | Virtual currency, daily rewards, reputation system |
| Profile Customization | Custom backgrounds, badges, bio text |
| Invite Tracker | Track invites and who invited whom |
| Multi-Language Support | 20+ languages including RTL (Arabic) |
| Web Dashboard | Full GUI management at probot.io |
| Short Links | URL shortening utility |
| Translate | Text translation between languages |

### Premium Features

| Feature | Description |
|---|---|
| Custom Bot | Own bot name, avatar, and status |
| Anti-Raid Protection | Advanced raid detection and lockdown |
| No Branding | Remove ProBot branding |
| Priority Support | Faster response times |
| Increased Limits | More reaction roles, commands, auto-responders |
| Custom Rank Cards | Advanced leveling card customization |
| 24/7 Music | Continuous voice channel presence |

---

## 3. Carl-bot

**Website:** https://carl.gg
**Servers:** 15M+
**Pricing:** Free (generous) | Premium via Patreon ~$4-8/mo

### Reaction Roles (Industry-Leading)

| Feature | Description |
|---|---|
| Reaction Role Messages | Assign roles via emoji reactions (up to 250 per message on Premium) |
| Multiple Modes | Normal (toggle), Unique (one per group), Verify (one-time), Drop (opt-out), Reversed, Binding |
| Button Roles | Discord button-based assignment with colored buttons |
| Select Menu / Dropdown Roles | Dropdown role selection with placeholder text and min/max |
| Role Groups & Categories | Group roles with requirements (must have X before picking Y) |
| Embedded Messages | Attach reaction roles to custom embeds |
| Sticky Roles | Persist roles across leave/rejoin |
| Web Dashboard Management | Visual builder at carl.gg |

### Auto-Moderation

| Feature | Description |
|---|---|
| Banned Words/Phrases | Custom blacklist with exact match and wildcard |
| Spam Detection | Rate-based message spam and duplicate detection |
| Mass Mention Filter | Configurable mention threshold |
| Invite Link Filter | Auto-delete invites with server whitelist |
| Link/URL Filter | Domain whitelist/blacklist |
| Caps Filter | Excessive capitalization detection |
| Emoji Spam Filter | Too many emojis in one message |
| Attachment Filter | Restrict file uploads per channel |
| Newline Spam Filter | Excessive blank lines detection |
| Zalgo Filter | Corrupted text removal |
| Anti-Raid | Mass-join detection with lockdown, kick/ban, verification |
| Configurable Punishments | Per-rule: delete, warn, mute (with duration), kick, ban, add role |
| Punishment Escalation | Auto-escalation (e.g., 3 warns → mute, 5 → kick, 7 → ban) |
| Whitelisted Roles/Channels | Exempt specific roles/channels |
| Phishing Detection | Automatically detect known phishing/scam links |

### Custom Commands / Tags (Tagscript)

| Feature | Description |
|---|---|
| Tags | Custom text/embed commands with prefix trigger |
| Tagscript Language | Full templating: variables, conditionals, math, string manipulation |
| Variable Blocks | `{user}`, `{server}`, `{channel}`, `{args}`, `{unix}`, etc. |
| Control Flow | `{if}`, `{any}`, `{all}`, `{or}`, `{and}`, `{break}`, `{not}` |
| Action Blocks | Assign roles, send DMs, create embeds, add reactions, redirect, delete, ban/kick/mute |
| Argument Parsing | `{args}`, `{1}`, `{2}` with slicing |
| Random Selection | `{random}` and `{#}` blocks |
| Math Operations | `{math}` for arithmetic expressions |
| String Manipulation | `{lower}`, `{upper}`, `{replace}`, `{urlencode}`, `{length}` |
| Cooldowns | Per-user or per-channel |
| Autoresponse Triggers | Auto-respond on keyword match, contains, starts/ends with, regex |

### Logging

| Feature | Description |
|---|---|
| Message Logging | Edits, deletions, bulk purges (with text file export) |
| Member Logging | Joins, leaves, role changes, nickname changes |
| Voice Logging | Joins, leaves, moves, mutes/deafens |
| Server Logging | Settings, channel, role, emoji changes |
| Moderation Logging | All mod actions with case numbers |
| Avatar/Profile Logging | Avatar change tracking |
| Multiple Log Channels | Route different types to different channels |
| Ignore Channels/Roles | Exclude from logging |

### Moderation

| Feature | Description |
|---|---|
| Warn | Stored warnings with DM notification |
| Mute / Tempmute | Discord timeout or mute role with auto-unmute |
| Kick | Remove with optional DM notification |
| Ban / Tempban | Permanent or temporary with auto-unban |
| Softban | Kick + delete messages |
| Massban | Ban multiple users by ID |
| Purge / Clean | Bulk delete with filters (user, text, bots, attachments, embeds) |
| Lock / Unlock | Lock channels or entire categories |
| Case System | Numbered cases, searchable, editable reasons |
| DM on Punishment | Configurable DM notifications with reason |
| Dehoist | Auto-rename users with special characters for member list manipulation |
| Nickname Management | Change/reset nicknames |
| Mod Roles | Designated mod roles without needing Discord permissions |

### Starboard

| Feature | Description |
|---|---|
| Star Threshold | Configurable star count to qualify |
| Starboard Channel | Designated highlights channel |
| Self-Star Prevention | Prevent users from starring own messages |
| Ignored Channels | Exclude channels from starboard |
| NSFW Handling | Route NSFW stars to NSFW starboard |
| Dynamic Updates | Star count updates as reactions change |
| Multiple Starboards | Different emoji/threshold/channel configs (Premium) |

### Welcome / Farewell

| Feature | Description |
|---|---|
| Welcome Messages | Customizable text/embed join messages |
| Farewell Messages | Leave/kick/ban departure messages |
| DM Welcome | Send welcome as DM |
| Embed Support | Full embed customization |
| Variables | `{user}`, `{server}`, `{user.mention}`, `{server.members}` |
| Join Roles (Autorole) | Auto-assign roles on join with optional delay |
| Bot Autorole | Specific roles for bots |
| Welcome Image | Custom banner with avatar overlay (Premium) |

### Autofeeds

| Feature | Description |
|---|---|
| RSS Feeds | Subscribe to any RSS/Atom feed with custom formatting |
| YouTube Feeds | New video upload notifications |
| Twitch Notifications | Live stream alerts with stream info |
| Reddit Feeds | Subreddit post forwarding with flair filtering |
| Custom Formatting | Variables for title, link, author, description |
| Multiple Feeds | Multiple feeds across channels |

### Suggestion System

| Feature | Description |
|---|---|
| Suggestion Channel | Clean embed format for suggestions |
| Upvote/Downvote | Automatic voting reactions |
| Approval/Denial | Moderator status management with reasons |
| Suggestion Numbering | Unique IDs for reference |
| Anonymous Mode | Hide suggestion author |
| DM Notifications | Notify author on status change |
| Discussion Threads | Auto-create threads for each suggestion |

### Additional Features

| Feature | Description |
|---|---|
| Highlights | Personal keyword DM notifications with context |
| Levels / XP System | XP gain, level-up notifications, role rewards, leaderboard (Premium) |
| Giveaways | Timed giveaways with role requirements and reroll |
| Polls | Quick polls with up to 20 options and timed voting |
| Embeds | Full builder (dashboard and commands) with templates |
| Reminders | Personal reminders with recurring support |
| AFK System | Auto-notify on mention while AFK |
| Snipe / Editsnipe | Retrieve deleted/edited messages |
| Temprole | Temporary role assignment with auto-removal |
| Role Persistence | Restore roles on rejoin |
| Roleall / Removeall | Bulk role operations |
| Web Dashboard | Full GUI at carl.gg with visual builders |

---

## 4. Dyno

**Website:** https://dyno.gg
**Servers:** 7M+
**Pricing:** Free (basic) | Premium tiers available

### Moderation

| Feature | Description |
|---|---|
| Ban / Tempban | Permanent or temporary bans with auto-unban |
| Kick | Remove users with optional reason |
| Mute / Timed Mute | Silence users with configurable duration and auto-unmute |
| Softban | Ban + unban to delete messages |
| Warn | Formal warnings tracked per user |
| Warnings List | View all warnings with moderator and reason |
| Note | Internal moderator notes without user notification |
| Lock / Unlock | Prevent/restore message sending in channels |
| Purge / Clean | Bulk delete with filters: user, bots, links, attachments, text |
| Deafen / Undeafen | Server-deafen users in voice |
| Role Management | Add/remove roles via commands |

### Auto-Moderation

| Feature | Description |
|---|---|
| Banned Words Filter | Blacklisted words with exact match and wildcards |
| Link/URL Filter | Auto-delete links with domain whitelisting |
| Invite Filter | Remove Discord invites |
| Mass Mention Filter | Configurable mention threshold |
| Duplicate Text Filter | Remove repeated messages |
| Caps Filter | Excessive capitalization detection |
| Spam Filter | Rate-limit based rapid message detection |
| Emoji Spam Filter | Excessive emoji detection |
| Self-Bot Detection | Detect user-bot automation |
| Automod Actions | Per-filter: delete, warn, mute (timed), kick, ban |
| Ignored Roles/Channels | Exempt from rules |
| Automute Escalation | Auto-escalate punishment for repeat offenders |

### Action Log / Audit

| Feature | Description |
|---|---|
| Mod Log | All moderation actions with moderator, target, reason, timestamp |
| Action Log | Message edits/deletions, joins/leaves, role changes, channel changes, nicknames, voice activity |
| Configurable Events | Toggle specific logged events |
| Separate Log Channels | Different channels for mod log vs. action log |

### Auto-Roles

| Feature | Description |
|---|---|
| Join Auto-Role | Assign roles on member join |
| Bot Auto-Role | Assign roles to bots on add |
| Delayed Auto-Role | Assign after configurable time delay |
| Role Persistence | Re-apply roles on rejoin |

### Welcome / Goodbye

| Feature | Description |
|---|---|
| Welcome Messages | Customizable with variables: `{user}`, `{server}`, `{membercount}` |
| Goodbye Messages | Customizable departure messages |
| Join DM | Direct message to new members |
| Welcome Embeds | Rich embed format with custom color, title, thumbnail, footer |
| Ban Announcements | Optional ban notification |

### Custom Commands

| Feature | Description |
|---|---|
| Text Response | Custom text responses |
| Embed Response | Rich embed message responses |
| Role Assignment | Commands that add/remove roles |
| Variables | `{user}`, `{server}`, `{channel}`, `{args}`, `{random}`, `{choice}` |
| Cooldowns | Per-user or per-channel |
| Permissions | Role or channel restrictions |
| Aliases | Alternative command names |
| Auto-Response | Trigger on keyword without prefix |

### Reaction Roles

| Feature | Description |
|---|---|
| Reaction Role Messages | Click reactions to self-assign roles |
| Multiple Roles per Message | Different reactions for different roles |
| Toggle Mode | Click to add, click again to remove |
| Exclusive Roles | Select one, others auto-removed |

### Anti-Raid

| Feature | Description |
|---|---|
| Join Rate Limiting | Detect mass-join events |
| Auto-Ban on Raid | Automatically ban raid accounts |
| Account Age Filter | Kick/ban accounts below age threshold |
| Lockdown Mode | Quick server/channel lockdown |

### Additional Features

| Feature | Description |
|---|---|
| Starboard | Popular messages reposted with configurable threshold |
| Polls | Quick yes/no and multi-option polls |
| Reminders | Personal timed reminders via DM |
| Custom Embeds | Visual builder on dashboard |
| AFK Module | Auto-notify when pinged while AFK |
| Timed/Scheduled Messages | Recurring auto-posted messages (hourly, daily, weekly) |
| Suggestions | Structured suggestion system with upvote/downvote |
| Ticket System | Support tickets with categories and transcript logging |
| Cleverbot | AI chatbot in designated channels |
| Twitch Integration | Live stream notifications |
| Web Dashboard | Full management at dyno.gg |
| Slowmode | Enhanced channel slowmode |
| Tags | Reusable text snippets for FAQs |

### Premium Features

| Feature | Description |
|---|---|
| Custom Bot Instance | Own name, avatar, status, playing status |
| No Branding | Remove Dyno branding |
| Premium Uptime | Higher priority and faster responses |
| Increased Limits | More custom commands, reaction roles, automessages |
| Premium Support | Priority support |

---

## 5. YAGPDB

**Website:** https://yagpdb.xyz
**Servers:** 1M+
**Pricing:** Free (core) | Premium $3.50/server/mo
**Open Source:** Yes (self-hostable)

### Moderation

| Feature | Description |
|---|---|
| Ban / Tempban | Permanent or timed bans |
| Kick | Remove members with reason |
| Mute / Tempmute | Silence users with duration |
| Warn | Issue warnings with tracking |
| Purge | Bulk message deletion with filters |
| Mod Log | All actions logged to designated channel |
| Manual Commands | Full suite of moderation commands |

### Auto-Moderation (Advanced)

| Feature | Description |
|---|---|
| Regex Filters | Advanced pattern-based content detection |
| Chainable Conditions | Combine account age, message frequency, content detection |
| Custom Strike System | Configurable strikes per rule violation |
| Strike Escalation | Auto-mute, kick, or ban after X strikes within timeframe |
| Spam Detection | Message rate and duplicate content detection |
| Mass Mention Filter | Excessive mention detection |
| Invite Filter | Auto-delete Discord invites |
| Link Filter | Block external URLs |
| Word Blacklist | Banned word detection |
| Account Age Filter | Action based on account creation date |

### Custom Commands (Advanced Scripting)

| Feature | Description |
|---|---|
| Templating System | Full Go-based template engine for complex automations |
| Variables & Logic | Conditionals, loops, math, string operations |
| Database Access | Per-server key-value database for persistent data |
| Scheduled Commands | Run commands on cron-like schedules |
| Trigger Types | Command, regex, interval, reaction, join/leave, component |
| HTTP Requests | Make external API calls from custom commands |
| Role & Channel Manipulation | Programmatic server management |
| Response Types | Text, embeds, DMs, channel redirects |

### Role Management

| Feature | Description |
|---|---|
| Self-Assignable Roles | Members assign roles via reactions or commands |
| Role Groups | Group roles with exclusive/require settings |
| Autorole | Auto-assign on join with optional delay |

### Feeds & Notifications

| Feature | Description |
|---|---|
| Reddit Feeds | Subscribe to subreddits with filtering |
| YouTube Feeds | New video upload notifications |
| Custom Formatting | Template-based feed messages |

### Reputation System

| Feature | Description |
|---|---|
| Reputation Points | Members give/receive rep points |
| Leaderboard | Server-wide reputation rankings |
| Cooldowns | Rate limiting on rep giving |

### Additional Features

| Feature | Description |
|---|---|
| Logging | Message, member, voice, and server event logging |
| Reminders | Personal timed reminders |
| Autorole | Configurable join roles with delay |
| Soundboard | Play sound effects in voice channels |
| Fun Commands | 250+ cat facts, dog facts, and more |
| Reddit/Twitter/YouTube Notifications | Social media integration |
| Web Dashboard | Full configuration at yagpdb.xyz |

---

## 6. Arcane

**Website:** https://arcane.bot
**Servers:** 500K+
**Pricing:** Free (most features) | Premium ~$7/mo

### Leveling / XP System (Core Feature)

| Feature | Description |
|---|---|
| XP Per Message | Gain XP from messages with 1-minute anti-spam cooldown |
| Voice XP | Earn XP in voice channels (Premium) |
| Reaction XP | Earn XP for reacting to messages (5-min cooldown) |
| Received Reaction XP | Earn XP when others react to your messages |
| Multiple Level-Ups | Handle multiple level-ups per event |
| 3 Leveling Curves | Choose between different XP progression curves |
| XP Modifiers | Deterministic XP modifiers (no randomness) |
| Unlimited Role Rewards | Assign roles at any level milestone (free) |
| Weekly Leaderboard | Resets every week at 12am UTC |
| Monthly Leaderboard | Resets every month at 12am UTC |
| All-Time Leaderboard | Persistent cumulative rankings |
| Web Leaderboard | Online leaderboard at no cost |
| Top Member Role | Special role for highest XP member (updated daily/hourly for Premium) |
| Channel/Role Blacklists | Exclude from XP earning |
| Custom XP Rates | Adjust XP gain per channel or role |
| Level-Up Messages | Customizable level-up announcements |
| Rank Cards | Visual rank display showing level and XP |

### Auto-Moderation

| Feature | Description |
|---|---|
| Auto-Moderation | Configurable content moderation rules |
| Word Filters | Banned word detection and action |
| Spam Detection | Message rate limiting |

### Reaction Roles

| Feature | Description |
|---|---|
| Reaction Roles | Self-assign roles via emoji reactions |
| Multiple Modes | Various role assignment modes |

### Logging

| Feature | Description |
|---|---|
| Event Logging | Track server events and actions |
| Configurable Events | Toggle specific event types |

### Additional Features

| Feature | Description |
|---|---|
| Welcome Messages | Greet new members |
| Prestige System | Reset and re-level for prestige rewards |
| Server Statistics | Track community metrics |

---

## 7. UnbelievaBoat

**Website:** https://unbelievaboat.com
**Servers:** 2M+
**Pricing:** Free (generous) | Premium tiers available

### Economy System (Core Feature)

| Feature | Description |
|---|---|
| Server Currency | Custom-named currency per server |
| Cash & Bank | Dual balance system - cash can be robbed, bank is safe |
| `/work` Command | Earn currency with configurable cooldown and payouts |
| `/crime` Command | High risk/reward earning with failure penalties |
| `/slut` Command | Configurable earning command (renamable) |
| `/rob` Command | Rob other users' cash with configurable success chance |
| Deposit / Withdraw | Move currency between cash and bank |
| Balance Check | View own or others' balances |
| Leaderboard | Rankings by total, cash, bank, or items |
| Give / Pay | Transfer currency between users |
| Admin Money Commands | Add, remove, or set user balances |
| Store & Items | Custom server shop with items that grant roles or cosmetics |
| Inventory System | Personal collection of purchased items |
| Income Roles | Passive currency earning for specific roles |
| Economy Multipliers | Role/channel-based earning multipliers |
| Taxes | Configurable tax system on transactions |
| Currency Customization | Custom emoji/symbol for currency |
| Timely Rewards | Configurable periodic currency claims |

### Casino / Games

| Feature | Description |
|---|---|
| Blackjack | Classic card game |
| Roulette | Wheel-spinning game |
| Animal Racing | Bet on animal races |
| Chicken Fighting | Competitive chicken battles |
| Additional Games | Slots and other gambling mini-games |

### Pet / Animal System

| Feature | Description |
|---|---|
| Buy Animals | Purchase pets with server currency |
| Train Animals | Level up and train your pets |
| Race Animals | Compete against other members' pets |

### Moderation

| Feature | Description |
|---|---|
| Ban / Unban | Ban users with reason and history deletion |
| Kick | Remove users with reason |
| Mute / Timeout | Silence users with duration |
| Warn | Issue formal warnings |
| Case System | Numbered cases for every mod action |
| Auto-Punishments | Auto-escalate on warning thresholds |
| Purge / Clear | Bulk delete with filters |
| Lock / Unlock | Channel permission management |
| Slowmode | Message rate limiting |
| Mod Log | All actions logged with details |
| Reason Editing | Update reasons on past cases |

### Auto-Moderation

| Feature | Description |
|---|---|
| Invite Filtering | Auto-delete Discord invites |
| Excessive Mentions | Control mass mention spam |
| Configurable Rules | Additional auto-mod triggers |

### Custom Commands

| Feature | Description |
|---|---|
| Text/Embed Responses | Custom command outputs |
| Placeholders | `{user}`, `{server}`, `{channel}`, `{membercount}` |
| Embed Builder | Rich embed creation for commands |
| Permission Restrictions | Role/channel restrictions |
| Aliases | Alternative command names |

### Role Management

| Feature | Description |
|---|---|
| Reaction Roles | Normal, Unique, Verify, Drop, Reversed, Binding modes |
| Button Roles | Discord button-based assignment |
| Dropdown Roles | Select menu role selection |
| Auto-Roles | Join auto-roles and bot auto-roles |
| Self-Assignable Roles | Command-based role assignment |
| Mass Role Operations | Bulk add/remove roles |

### Welcome / Leave Messages

| Feature | Description |
|---|---|
| Welcome Messages | Customizable join messages (channel or DM) |
| Leave Messages | Departure notifications |
| Embed Support | Rich embed formatting |
| Placeholders | Dynamic variables |
| Welcome Images | Visual welcome cards (Premium) |

### Logging

| Feature | Description |
|---|---|
| Message Logging | Edited and deleted messages |
| Member Logging | Joins, leaves, nicknames, role changes |
| Server Logging | Channel/role/settings changes |
| Voice Logging | Voice activity tracking |
| Invite Tracking | Join source attribution |
| Customizable Channels | Different channels per log type |

### Additional Features

| Feature | Description |
|---|---|
| Giveaways | Timed giveaways with role requirements and bonus entries |
| Applications | Custom forms with accept/deny workflow and role rewards |
| Tags | Reusable text snippets for FAQs |
| Reminders | Personal timed reminders |
| AFK Status | Auto-notify on mention |
| Polls | Simple voting system |
| Fun Commands | Entertainment commands |
| Web Dashboard | Full management at unbelievaboat.com |
| API | Public API for economy integration |
| 150+ Commands | Across economy, games, moderation, fun, and more |

---

## 8. Wick Bot

**Website:** https://wickbot.com
**Pricing:** Free (core anti-nuke) | Premium for extras

### Anti-Nuke System (Core Feature)

| Feature | Description |
|---|---|
| Server Change Monitoring | Monitors and notes all changes in the server |
| Channel Protection | Stop mass channel creation and deletion |
| Role Protection | Prevent mass role creation and deletion |
| Ban/Kick Protection | Block mass banning and kicking |
| Webhook Protection | Prevent mass webhook creation/deletion |
| Emoji Protection | Block mass emoji changes (Premium) |
| Vanity URL Protection | Detect unauthorized vanity URL changes |
| Automatic Restore | Uses latest backup to revert nuke damage |
| Staff Monitoring | Continuously watches staff members and bots |

### Quarantine System

| Feature | Description |
|---|---|
| Instant Quarantine | Rogue admins quarantined immediately on detection |
| Quarantine Role | Overrides all permissions, blocks all access |
| Zero Power State | Quarantined users cannot see or type in any channel |

### Panic Mode

| Feature | Description |
|---|---|
| Auto-Lockdown | Locks down entire server when anomaly detected |
| Full Server Scan | Runs complete scan during lockdown |
| miniWick Deployment | Separate bot preserves data without burdening main instance |
| Owner-Only Authority | Only server owner and Wick have power during panic |

### Restore System

| Feature | Description |
|---|---|
| Backup Restore | Full server snapshot restore (excludes messages and role assignments) |
| Memory Restore | Fallback restoration using bot memory and Discord data |
| Two-Tier Recovery | Backup-based or memory-based depending on configuration |

### Auto-Moderator (Heat System)

| Feature | Description |
|---|---|
| Heat Algorithm | Adaptive behavior measurement through message frequency, repetition, suspicious activity |
| Content Detection | Advertisements, NSFW content, malicious links |
| Format Detection | Excessive emojis, mentions, attachments |
| Regular Member Protection | Normal users remain unaffected |
| Heat Point Accumulation | Disruptive activity triggers timeouts/kicks |
| Auto Timeouts with Multiplier | Escalating timeouts that double on each violation |
| Heat Panic Mode | Instant timeout for raiders while protecting regulars |
| Heat Filters | Customizable per-category threat analysis |

### Auto Lockdown

| Feature | Description |
|---|---|
| Channel Lockdown | Auto-lock channels during ping raids |
| Mention Threshold | Configurable threshold for non-whitelisted members |
| Timeframe Configuration | Adjustable detection window |

### Verification System

| Feature | Description |
|---|---|
| Captcha Verification | Image-based captcha challenge |
| Web Verification | Browser-based verification |
| Instant Verification | Quick verification mode |
| Target Selection | All members or only suspicious accounts |

### Join Gate (Firewall)

| Feature | Description |
|---|---|
| Avatar Filtering | Require profile avatar for entry |
| Account Age Filter | Minimum account age requirement |
| Bot Addition Filter | Control bot additions |
| Discord Verification | Require Discord-verified email/phone |
| Ad Detection | Block accounts with advertising content |
| Username Pattern Filter | Block suspicious username patterns |

### Join Raid Detection

| Feature | Description |
|---|---|
| Join Spike Monitoring | Detect sudden join surges |
| Historical Pattern Analysis | Compare against normal join patterns |
| Suspicious Account Flagging | Auto-flag new suspicious accounts |
| Moderator Alerts | Detailed logs sent to moderators |

---

## 9. Ticket Tool

**Website:** https://tickettool.xyz
**Pricing:** Free (core) | Premium $5/mo+

### Ticket Creation & Management

| Feature | Description |
|---|---|
| Panel-Based Creation | Users click button/reaction/select menu to create tickets |
| Command Creation | Staff/users open tickets via `/new` command |
| Private Channels | Each ticket creates a private channel for creator and staff |
| Ticket Naming | Configurable format: `ticket-0001`, `ticket-username`, custom prefix |
| Ticket Limit | Max open tickets per user to prevent spam |
| Opening Message | Configurable first message with instructions and action buttons |

### Ticket Panels

| Feature | Description |
|---|---|
| Multi-Panel Support | Multiple panels across channels for different purposes |
| Button Panels | Discord button-based ticket creation |
| Select Menu / Dropdown Panels | Category selection before opening |
| Reaction Panels | Legacy reaction-based creation |
| Custom Embed Panels | Fully customizable panel appearance |

### Ticket Categories

| Feature | Description |
|---|---|
| Multiple Categories | Support, Billing, Reports, Applications, etc. |
| Per-Category Settings | Individual staff roles, channels, messages, forms, naming, auto-close |
| Category-Specific Permissions | Different staff teams per category |

### Custom Forms

| Feature | Description |
|---|---|
| Modal Forms | Discord popup forms with custom questions |
| Text Input Types | Short text and paragraph fields |
| Required/Optional Fields | Configurable field requirements |
| Up to 5 Questions | Per Discord modal limitations |
| Form Responses | Answers displayed in ticket as embed |

### Transcripts

| Feature | Description |
|---|---|
| HTML Transcripts | Full conversation export preserving formatting and attachments |
| Transcript Channel | Auto-send to log channel on close |
| Transcript to User | DM transcript to ticket creator |
| Online Viewer | Browser-based transcript viewing |
| Manual Transcript | Generate at any point without closing |

### Staff Management

| Feature | Description |
|---|---|
| Support Team Roles | Designated staff roles with ticket access |
| Admin Roles | Elevated permissions for all tickets |
| Per-Category Staff | Different staff per ticket type |
| Add/Remove Users | `/add` and `/remove` participants |

### Ticket Operations

| Feature | Description |
|---|---|
| Claim System | Staff claim tickets with one-click button |
| Claimed Visibility | Optional restriction to claiming staff only |
| Close with Reason | Provide closure reason for logs |
| Confirmation Prompt | Prevent accidental closures |
| Archive Mode | Lock permissions instead of deleting |
| Reopen | Restore closed/archived tickets |
| Auto-Close | Close after configurable inactivity period |
| Inactivity Warning | Warning message before auto-close |
| Rename | Change ticket channel name |
| Transfer | Transfer ownership to another user |
| Priority | Set low/medium/high/urgent priority |
| Blacklist | Block users from creating tickets |

### Thread & Forum Mode

| Feature | Description |
|---|---|
| Thread-Based Tickets | Create as Discord threads instead of channels |
| Private Threads | Privacy via private threads (requires boost level 2) |
| Forum Channel Tickets | Create as forum channel posts |

### Premium Features

| Feature | Description |
|---|---|
| Feedback/Ratings | Post-close support experience rating |
| Ticket Analytics | Response time, open/close rates, staff performance |
| Scheduled Close | Close at specific scheduled time |
| Advanced Transcripts | Enhanced features and longer storage |
| Custom Branding | Remove Ticket Tool branding |
| Snippets | Pre-written canned responses |

---

## 10. Zira

**Website:** https://zira.bot
**Established:** 2017
**Pricing:** Free (100 reaction roles) | Premium for unlimited

### Reaction Roles (Core Feature)

| Feature | Description |
|---|---|
| Normal Roles | Toggle role on react/unreact |
| Once Roles | One-time role assignment (react once to get role permanently) |
| Remove Roles | React to remove a role |
| Toggle Roles | React to toggle role on/off |
| Up to 100 Free | 100 total reaction roles per guild on free tier |
| Unlimited (Premium) | Unlimited reaction roles for premium/partnered guilds |
| DM Notifications | DM users on role add/remove (Premium) |
| Timed Roles | Temporary role assignment via reaction (Premium) |

### Additional Features

| Feature | Description |
|---|---|
| Auto-Role on Join | Assign roles automatically to users and bots |
| Suggestion System | Users submit, roles approve/deny suggestions |
| Join & Leave Messages | Customizable to designated channels |
| Voice Channel Roles | Assign roles based on voice channel |
| Private Voice Channels | Users create own private voice channels |

---

## 11. Statbot

**Website:** https://statbot.net
**Servers:** 670K+
**Pricing:** Free (basic) | Premium for advanced

### Analytics & Tracking (Core Feature)

| Feature | Description |
|---|---|
| Message Tracking | Detailed message activity per member and channel |
| Voice Tracking | Time spent in voice chat per member |
| Online Status Tracking | Member online/offline patterns |
| Game Activity Tracking | What games members play and for how long |
| Hourly Data | Granular hourly activity data |
| Individual Member Data | Per-member activity metrics |
| Per-Channel Data | Channel-level activity breakdown |
| More Than Server Insights | Tracks data Discord's native insights doesn't |

### Channel Counters (Statdocks)

| Feature | Description |
|---|---|
| Thousands of Options | Limitless counter customization |
| Clocks & Countdowns | Time-based counters |
| Top Active Member | Display most active member as counter |
| Top Active Channel | Display most active channel as counter |
| Member Count | Total/online/offline member displays |
| Custom Formats | Full formatting control |

### Automatic Role Rewards (Statroles)

| Feature | Description |
|---|---|
| Activity-Based Roles | Auto-grant roles based on member activity |
| Dynamic System | Users can lose roles if they become inactive |
| Configurable Thresholds | Set activity requirements per role |
| Unlike Leveling Bots | Not permanent - truly reflects current activity |

### Web Dashboard

| Feature | Description |
|---|---|
| Graphs & Charts | Visual data representation |
| Heatmaps | Activity pattern visualization |
| Trend Analysis | Identify growth and engagement trends |
| Customization | Custom tracking periods, timezones, filters |

---

## 12. GearBot

**Website:** https://gearbot.rocks
**Notable:** Recommended by Discord Moderator Academy

### Moderation

| Feature | Description |
|---|---|
| Ban / Tempban | Permanent and temporary bans |
| Kick | Remove members |
| Mute / Tempmute | Silence users with duration |
| Warn | Issue and track warnings |
| Purge | Bulk message deletion |
| Infraction System | Full tracking of all moderation actions |

### Auto-Moderation

| Feature | Description |
|---|---|
| Custom Filters | Configurable content filters |
| Anti-Spam | Spam detection and prevention |
| Raid Protection | Anti-raid measures |
| Word Blacklists | Banned word detection |

### Logging

| Feature | Description |
|---|---|
| Comprehensive Logging | Track all server events |
| Message Logging | Edit and deletion tracking |
| Member Logging | Join, leave, role changes |
| Configurable Events | Toggle specific event types |

### Additional Features

| Feature | Description |
|---|---|
| Custom Commands | Create custom bot responses |
| Highly Customizable | Tweak every setting to suit community |
| Open Source | Self-hostable for full control |

---

## 13. Sapphire

**Pricing:** Free for all features

### Moderation

| Feature | Description |
|---|---|
| Advanced Auto-Moderation | Multiple condition groups for complex rules |
| AI Moderation | AI-powered message flagging |
| Spam Detection | Automatic spam identification |

### Community Management

| Feature | Description |
|---|---|
| Welcome Messages | Greet new members |
| Join/Leave Logging | Track membership changes |
| Reaction Roles | Self-assign roles via reactions |
| Join Role Assignment | Auto-role on join |
| Custom Slash Commands | Create custom commands with buttons |
| Social Media Notifications | Platform integration alerts |
| Detailed Event Logging | Comprehensive logging via dashboard |
| Auto Thread Deletion | Clean up restricted channel threads |

---

## 14. Xenon

**Pricing:** Free (basic) | Premium ~$110/mo

### Server Backup & Restore

| Feature | Description |
|---|---|
| Automated Backups | Capture roles, channels, and permissions |
| Message Backup | Full message backup (Premium) |
| Server Restoration | Restore from snapshots |
| Template Cloning | Clone and distribute server templates |
| Undo Functionality | Revert raids or compromises |
| Scheduled Auto-Backup | Automatic periodic backups (Premium) |

---

## 15. Invite Tracker

**Pricing:** Free (basic) | Premium ~$9.99/mo

### Invite Tracking

| Feature | Description |
|---|---|
| Invite Tracking | Track all invite links and usage |
| Source Attribution | Know which invite each member used |
| Top Inviters Leaderboard | Rank members by invites |
| Giveaway System | Invite-based giveaway requirements |
| Verification | Button/CAPTCHA verification for new members |
| Join/Leave Messages | Announcement with invite source info |

---

## Feature Comparison Matrix

| Feature Category | MEE6 | ProBot | Carl-bot | Dyno | YAGPDB | Arcane | UnbelievaBoat | Wick | Ticket Tool | Zira | Statbot |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Moderation** | Yes | Yes | Yes | Yes | Yes | - | Yes | - | - | - | - |
| **Auto-Moderation** | Yes | Yes | Yes | Yes | Yes (Advanced) | Basic | Basic | Yes (Heat) | - | - | - |
| **Anti-Nuke/Raid** | Basic | Yes (P) | Basic | Basic | Basic | - | - | Yes (Best) | - | - | - |
| **Leveling/XP** | Yes | Yes | Yes (P) | - | - | Yes (Best) | - | - | - | - | - |
| **Reaction Roles** | Yes (P) | Yes | Yes (Best) | Yes | Yes | Yes | Yes | - | - | Yes | - |
| **Button/Menu Roles** | - | Yes | Yes | - | - | - | Yes | - | - | - | - |
| **Welcome Messages** | Yes | Yes (Images) | Yes | Yes | Yes | Yes | Yes | - | - | Yes | - |
| **Custom Commands** | Basic | Yes | Yes (Best) | Yes | Yes (Best) | - | Yes | - | - | - | - |
| **Logging** | Basic | Yes | Yes | Yes | Yes | Basic | Yes | - | Yes | - | - |
| **Music** | Limited | Yes | - | Removed | - | - | - | - | - | - | - |
| **Ticket System** | - | Yes | - | Yes | - | - | - | - | Yes (Best) | - | - |
| **Economy** | - | Credits | - | - | - | - | Yes (Best) | - | - | - | - |
| **Giveaways** | - | Yes | Yes | Yes | - | - | Yes | - | - | - | - |
| **Starboard** | - | Yes | Yes (Best) | Yes | - | - | - | - | - | - | - |
| **Suggestions** | - | - | Yes | Yes | - | - | - | - | - | Yes | - |
| **RSS/Social Feeds** | Alerts | Alerts | Yes (RSS) | Twitch | Reddit/YT | - | - | - | - | - | - |
| **Analytics/Stats** | - | - | - | - | - | Basic | - | - | Analytics (P) | - | Yes (Best) |
| **Verification** | - | - | - | - | - | - | - | Yes (Best) | - | - | - |
| **Server Backup** | - | - | - | - | - | - | - | Restore | - | - | - |
| **Web Dashboard** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | - | Yes |
| **Multi-Language** | Limited | Yes (20+) | Limited | Limited | Limited | Limited | Limited | Limited | Limited | Limited | Limited |
| **Applications** | - | - | - | - | - | - | Yes | - | - | - | - |
| **Open Source** | No | No | No | No | Yes | No | No | No | No | No | No |

**Legend:** Yes = Available free | (P) = Premium only | (Best) = Best-in-class for this feature | - = Not available

---

## Key Takeaways

### Best-in-Class by Category

| Category | Best Bot | Why |
|---|---|---|
| **Overall Management** | ProBot / Carl-bot | Most comprehensive feature set for all-in-one management |
| **Reaction Roles** | Carl-bot | Most modes, button/dropdown support, 250+ per message |
| **Auto-Moderation** | YAGPDB | Regex filters, chainable conditions, advanced scripting |
| **Anti-Nuke/Security** | Wick Bot | Pioneered the concept, quarantine, panic mode, restore |
| **Leveling/XP** | Arcane | Multiple curves, weekly/monthly boards, reaction XP |
| **Economy** | UnbelievaBoat | Full economy with shops, items, pets, casino games |
| **Custom Commands** | Carl-bot / YAGPDB | Tagscript (Carl) and Go templates (YAGPDB) are industry-leading |
| **Ticket System** | Ticket Tool | Dedicated bot with forms, transcripts, analytics, forums |
| **Analytics** | Statbot | Deep tracking, Statroles, heatmaps, counters |
| **Music** | ProBot | Most remaining feature set (many bots removed music) |
| **Logging** | Carl-bot / Dyno | Comprehensive event tracking with multiple channels |
| **Welcome System** | ProBot | Custom images with avatar, most customization |
| **Server Backup** | Xenon | Dedicated backup/restore with scheduling |
| **Invite Tracking** | Invite Tracker | Dedicated tracking with attribution and leaderboards |
| **Arabic/RTL Support** | ProBot | Strongest Arabic community and full RTL support |

### Pricing Summary

| Bot | Free Tier | Premium Starting Price |
|---|---|---|
| MEE6 | Limited features | $11.95/mo or $89.90 lifetime |
| ProBot | Core features | $5-10/mo |
| Carl-bot | Generous free tier | ~$4-8/mo (Patreon) |
| Dyno | Basic features | Varies by tier |
| YAGPDB | Core features | $3.50/server/mo |
| Arcane | Most features | ~$7/mo |
| UnbelievaBoat | Generous free tier | Varies by tier |
| Wick Bot | Core anti-nuke free | Premium for extras |
| Ticket Tool | Core features | $5/mo |
| Zira | 100 reaction roles | Premium for unlimited |
| Statbot | Basic tracking | Premium for advanced |
| Sapphire | All features free | No premium tier |

---

## Sources

- [MEE6 Official](https://mee6.xyz)
- [ProBot Official](https://probot.io)
- [Carl-bot Official](https://carl.gg)
- [Dyno Official](https://dyno.gg)
- [YAGPDB Official](https://yagpdb.xyz)
- [Arcane Official](https://arcane.bot)
- [UnbelievaBoat Official](https://unbelievaboat.com)
- [Wick Bot Docs](https://docs.wickbot.com)
- [Ticket Tool Official](https://tickettool.xyz)
- [Zira Official](https://zira.bot)
- [Statbot Official](https://statbot.net)
- [GearBot Official](https://gearbot.rocks)
- [Top.gg Bot Listings](https://top.gg)
- [CommunityOne Best Bots Guide 2026](https://blog.communityone.io/best-discord-bots/)
- [Discord-Media ProBot Guide](https://discord-media.com/en/news/what-is-probot-the-ultimate-discord-bot-guide.html)
- [Discord-Media Carl-bot Guide](https://discord-media.com/en/news/carl-bot2025.html)
- [BotPenguin MEE6 Features](https://botpenguin.com/blogs/top-features-of-mee6-discord-bot)
- [Discord Fandom Wiki](https://discord.fandom.com)