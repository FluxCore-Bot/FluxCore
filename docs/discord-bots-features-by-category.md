# Discord Management Bots - Features by Category Report

> **Date:** February 28, 2026
> **Purpose:** Feature-centric view listing all features and which bots implement them, with descriptions
> **Bots Covered:** MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Wick Bot, Ticket Tool, Zira, Statbot, GearBot, Sapphire, Xenon, Invite Tracker

---

## Table of Contents

1. [Moderation](#1-moderation)
2. [Auto-Moderation](#2-auto-moderation)
3. [Anti-Raid & Anti-Nuke](#3-anti-raid--anti-nuke)
4. [Leveling / XP System](#4-leveling--xp-system)
5. [Reaction Roles & Role Management](#5-reaction-roles--role-management)
6. [Welcome & Farewell Messages](#6-welcome--farewell-messages)
7. [Custom Commands](#7-custom-commands)
8. [Logging & Audit](#8-logging--audit)
9. [Ticket System](#9-ticket-system)
10. [Economy System](#10-economy-system)
11. [Music](#11-music)
12. [Starboard](#12-starboard)
13. [Suggestion System](#13-suggestion-system)
14. [Giveaways](#14-giveaways)
15. [Social Media Feeds & Notifications](#15-social-media-feeds--notifications)
16. [Analytics & Statistics](#16-analytics--statistics)
17. [Embed Builder](#17-embed-builder)
18. [Verification System](#18-verification-system)
19. [Server Backup & Restore](#19-server-backup--restore)
20. [Invite Tracking](#20-invite-tracking)
21. [Temporary Voice Channels](#21-temporary-voice-channels)
22. [Polls](#22-polls)
23. [Reminders](#23-reminders)
24. [AFK System](#24-afk-system)
25. [Scheduled / Timed Messages](#25-scheduled--timed-messages)
26. [Applications / Forms](#26-applications--forms)
27. [Reputation System](#27-reputation-system)
28. [Recording & Transcripts](#28-recording--transcripts)
29. [Fun & Utility Commands](#29-fun--utility-commands)
30. [Web Dashboard](#30-web-dashboard)
31. [Multi-Language Support](#31-multi-language-support)
32. [Open Source / Self-Hostable](#32-open-source--self-hostable)
33. [Premium / Custom Bot Instance](#33-premium--custom-bot-instance)

---

## 1. Moderation

> Core moderation commands for managing server members including banning, kicking, muting, warning, and message cleanup.

| Feature | Description | Bots |
|---|---|---|
| Ban | Permanently ban users with reason logging and optional message deletion | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Tempban | Temporarily ban users for a specified duration with automatic unban | ProBot, Carl-bot, Dyno, YAGPDB, GearBot |
| Kick | Remove users from the server with optional reason | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Mute / Tempmute | Silence users permanently or for a specified duration using mute role or Discord timeout | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Timeout | Leverage Discord's native timeout feature for temporary muting | ProBot, UnbelievaBoat |
| Warn | Issue formal warnings tracked per user with optional DM notification | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Warn Punishments | Automatic escalation based on warning count (e.g., 3 warns = mute, 5 warns = ban) | ProBot, Carl-bot, UnbelievaBoat |
| Warn History | View full moderation/warning history per user | ProBot, Dyno, UnbelievaBoat |
| Reset Warnings | Clear warnings for specific users or server-wide | ProBot |
| Softban | Ban and immediately unban to delete user's recent messages without permanent ban | ProBot, Carl-bot, Dyno |
| Massban | Ban multiple users simultaneously by user ID | Carl-bot |
| Purge / Clean | Bulk delete messages with filters (by user, bots, links, attachments, text content) | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Lock / Unlock Channel | Restrict or restore message sending permissions in specific channels | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Slowmode | Set per-user message cooldown in channels to control message rate | ProBot, Dyno, UnbelievaBoat |
| Move | Move users between voice channels | ProBot |
| Deafen / Undeafen | Server-deafen users in voice channels | Dyno |
| Mod Log | Dedicated channel logging all moderation actions with moderator info, target, reason, and timestamp | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot |
| Case System | Numbered moderation cases that are searchable and have editable reasons | Carl-bot, UnbelievaBoat |
| Infraction System | Full tracking of all moderation actions as infractions | GearBot |
| DM on Punishment | Configurable DM notifications sent to users with the reason when punished | Carl-bot |
| Dehoist | Auto-rename users who use special characters to manipulate their position in the member list | Carl-bot |
| Nickname Management | Change or reset user nicknames via commands | Carl-bot |
| Mod Roles | Designate moderator roles that grant mod permissions without needing Discord-level permissions | Carl-bot |
| Note | Internal moderator notes attached to users without notifying the user | Dyno |
| Role Management | Add or remove roles from users via moderation commands | Dyno |
| Message Audit | Audit editing and deletion of messages and posting of server invites | MEE6 |
| Strike System | Escalating punishments: warn → mute → kick → ban based on accumulated violations | MEE6 |
| AI Moderation | AI-powered message flagging for automated content analysis | Sapphire |

---

## 2. Auto-Moderation

> Automated content filtering and rule enforcement that detects and acts on rule-breaking messages without moderator intervention.

| Feature | Description | Bots |
|---|---|---|
| Bad Words / Blacklist Filter | Customizable blacklist of banned words and phrases with exact match and wildcard support, auto-delete on match | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, GearBot |
| Anti-Spam | Detect and punish rapid message sending based on message rate thresholds | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, GearBot |
| Invite Link Filter | Automatically remove Discord invite links from messages with server whitelist | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| Link / URL Filter | Block external URLs with configurable domain whitelist/blacklist | MEE6, ProBot, Carl-bot, Dyno, YAGPDB |
| Mass Mention Filter | Act on messages containing too many user mentions based on configurable threshold | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| Anti-Caps | Detect and warn/delete messages predominantly written in capital letters | ProBot, Carl-bot, Dyno |
| Anti-Emoji Spam | Delete messages containing too many emojis in a single message | ProBot, Carl-bot, Dyno |
| Anti-Repeated Text | Remove duplicate or repeated messages from users | ProBot, Dyno |
| Anti-Zalgo | Remove corrupted/glitchy Zalgo text from messages | ProBot, Carl-bot |
| Newline Spam Filter | Detect and remove messages with excessive blank lines | Carl-bot |
| Attachment Filter | Restrict file uploads per channel based on rules | Carl-bot |
| Phishing Detection | Automatically detect and remove known phishing/scam links | Carl-bot |
| Regex Filters | Advanced pattern-based content detection using regular expressions | YAGPDB |
| Chainable Conditions | Combine multiple conditions (account age, message frequency, content) for complex rule logic | YAGPDB |
| Self-Bot Detection | Detect automated user-bot scripts | Dyno |
| Heat Algorithm | Adaptive behavior measurement through message frequency, repetition, and suspicious activity patterns | Wick Bot |
| Content Detection (NSFW, Ads, Malware) | Detect advertisements, NSFW content, and malicious links automatically | Wick Bot |
| Configurable Punishments | Per-rule configurable actions: delete, warn, mute (with duration), kick, ban, add role | ProBot, Carl-bot, Dyno, YAGPDB |
| Punishment Escalation | Auto-escalate punishment severity for repeat offenders (e.g., 3 warns → mute, 5 → kick) | Carl-bot, Dyno, YAGPDB |
| Whitelisted Roles/Channels | Exempt specific roles or channels from auto-moderation rules | ProBot, Carl-bot, Dyno |
| Heat Panic Mode | Instant timeout for raiders while protecting regular members based on behavior patterns | Wick Bot |
| Advanced Auto-Moderation | Multiple condition groups for building complex moderation rules | Sapphire |

---

## 3. Anti-Raid & Anti-Nuke

> Protection against coordinated attacks including mass joins, account nuking, and server destruction by compromised admins.

| Feature | Description | Bots |
|---|---|---|
| Anti-Raid Protection | Detect sudden influx of new accounts and take protective action (kick/ban/lockdown) | MEE6, ProBot (Premium), Carl-bot, Dyno |
| Join Rate Limiting | Detect mass-join events by monitoring join speed and trigger protection | ProBot, Dyno, Wick Bot |
| Account Age Filter | Block or kick accounts younger than a configurable age threshold | ProBot, Dyno, YAGPDB, Wick Bot |
| Lockdown Mode | Quick server or channel lockdown preventing all member actions | Dyno, Wick Bot |
| Anti-Nuke | Protect against mass channel/role deletion by compromised admin accounts | ProBot |
| Channel Protection | Stop mass channel creation and deletion by rogue admins or bots | Wick Bot |
| Role Protection | Prevent mass role creation, deletion, and permission changes | Wick Bot |
| Ban/Kick Protection | Block mass banning and kicking by compromised accounts | Wick Bot |
| Webhook Protection | Prevent mass webhook creation and deletion | Wick Bot |
| Emoji Protection | Block mass emoji changes (Premium) | Wick Bot |
| Vanity URL Protection | Detect unauthorized vanity URL changes | Wick Bot |
| Staff Monitoring | Continuously watch staff members and bots for suspicious behavior | Wick Bot |
| Quarantine System | Instantly quarantine rogue admins by overriding all permissions and blocking all access | Wick Bot |
| Panic Mode | Full server lockdown with complete scan; only server owner retains authority | Wick Bot |
| miniWick Deployment | Separate bot instance that preserves data without burdening main instance during panic | Wick Bot |
| Automatic Restore | Use latest backup to revert damage from nuke attacks | Wick Bot |
| Backup Restore | Full server snapshot restore (channels, roles, permissions) after attack | Wick Bot |
| Memory Restore | Fallback restoration using bot memory and Discord data when backup unavailable | Wick Bot |
| Join Spike Monitoring | Detect sudden join surges by comparing against historical join patterns | Wick Bot |
| Suspicious Account Flagging | Auto-flag new accounts that exhibit suspicious characteristics | Wick Bot |
| Auto Lockdown | Auto-lock channels during ping raids based on mention threshold from non-whitelisted members | Wick Bot |
| Auto-Ban on Raid | Automatically ban accounts identified as part of a raid | Dyno |

---

## 4. Leveling / XP System

> Gamification system where members earn experience points for activity, level up, and receive role rewards and leaderboard rankings.

| Feature | Description | Bots |
|---|---|---|
| XP Per Message | Users gain XP when they send messages with anti-spam cooldown to prevent farming | MEE6, ProBot, Arcane |
| Voice XP | Earn XP for time spent in voice channels | ProBot, Arcane (Premium) |
| Reaction XP | Earn XP for reacting to messages with cooldown | Arcane |
| Received Reaction XP | Earn XP when others react to your messages | Arcane |
| Level-Up Announcements | Notification sent in channel or DM when a user reaches a new level | MEE6, ProBot, Arcane |
| Level / Role Rewards | Automatically assign roles when members reach specific level milestones | MEE6 (Premium), ProBot, Arcane (Unlimited free) |
| Leaderboard | Server-wide leaderboard showing top members ranked by XP | MEE6, ProBot, Arcane |
| Weekly Leaderboard | XP leaderboard that resets every week | Arcane |
| Monthly Leaderboard | XP leaderboard that resets every month | Arcane |
| Web Leaderboard | Online browser-accessible leaderboard page | MEE6, ProBot, Arcane |
| Custom Rank Cards | Customizable visual `/rank` cards showing level, XP, and rank | MEE6 (Premium), ProBot (Premium) |
| Rank Command | Display visual rank card showing current level, XP progress, and server rank | ProBot, Arcane |
| XP Rate Control | Change the XP gain rate or set custom XP per channel/role | MEE6 (Premium), Arcane |
| XP Management | Admin commands to manually add, remove, or set user XP | MEE6 (Premium), ProBot |
| XP Multiplier Roles | Specific roles that earn XP at a faster rate | ProBot |
| No-XP Channels/Roles | Exclude specific channels or roles from earning XP | ProBot, Arcane |
| Multiple Leveling Curves | Choose between different XP progression curves for leveling speed | Arcane (3 curves) |
| Top Member Role | Special role automatically assigned to the highest XP member | Arcane |
| Prestige System | Reset level and re-level for prestige rewards and badges | Arcane |
| Levels / XP (Premium) | XP gain, level-up notifications, role rewards, and leaderboard as premium feature | Carl-bot |
| Leaderboard Customization | Custom banner, remove ads from leaderboard page | MEE6 (Premium) |

---

## 5. Reaction Roles & Role Management

> Systems allowing members to self-assign roles through reactions, buttons, or dropdown menus, plus automated role assignment.

| Feature | Description | Bots |
|---|---|---|
| Reaction Roles | Members self-assign roles by clicking emoji reactions on a message | MEE6 (Premium), ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Zira, Sapphire |
| Button Roles | Modern Discord button-based role assignment with colored buttons | ProBot, Carl-bot, UnbelievaBoat |
| Dropdown / Select Menu Roles | Role assignment via Discord select menu dropdowns with categories | ProBot, Carl-bot, UnbelievaBoat |
| Multiple Modes | Various modes: Normal (toggle), Unique (one per group), Verify (one-time), Drop (opt-out), Reversed, Binding | Carl-bot, UnbelievaBoat, Zira |
| Exclusive / Unique Mode | Only allow one role from a group at a time, auto-remove others when new one selected | ProBot, Carl-bot, Dyno |
| Role Groups & Categories | Group roles with requirements (must have role X before picking role Y) | Carl-bot |
| Custom Emojis | Support for custom server emojis in reaction role setups | ProBot, Carl-bot |
| DM Confirmation | Optional DM notification when a role is added or removed | ProBot, Zira (Premium) |
| Timed Roles | Temporary role assignment via reaction with auto-removal after duration | Zira (Premium), Carl-bot |
| Multiple Messages | Support for multiple reaction role setups across different channels | ProBot, Carl-bot |
| Up to 250 per Message | Support for up to 250 reaction role pairs on a single message | Carl-bot (Premium) |
| Sticky Roles | Persist roles across leave and rejoin so returning members keep their roles | Carl-bot |
| Auto-Role on Join | Automatically assign roles to new members when they join the server | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, Zira, Sapphire |
| Bot Auto-Role | Assign specific roles to bots when they are added to the server | Carl-bot, Dyno, Zira |
| Delayed Auto-Role | Assign roles after a configurable time delay after joining | Carl-bot, Dyno |
| Role Persistence | Re-apply all previous roles when a member leaves and rejoins | Carl-bot, Dyno |
| Self-Assignable Roles | Members assign roles via text commands in addition to reactions | YAGPDB, UnbelievaBoat |
| Mass Role Operations (Roleall/Removeall) | Bulk add or remove a role from all members or filtered subsets | Carl-bot, UnbelievaBoat |
| Temprole | Temporary role assignment with automatic removal after specified duration | Carl-bot |
| Voice Channel Roles | Assign roles based on which voice channel a member is in | Zira |

---

## 6. Welcome & Farewell Messages

> Automated greeting messages for new members and departure notifications when members leave.

| Feature | Description | Bots |
|---|---|---|
| Welcome Messages | Customizable greeting messages sent to a channel when new members join | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Zira, Sapphire |
| Farewell / Goodbye Messages | Customizable departure messages sent when members leave, are kicked, or banned | ProBot, Carl-bot, Dyno, UnbelievaBoat, Zira |
| Welcome DM | Direct message sent to new members with rules, info, or instructions | ProBot, Carl-bot, Dyno |
| Welcome Image / Card | Visual welcome card with user avatar, username, server name, and member count | MEE6, ProBot, Carl-bot (Premium), UnbelievaBoat (Premium) |
| Custom Card Background | Fully customizable welcome card background, layout, and design | MEE6, ProBot |
| Embed Support | Rich embed formatting for welcome and farewell messages with colors, fields, thumbnails | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Custom Variables / Placeholders | Dynamic placeholders like `{user}`, `{server}`, `{membercount}`, `{user.avatar}` in messages | ProBot, Carl-bot, Dyno |
| Server Rules Notification | Inform newcomers about server rules, topic, or events as part of the welcome flow | MEE6 |
| Ban Announcements | Optional notification in channel when a member is banned | Dyno |

---

## 7. Custom Commands

> User-created commands that respond with custom text, embeds, or perform actions like role assignment and DM sending.

| Feature | Description | Bots |
|---|---|---|
| Text Response Commands | Create commands that respond with custom text messages | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Embed Response | Commands that respond with rich embed messages | ProBot, Dyno, UnbelievaBoat |
| Command Variables | Dynamic placeholders: `{user}`, `{server}`, `{channel}`, `{args}`, `{random}`, etc. | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Role Assignment Actions | Commands can automatically assign or remove roles from the user | MEE6, ProBot, Dyno |
| Response via DM | Commands can send responses directly to user's DMs | MEE6, Carl-bot |
| Conditional Responses | Channel-based or role-based conditions for different command behavior | ProBot |
| Cooldowns | Per-user or per-channel cooldowns to prevent command spam | Carl-bot, Dyno, UnbelievaBoat |
| Aliases | Multiple trigger names that invoke the same command | ProBot, Dyno, UnbelievaBoat |
| Permission Restrictions | Restrict command usage to specific roles or channels | ProBot, Dyno, UnbelievaBoat |
| Tagscript Language | Full templating language with variables, conditionals, math, and string manipulation for complex command logic | Carl-bot |
| Control Flow | `{if}`, `{any}`, `{all}`, `{or}`, `{and}`, `{break}`, `{not}` for branching logic in commands | Carl-bot |
| Action Blocks | Assign roles, send DMs, create embeds, add reactions, redirect, delete, ban/kick/mute from within commands | Carl-bot |
| Math Operations | `{math}` block for arithmetic expressions within commands | Carl-bot |
| String Manipulation | `{lower}`, `{upper}`, `{replace}`, `{urlencode}`, `{length}` for text processing | Carl-bot |
| Autoresponse / Auto-Responder | Automatic replies triggered on keyword match without command prefix, supports regex | Carl-bot, Dyno, ProBot |
| Go Template Engine | Full Go-based template engine enabling complex automations with loops and conditionals | YAGPDB |
| Database Access | Per-server key-value database for storing persistent data across command executions | YAGPDB |
| Scheduled Commands | Run commands on cron-like schedules (hourly, daily, weekly) | YAGPDB |
| Multiple Trigger Types | Trigger on command, regex match, interval, reaction, join/leave, or button component | YAGPDB |
| HTTP Requests | Make external API calls from within custom commands | YAGPDB |
| Role & Channel Manipulation | Programmatically manage server roles and channels from custom commands | YAGPDB |
| Custom Slash Commands | Create custom commands registered as Discord slash commands with buttons | Sapphire |

---

## 8. Logging & Audit

> Comprehensive event logging tracking message edits/deletions, member joins/leaves, role changes, voice activity, and server changes.

| Feature | Description | Bots |
|---|---|---|
| Message Logging | Log deleted and edited messages with full content to a designated channel | ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Member Logging | Track joins, leaves, bans, unbans, kicks, nickname changes, and role assignments | ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Role Logging | Log role creation, deletion, permission changes, and user role assignments | ProBot, Carl-bot, Dyno |
| Channel Logging | Track channel creation, deletion, and permission/settings changes | ProBot, Carl-bot, Dyno |
| Voice Logging | Log voice channel join, leave, switch, mute, and deafen events | ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| Server Logging | Track server settings changes (name, icon, region, etc.) | ProBot, Carl-bot, Dyno |
| Moderation Logging | All moderation actions with moderator info, case numbers, and reasons | ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| Multiple Log Channels | Route different event types to different log channels for organization | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Configurable Events | Toggle specific event types on/off for logging | Dyno, Arcane, GearBot |
| Avatar/Profile Logging | Track user avatar changes | Carl-bot |
| Ignore Channels/Roles | Exclude specific channels or roles from being logged | Carl-bot |
| Bulk Purge Logging | Export bulk-purged messages as text files for record keeping | Carl-bot |
| Invite Tracking in Logs | Track which invite link each new member used to join | ProBot, UnbelievaBoat |
| Detailed Event Logging | Comprehensive logging configurable via web dashboard | Sapphire |
| Auto Thread Deletion | Clean up restricted channel threads automatically | Sapphire |

---

## 9. Ticket System

> Private support channel system for handling user requests, reports, and applications with staff management and transcripts.

| Feature | Description | Bots |
|---|---|---|
| Panel-Based Ticket Creation | Users click a button, reaction, or select menu on a panel to create a support ticket | Ticket Tool, ProBot, Dyno |
| Command-Based Creation | Staff or users open tickets via slash commands | Ticket Tool |
| Private Channels | Each ticket creates a private channel visible only to the creator and designated staff | Ticket Tool, ProBot, Dyno |
| Ticket Categories | Multiple ticket categories (Support, Billing, Reports, Applications) with per-category settings | Ticket Tool, ProBot |
| Button Panels | Discord button-based ticket creation panels | Ticket Tool |
| Select Menu / Dropdown Panels | Category selection dropdown before opening a ticket | Ticket Tool |
| Custom Forms / Modals | Discord popup forms with custom questions (up to 5) collected before ticket opens | Ticket Tool |
| HTML Transcripts | Full conversation export preserving formatting, attachments, and images | Ticket Tool |
| Transcript Channel | Auto-send transcript to a log channel when ticket is closed | Ticket Tool, ProBot |
| Transcript to User DM | DM the full transcript to the ticket creator on close | Ticket Tool |
| Online Transcript Viewer | Browser-based transcript viewing with formatting preserved | Ticket Tool |
| Claim System | Staff can claim tickets with one-click, optionally restricting visibility to claiming staff | Ticket Tool |
| Close with Reason | Provide a closure reason recorded in transcript and logs | Ticket Tool |
| Auto-Close | Automatically close tickets after configurable inactivity period with warning message | Ticket Tool, ProBot |
| Archive Mode | Lock ticket permissions instead of deleting the channel | Ticket Tool |
| Reopen | Restore closed or archived tickets | Ticket Tool |
| Priority Levels | Set low/medium/high/urgent priority on tickets | Ticket Tool |
| Transfer | Transfer ticket ownership to another user | Ticket Tool |
| Blacklist | Block specific users from creating tickets | Ticket Tool |
| Thread-Based Tickets | Create tickets as Discord threads instead of full channels | Ticket Tool |
| Forum Channel Tickets | Create tickets as forum channel posts | Ticket Tool |
| Feedback/Ratings | Post-close support experience rating from users (Premium) | Ticket Tool |
| Ticket Analytics | Response time metrics, open/close rates, and staff performance tracking (Premium) | Ticket Tool |
| Snippets / Canned Responses | Pre-written response templates for common ticket replies (Premium) | Ticket Tool |
| Support Team Roles | Designated staff roles with automatic ticket access | Ticket Tool |
| Per-Category Staff | Different staff teams assigned to different ticket categories | Ticket Tool |
| Add/Remove Participants | Add or remove users from an open ticket | Ticket Tool |
| Ticket Naming | Configurable ticket channel naming format (number, username, custom prefix) | Ticket Tool |
| Ticket Limit | Maximum open tickets per user to prevent spam | Ticket Tool |

---

## 10. Economy System

> Virtual currency and shop system where members earn, spend, trade, and gamble with server-specific currency.

| Feature | Description | Bots |
|---|---|---|
| Server Currency | Custom-named virtual currency unique to each server | UnbelievaBoat, ProBot |
| Cash & Bank System | Dual balance system — cash can be robbed by others, bank is safe | UnbelievaBoat |
| Earning Commands (Work/Crime/Slut) | Commands to earn currency with configurable cooldowns, payouts, and failure penalties | UnbelievaBoat |
| Rob Command | Rob other users' cash balance with configurable success chance and penalties | UnbelievaBoat |
| Deposit / Withdraw | Move currency between cash and bank balances | UnbelievaBoat |
| Balance Check | View your own or another user's balance | UnbelievaBoat, ProBot |
| Leaderboard | Rankings by total wealth, cash, bank, or item count | UnbelievaBoat |
| Give / Pay | Transfer currency between users | UnbelievaBoat |
| Admin Money Commands | Add, remove, or set user balances as an administrator | UnbelievaBoat |
| Store & Items | Custom server shop with purchasable items that can grant roles or cosmetics | UnbelievaBoat |
| Inventory System | Personal collection of purchased items per user | UnbelievaBoat |
| Income Roles | Passive automatic currency earning for members with specific roles | UnbelievaBoat |
| Economy Multipliers | Role-based or channel-based earning multipliers | UnbelievaBoat |
| Taxes | Configurable tax system applied to transactions | UnbelievaBoat |
| Currency Customization | Custom emoji or symbol to represent the currency | UnbelievaBoat |
| Timely Rewards | Configurable periodic currency claims available at intervals | UnbelievaBoat |
| Daily Rewards / Credits | Daily currency claims and reputation system | ProBot |
| Casino Games (Blackjack, Roulette, Slots) | Gambling mini-games where members bet currency | UnbelievaBoat |
| Animal Racing | Bet on animal races as a gambling game | UnbelievaBoat |
| Pet System | Buy, train, and race pets using server currency | UnbelievaBoat |
| Public API | API for external integrations with the economy system | UnbelievaBoat |

---

## 11. Music

> Voice channel music playback with queue management, filters, and platform support.

| Feature | Description | Bots |
|---|---|---|
| Music Playback | Play music from platforms (YouTube, Spotify, SoundCloud) in voice channels | ProBot, MEE6 (limited) |
| Queue System | Add, view, skip, remove, and shuffle songs in the playback queue | ProBot, MEE6 |
| Loop / Repeat | Loop the current song or the entire queue | ProBot |
| Volume Control | Adjust the playback volume | ProBot |
| Pause / Resume | Pause and resume music playback | ProBot |
| Seek | Jump to a specific timestamp within the current track | ProBot |
| Playlist Support | Load full YouTube or Spotify playlists into the queue | ProBot |
| DJ Role | Restrict music control commands to a designated DJ role | ProBot |
| 24/7 Mode | Bot stays in voice channel continuously without auto-disconnect (Premium) | ProBot |
| Audio Filters | Apply sound effects: bass boost, nightcore, vaporwave, and more | ProBot |
| Music Quiz | Interactive music quiz game where members guess songs (Premium) | MEE6 |

---

## 12. Starboard

> Automatically repost popular messages (based on star/reaction count) to a highlights channel for community recognition.

| Feature | Description | Bots |
|---|---|---|
| Star Threshold | Configurable minimum star/reaction count for a message to qualify for the starboard | Carl-bot, ProBot, Dyno |
| Starboard Channel | Designated channel where qualifying messages are automatically reposted | Carl-bot, ProBot, Dyno |
| Self-Star Prevention | Prevent users from starring their own messages | Carl-bot |
| Ignored Channels | Exclude specific channels from starboard eligibility | Carl-bot |
| NSFW Handling | Route starred NSFW messages to a separate NSFW starboard | Carl-bot |
| Dynamic Updates | Star count on the repost updates as reactions change on the original | Carl-bot |
| Multiple Starboards | Different starboard configurations with separate emoji/threshold/channel settings (Premium) | Carl-bot |

---

## 13. Suggestion System

> Structured system for community members to submit, vote on, and track suggestions for the server.

| Feature | Description | Bots |
|---|---|---|
| Suggestion Channel | Clean embed format for suggestions posted to a dedicated channel | Carl-bot, Dyno, Zira |
| Upvote/Downvote | Automatic voting reactions added to each suggestion for community voting | Carl-bot, Dyno |
| Approval/Denial | Moderators can approve or deny suggestions with reasons | Carl-bot |
| Suggestion Numbering | Unique IDs for referencing and tracking individual suggestions | Carl-bot |
| Anonymous Mode | Hide the suggestion author's identity | Carl-bot |
| DM Notifications | Notify the suggestion author when the status changes | Carl-bot |
| Discussion Threads | Auto-create a thread under each suggestion for organized discussion | Carl-bot |

---

## 14. Giveaways

> Timed giveaway system with automated winner selection, role requirements, and reroll capabilities.

| Feature | Description | Bots |
|---|---|---|
| Timed Giveaways | Create giveaways with a countdown timer and automatic winner selection | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Role Requirements | Require participants to have specific roles to enter the giveaway | ProBot, Carl-bot, UnbelievaBoat |
| Multiple Winners | Select multiple winners from the participant pool | ProBot, UnbelievaBoat |
| Reroll | Re-select winners if the original winner doesn't respond or claim | Carl-bot |
| Bonus Entries | Grant bonus entries based on roles or invite count | UnbelievaBoat |
| Invite-Based Giveaways | Require a minimum number of invites to participate | Invite Tracker |

---

## 15. Social Media Feeds & Notifications

> Automated notifications when content is posted on external platforms like YouTube, Twitch, Reddit, and Twitter.

| Feature | Description | Bots |
|---|---|---|
| YouTube Notifications | Alert when subscribed channels upload new videos | MEE6, ProBot, Carl-bot, YAGPDB |
| Twitch Notifications | Alert when followed streamers go live with stream details | MEE6, ProBot, Carl-bot, Dyno |
| Twitter/X Notifications | Alerts for new tweets from specified accounts | MEE6, ProBot |
| Reddit Notifications | Post new content from specified subreddits with flair filtering | MEE6, Carl-bot, YAGPDB |
| RSS Feeds | Subscribe to any RSS/Atom feed with custom formatting and variables | Carl-bot |
| Custom Feed Formatting | Template-based formatting with variables for title, link, author, description | Carl-bot, YAGPDB |
| Multiple Feeds | Configure multiple feeds across different channels | Carl-bot |
| Social Media Notifications | Platform integration alerts for social media activity | Sapphire |

---

## 16. Analytics & Statistics

> Deep tracking and visualization of server activity including messages, voice time, member growth, and engagement patterns.

| Feature | Description | Bots |
|---|---|---|
| Message Tracking | Detailed message activity metrics per member and per channel | Statbot, Arcane |
| Voice Tracking | Time spent in voice chat tracked per member | Statbot |
| Online Status Tracking | Member online/offline/idle/DND patterns over time | Statbot |
| Game Activity Tracking | Track what games members play and for how long | Statbot |
| Hourly Data | Granular hourly activity data for precise analysis | Statbot |
| Per-Channel Data | Channel-level activity breakdown and comparison | Statbot |
| Per-Member Data | Individual member activity metrics and history | Statbot |
| Channel Counters (Statdocks) | Voice/text channel names that display live counters (member count, clocks, top active member) | Statbot |
| Activity-Based Role Rewards (Statroles) | Auto-grant and revoke roles based on current member activity levels (not permanent like leveling) | Statbot |
| Graphs & Charts | Visual data representation on web dashboard | Statbot |
| Heatmaps | Activity pattern visualization showing peak hours and days | Statbot |
| Trend Analysis | Identify growth and engagement trends over time | Statbot |
| Server Statistics | Track community metrics and growth | Arcane |
| Ticket Analytics | Response time, open/close rates, and staff performance metrics (Premium) | Ticket Tool |

---

## 17. Embed Builder

> Visual tools for creating rich Discord embeds with titles, descriptions, fields, colors, images, and footers.

| Feature | Description | Bots |
|---|---|---|
| Visual Embed Builder | GUI editor on web dashboard with all embed fields for creating rich messages | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Send Embeds | Send custom embeds to any channel via dashboard or slash command | ProBot, Carl-bot, Dyno |
| Edit Embeds | Edit previously sent embeds without resending | ProBot |
| Embed Variables | Dynamic variables and placeholders within embed content | ProBot, Carl-bot |
| Multiple Fields | Support for inline and full-width embed fields | ProBot |
| Embed Templates | Save and reuse embed templates | Carl-bot |

---

## 18. Verification System

> Challenge-based verification to confirm new members are human before granting server access.

| Feature | Description | Bots |
|---|---|---|
| Captcha Verification | Image-based CAPTCHA challenge that new members must solve | Wick Bot, Invite Tracker |
| Web Verification | Browser-based verification flow | Wick Bot |
| Instant Verification | Quick verification mode for low-risk environments | Wick Bot |
| Target Selection | Apply verification to all members or only suspicious accounts | Wick Bot |
| Button Verification | Simple button-click verification for new members | Invite Tracker |
| Join Gate / Firewall | Multi-condition entry filter: avatar required, account age, Discord verification, username patterns | Wick Bot |
| Avatar Filtering | Require a profile avatar for server entry | Wick Bot |
| Discord Verification | Require Discord-verified email or phone number | Wick Bot |
| Ad Detection | Block accounts with advertising content in their profile | Wick Bot |
| Username Pattern Filter | Block accounts with suspicious username patterns | Wick Bot |

---

## 19. Server Backup & Restore

> System for creating server snapshots and restoring them to recover from attacks or migrate servers.

| Feature | Description | Bots |
|---|---|---|
| Automated Backups | Capture full server structure: roles, channels, permissions, and settings | Xenon, Wick Bot |
| Message Backup | Full message history backup (Premium) | Xenon |
| Server Restoration | Restore server from saved snapshots | Xenon, Wick Bot |
| Template Cloning | Clone and distribute server templates to create identical servers | Xenon |
| Undo Functionality | Revert raids or compromises by restoring from backup | Xenon |
| Scheduled Auto-Backup | Automatic periodic backups on a schedule (Premium) | Xenon |

---

## 20. Invite Tracking

> Track which invite link each new member used, attribute invites to members, and provide invite leaderboards.

| Feature | Description | Bots |
|---|---|---|
| Invite Tracking | Track all invite links, their usage counts, and which member used which invite | ProBot, Invite Tracker, UnbelievaBoat |
| Source Attribution | Know exactly which invite link each new member used to join | Invite Tracker, ProBot |
| Top Inviters Leaderboard | Rank members by number of successful invites | Invite Tracker |
| Join/Leave Messages with Invite Source | Welcome/leave messages that include which invite was used and who invited them | Invite Tracker |
| Invite-Based Giveaways | Giveaway entry requirements based on invite count | Invite Tracker |

---

## 21. Temporary Voice Channels

> Auto-created voice channels that are generated when a member joins a trigger channel and deleted when empty.

| Feature | Description | Bots |
|---|---|---|
| Auto-Create Temp Channels | Automatically create a temporary voice channel when a member joins a designated channel | ProBot, Zira |
| Owner Controls | The channel creator has control over permissions, name, and user limit | ProBot |
| Auto-Delete | Channel is automatically deleted when all members leave | ProBot, Zira |
| Private Voice Channels | Users can create their own private voice channels with controlled access | Zira |

---

## 22. Polls

> Quick voting system for creating polls with multiple options and community participation.

| Feature | Description | Bots |
|---|---|---|
| Quick Polls | Create yes/no or multi-option polls with emoji reactions | Carl-bot, Dyno, UnbelievaBoat |
| Multiple Options | Support for up to 20 options per poll | Carl-bot |
| Timed Voting | Polls that automatically close after a set duration | Carl-bot |

---

## 23. Reminders

> Personal timed reminder system that notifies users via DM or channel message at a specified time.

| Feature | Description | Bots |
|---|---|---|
| Personal Reminders | Set timed reminders that notify you via DM when triggered | Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| Recurring Reminders | Reminders that repeat on a schedule | Carl-bot |

---

## 24. AFK System

> Auto-notify system that informs users when they mention someone who has set their status as AFK.

| Feature | Description | Bots |
|---|---|---|
| AFK Status | Set AFK status with a custom message; anyone who pings you gets auto-notified | Carl-bot, Dyno, UnbelievaBoat |

---

## 25. Scheduled / Timed Messages

> Automated messages posted on a recurring schedule (hourly, daily, weekly) to designated channels.

| Feature | Description | Bots |
|---|---|---|
| Timed/Scheduled Messages | Recurring auto-posted messages on configurable schedules (hourly, daily, weekly) | Dyno |
| Scheduled Commands | Run custom commands on cron-like schedules | YAGPDB |

---

## 26. Applications / Forms

> Custom application form system with accept/deny workflow for recruitment, verification, or moderation applications.

| Feature | Description | Bots |
|---|---|---|
| Custom Application Forms | Create forms with custom questions and accept/deny workflow | UnbelievaBoat |
| Role Rewards on Acceptance | Automatically assign roles when an application is approved | UnbelievaBoat |
| Modal Forms (Ticket Context) | Discord popup forms with custom questions as part of ticket creation | Ticket Tool |

---

## 27. Reputation System

> Point-based system where members can give each other reputation points to recognize helpfulness or contribution.

| Feature | Description | Bots |
|---|---|---|
| Reputation Points | Members give and receive reputation points for each other | YAGPDB, ProBot |
| Reputation Leaderboard | Server-wide reputation rankings | YAGPDB |
| Cooldowns | Rate limiting on how often reputation can be given | YAGPDB |

---

## 28. Recording & Transcripts

> Record voice channel conversations and generate text transcripts from audio.

| Feature | Description | Bots |
|---|---|---|
| Voice Recording | Record voice channel conversations (Premium) | MEE6 |
| Transcript Generation | Generate text transcripts of recorded voice conversations | MEE6 |

---

## 29. Fun & Utility Commands

> Entertainment and utility commands including trivia, memes, translation, and miscellaneous tools.

| Feature | Description | Bots |
|---|---|---|
| Fun Commands | Entertainment commands (cat facts, dog facts, memes, trivia, etc.) | YAGPDB (250+), UnbelievaBoat, Dyno |
| Translate | Text translation between languages | ProBot |
| Short Links | URL shortening utility | ProBot |
| Snipe / Editsnipe | Retrieve the most recently deleted or edited message in a channel | Carl-bot |
| Tags | Reusable text snippets for frequently asked questions | Dyno, UnbelievaBoat |
| Highlights | Get DM notifications when specific keywords are mentioned with surrounding context | Carl-bot |
| Soundboard | Play sound effects in voice channels | YAGPDB |
| Cleverbot | AI chatbot in designated channels for entertainment | Dyno |
| Profile Customization | Custom backgrounds, badges, and bio text on user profiles | ProBot |

---

## 30. Web Dashboard

> Browser-based graphical interface for configuring all bot settings without using commands.

| Feature | Description | Bots |
|---|---|---|
| Web Dashboard | Full GUI management via browser for all bot settings and configuration | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Wick Bot, Ticket Tool, Statbot |

---

## 31. Multi-Language Support

> Bot interface and responses available in multiple languages for international communities.

| Feature | Description | Bots |
|---|---|---|
| Multi-Language Support | Bot available in multiple languages for international servers | ProBot (20+ languages, full RTL/Arabic), MEE6 (limited), Carl-bot (limited), Dyno (limited) |

---

## 32. Open Source / Self-Hostable

> Source code is publicly available and the bot can be self-hosted for full control.

| Feature | Description | Bots |
|---|---|---|
| Open Source | Source code publicly available for review, contribution, or self-hosting | YAGPDB, GearBot |

---

## 33. Premium / Custom Bot Instance

> Premium feature allowing a custom bot with its own name, avatar, and branding replacing the shared bot.

| Feature | Description | Bots |
|---|---|---|
| Custom Bot Instance | Run the bot under your own name, avatar, and status message | ProBot, Dyno |
| No Branding | Remove the bot's default branding from messages and embeds | ProBot, Dyno, Ticket Tool |
| Priority Support | Faster support response times for premium subscribers | ProBot, Dyno |
| Increased Limits | Higher limits on custom commands, reaction roles, auto-responders, and other features | ProBot, Dyno |

---

## Quick Reference: Bots per Feature Category

| Feature Category | Number of Bots | Bots |
|---|---|---|
| Moderation | 8 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Auto-Moderation | 9 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, GearBot, Wick Bot, Sapphire |
| Anti-Raid & Anti-Nuke | 5 | MEE6, ProBot, Carl-bot, Dyno, Wick Bot |
| Leveling / XP | 4 | MEE6, ProBot, Arcane, Carl-bot (Premium) |
| Reaction Roles | 9 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Zira, Sapphire |
| Welcome & Farewell | 9 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Zira, Sapphire |
| Custom Commands | 8 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Logging & Audit | 8 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, UnbelievaBoat, GearBot, Sapphire |
| Ticket System | 3 | Ticket Tool, ProBot, Dyno |
| Economy | 2 | UnbelievaBoat, ProBot |
| Music | 2 | ProBot, MEE6 |
| Starboard | 3 | Carl-bot, ProBot, Dyno |
| Suggestions | 3 | Carl-bot, Dyno, Zira |
| Giveaways | 4 | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Social Media Feeds | 5 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB |
| Analytics & Statistics | 3 | Statbot, Arcane, Ticket Tool |
| Embed Builder | 4 | ProBot, Carl-bot, Dyno, UnbelievaBoat |
| Verification | 2 | Wick Bot, Invite Tracker |
| Server Backup | 2 | Xenon, Wick Bot |
| Invite Tracking | 3 | Invite Tracker, ProBot, UnbelievaBoat |
| Temp Voice Channels | 2 | ProBot, Zira |
| Polls | 3 | Carl-bot, Dyno, UnbelievaBoat |
| Reminders | 4 | Carl-bot, Dyno, YAGPDB, UnbelievaBoat |
| AFK System | 3 | Carl-bot, Dyno, UnbelievaBoat |
| Scheduled Messages | 2 | Dyno, YAGPDB |
| Applications / Forms | 2 | UnbelievaBoat, Ticket Tool |
| Reputation System | 2 | YAGPDB, ProBot |
| Recording | 1 | MEE6 |
| Fun & Utility | 6 | YAGPDB, UnbelievaBoat, Dyno, ProBot, Carl-bot |
| Web Dashboard | 10 | MEE6, ProBot, Carl-bot, Dyno, YAGPDB, Arcane, UnbelievaBoat, Wick Bot, Ticket Tool, Statbot |
| Multi-Language | 4 | ProBot, MEE6, Carl-bot, Dyno |
| Open Source | 2 | YAGPDB, GearBot |
| Custom Bot Instance | 2 | ProBot, Dyno |

---

## Best-in-Class by Feature

| Feature | Best Bot | Reason |
|---|---|---|
| Reaction Roles | Carl-bot | Most modes, button/dropdown support, up to 250 per message, web builder |
| Auto-Moderation | YAGPDB | Regex filters, chainable conditions, advanced scripting, custom strike system |
| Anti-Nuke/Security | Wick Bot | Quarantine, panic mode, heat system, auto-restore, join gate |
| Leveling/XP | Arcane | 3 leveling curves, weekly/monthly boards, reaction XP, prestige system |
| Economy | UnbelievaBoat | Full economy with shops, items, pets, casino, API |
| Custom Commands | Carl-bot / YAGPDB | Tagscript (Carl) and Go templates (YAGPDB) are industry-leading |
| Ticket System | Ticket Tool | Forms, transcripts, analytics, forums, priority, claim system |
| Analytics | Statbot | Deep tracking, Statroles, heatmaps, counters, trend analysis |
| Music | ProBot | Most complete remaining feature set with filters and 24/7 mode |
| Starboard | Carl-bot | Multiple starboards, NSFW handling, dynamic updates, self-star prevention |
| Logging | Carl-bot / Dyno | Comprehensive event tracking with multiple channels and case system |
| Welcome System | ProBot | Custom image cards with avatar, most customization options |
| Server Backup | Xenon | Dedicated backup/restore with message backup and scheduling |
| Invite Tracking | Invite Tracker | Dedicated tracking with attribution, leaderboards, and giveaway integration |
| Arabic/RTL Support | ProBot | Strongest Arabic community with full right-to-left language support |
| Suggestions | Carl-bot | Approval workflow, anonymous mode, threads, DM notifications |

---

*Generated from the [Discord Management Bots - Comprehensive Feature Analysis Report](discord-management-bots-feature-analysis.md)*