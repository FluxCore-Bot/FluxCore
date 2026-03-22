# FluxCore — UI/UX AI Agent Design Brief

> **Objective:** Design a complete, production-ready UI/UX system for **FluxCore** — including a **public landing page**, a **full dashboard application**, a **design system**, and **brand identity** — that positions FluxCore as a premium, modern Discord bot management platform.

---

## 1. PROJECT IDENTITY & CONTEXT

### What is FluxCore?

FluxCore is a **modular, self-hosted Discord bot framework** — an all-in-one platform for Discord server administrators to manage moderation, music playback, temporary voice channels, event-driven automation, and more — all through a sleek web dashboard and interactive Discord commands.

### Core Value Proposition

- **All-in-One:** Moderation, Music, Voice, Automation, Utilities — one bot, one dashboard.
- **Deep Customization:** Per-guild configuration for every feature with granular controls.
- **Self-Hosted & Open Source:** MIT licensed, Docker-ready, full control over data and infrastructure.
- **Developer-Friendly:** TypeScript monorepo, modular architecture, extensible system design.

### Target Audience

| Persona | Description | Needs |
|---------|-------------|-------|
| **Server Admins** | Discord community managers running servers of 100–50,000+ members | Easy setup, visual configuration, reliability |
| **Bot Developers** | Developers who want to self-host and extend the bot | Clean architecture, documentation, extensibility |
| **Power Users** | Tech-savvy server owners who want full control | Advanced features, automation rules, library management |
| **Community Builders** | People growing Discord communities for gaming, education, art, etc. | Onboarding tools, engagement features, moderation |

### Competitive Landscape

FluxCore competes with: **MEE6**, **Dyno**, **Carl-bot**, **Arcane**, **ProBot**, **Botify**. FluxCore differentiates through self-hosting, open source, deep customization, and a modern developer experience.

### Brand Personality

- **Modern & Technical** — Not playful/cartoon-y like MEE6; more like Linear, Vercel, or Raycast
- **Confident & Minimal** — Clean interfaces, purposeful whitespace, no clutter
- **Powerful but Approachable** — Complex features presented simply
- **Dark-First** — Native dark mode aesthetic aligned with Discord's visual language
- **Developer-Oriented** — Respects technical users while remaining accessible to non-developers

---

## 2. BRAND IDENTITY & DESIGN SYSTEM

### 2.1 Logo & Wordmark

Design a logo system for "FluxCore" that includes:

- **Logomark (Icon):** An abstract symbol representing flow/flux, connectivity, and a core/nucleus concept. Should work at 16×16 favicon size up to large hero displays. Consider geometric forms — interlocking shapes, orbital paths, energy flows, or abstract circuit/node patterns. Must be distinct and not resemble existing Discord bot logos.
- **Wordmark:** "FluxCore" typeset in a modern geometric or grotesque sans-serif. Consider a subtle visual treatment — e.g., "Flux" in regular weight + "Core" in bold, or a gradient accent on a specific letter.
- **Lockup Variants:** Horizontal (icon + wordmark), Stacked (icon over wordmark), Icon-only. Provide clear spacing rules.
- **Favicon:** Simplified version of the logomark, legible at 16×16 and 32×32.

### 2.2 Color System

Design a comprehensive color palette:

#### Primary Palette
| Token | Purpose | Notes |
|-------|---------|-------|
| `brand-primary` | Primary brand color, CTAs, links | Should feel electric/modern — consider electric indigo, vivid violet, or cyan-blue. Must have strong contrast on dark backgrounds |
| `brand-secondary` | Secondary accent, hover states, highlights | Complementary to primary |
| `brand-gradient` | Hero sections, premium feel | A smooth gradient using brand colors |

#### Semantic Colors
| Token | Purpose |
|-------|---------|
| `success` | Confirmations, enabled states, online indicators |
| `warning` | Caution states, pending actions |
| `danger` | Errors, destructive actions, offline states |
| `info` | Informational alerts, tips |

#### Surface & Background Colors (Dark Theme)
| Token | Purpose |
|-------|---------|
| `bg-base` | Page background (deepest layer) |
| `bg-surface` | Cards, panels, elevated containers |
| `bg-surface-hover` | Interactive surface hover state |
| `bg-surface-active` | Active/pressed surface state |
| `bg-overlay` | Modal/dialog backdrop |
| `bg-elevated` | Dropdowns, popovers, tooltips |

#### Text Colors
| Token | Purpose |
|-------|---------|
| `text-primary` | Headings, primary content |
| `text-secondary` | Body text, descriptions |
| `text-muted` | Placeholders, captions, disabled text |
| `text-inverse` | Text on brand-colored backgrounds |
| `text-on-surface` | Text on surface backgrounds |

#### Border Colors
| Token | Purpose |
|-------|---------|
| `border-default` | Default borders |
| `border-subtle` | Dividers, faint separators |
| `border-strong` | Focused inputs, active states |
| `border-brand` | Brand-colored borders for emphasis |

Ensure all color combinations meet **WCAG 2.1 AA** contrast ratios (4.5:1 for normal text, 3:1 for large text).

### 2.3 Typography

| Element | Font | Weight | Size | Line Height | Letter Spacing |
|---------|------|--------|------|-------------|----------------|
| **Display / Hero** | Inter or Geist Sans | 700–800 | 48–72px | 1.1 | -0.02em |
| **H1** | Inter or Geist Sans | 700 | 36–40px | 1.2 | -0.015em |
| **H2** | Inter or Geist Sans | 600 | 28–32px | 1.25 | -0.01em |
| **H3** | Inter or Geist Sans | 600 | 22–24px | 1.3 | -0.005em |
| **H4** | Inter or Geist Sans | 600 | 18–20px | 1.35 | 0 |
| **Body Large** | Inter or Geist Sans | 400 | 16–18px | 1.6 | 0 |
| **Body** | Inter or Geist Sans | 400 | 14–15px | 1.5 | 0 |
| **Body Small** | Inter or Geist Sans | 400 | 12–13px | 1.5 | 0.01em |
| **Caption** | Inter or Geist Sans | 500 | 11–12px | 1.4 | 0.02em |
| **Code / Mono** | JetBrains Mono or Geist Mono | 400 | 13–14px | 1.5 | 0 |
| **Label** | Inter or Geist Sans | 500 | 12–14px | 1.4 | 0.02em |

### 2.4 Spacing Scale

Use an 4px base unit system:

```
0: 0px
1: 4px
2: 8px
3: 12px
4: 16px
5: 20px
6: 24px
7: 32px
8: 40px
9: 48px
10: 56px
11: 64px
12: 80px
13: 96px
14: 128px
15: 160px
16: 192px
```

### 2.5 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0 | Sharp edges |
| `radius-sm` | 4px | Tags, badges, small pills |
| `radius-md` | 8px | Buttons, inputs, small cards |
| `radius-lg` | 12px | Cards, panels |
| `radius-xl` | 16px | Modals, large cards |
| `radius-2xl` | 24px | Hero sections, feature cards |
| `radius-full` | 9999px | Avatars, pills, toggles |

### 2.6 Shadow System

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | Subtle bottom shadow | Cards at rest |
| `shadow-md` | Medium elevation | Hovered cards, dropdowns |
| `shadow-lg` | Strong elevation | Modals, popovers |
| `shadow-glow` | Colored glow using brand-primary | CTAs, hero elements, feature highlights |
| `shadow-inner` | Inset shadow | Input fields, pressed states |

### 2.7 Animation & Motion

| Property | Value | Usage |
|----------|-------|-------|
| `duration-instant` | 100ms | Hover states, toggles |
| `duration-fast` | 150ms | Button interactions, micro-animations |
| `duration-normal` | 250ms | Page transitions, card expansions |
| `duration-slow` | 400ms | Modal entrance, complex transitions |
| `easing-default` | cubic-bezier(0.4, 0, 0.2, 1) | Standard interactions |
| `easing-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Bouncy/playful elements |
| `easing-ease-out` | cubic-bezier(0, 0, 0.2, 1) | Elements entering view |

### 2.8 Iconography

- Use a consistent icon set: **Lucide Icons** (open source, matches the aesthetic)
- Icon sizes: 16px (inline), 20px (buttons), 24px (navigation), 32px (features), 48px (hero)
- Stroke width: 1.5px–2px
- Always use outlined style, never filled (except for active/selected states)

---

## 3. COMPONENT LIBRARY

Design the following atomic and composite components. Each component needs: **default, hover, active, focus, disabled, loading, and error** states.

### 3.1 Primitives

| Component | Variants | Notes |
|-----------|----------|-------|
| **Button** | Primary, Secondary, Ghost, Danger, Outline, Icon-only, Loading | Sizes: sm, md, lg. Include icon+text combo. Primary uses brand gradient. |
| **Input** | Text, Number, Search, Password | With label, helper text, error state, prefix/suffix icons |
| **TextArea** | Default, Auto-resize | With character count |
| **Select / Dropdown** | Single, Multi, Searchable | With option groups, custom option rendering (for channels/roles with icons) |
| **Toggle / Switch** | Default, With label | On/off states with smooth animation |
| **Checkbox** | Default, Indeterminate | Group variant for multi-select |
| **Radio** | Default | Group variant |
| **Slider / Range** | Single, With value display | For volume controls, numeric limits |
| **Badge** | Default, Success, Warning, Danger, Info, Brand | Sizes: sm, md. For status indicators, counts |
| **Tag / Chip** | Default, Removable, Interactive | For filters, selected items |
| **Avatar** | Image, Fallback (initials), Server icon | Sizes: xs(24), sm(32), md(40), lg(48), xl(64). With online/offline indicator |
| **Tooltip** | Default | Positions: top, bottom, left, right. Dark bg with arrow |
| **Skeleton** | Text, Circle, Rectangle, Card | For loading states |

### 3.2 Layout Components

| Component | Description |
|-----------|-------------|
| **Card** | Elevated surface with optional header, body, footer. Variants: default, interactive (hover effect), outlined |
| **Divider** | Horizontal/vertical. Variants: solid, dashed, with label |
| **Stack** | Vertical/horizontal flex container with gap control |
| **Grid** | Responsive grid with breakpoint-aware columns |
| **Container** | Max-width wrapper with responsive padding |
| **Section** | Semantic page section with heading + description |
| **Sidebar Layout** | Fixed sidebar + scrollable main content |
| **Split View** | Two-panel layout with optional resizable divider |

### 3.3 Navigation Components

| Component | Description |
|-----------|-------------|
| **Navbar** | Top bar with logo, nav links, user menu. Sticky. Glass morphism optional |
| **Sidebar** | Collapsible sidebar with icon-only mode. Sections with labels. Active state indicator with brand accent |
| **Tabs** | Horizontal tab bar with underline indicator. Variants: underline, pill, boxed |
| **Breadcrumb** | Path navigation with separator |
| **Pagination** | Page numbers + prev/next. Compact variant for mobile |
| **Command Palette** | ⌘K search overlay — search commands, pages, settings |

### 3.4 Feedback Components

| Component | Description |
|-----------|-------------|
| **Toast / Notification** | Bottom-right stack. Types: success, error, warning, info. Auto-dismiss with progress bar. Swipe to dismiss |
| **Alert / Banner** | Inline alert with icon. Types: info, success, warning, danger. Dismissable variant |
| **Modal / Dialog** | Centered overlay. Sizes: sm, md, lg, full. With header, body, footer. Backdrop blur |
| **Confirm Dialog** | Specialized modal for destructive actions. Red danger styling |
| **Progress Bar** | Determinate/indeterminate. With label and percentage |
| **Empty State** | Illustration + message + CTA. For zero-data scenarios |
| **Error State** | Error illustration + message + retry button |

### 3.5 Data Display Components

| Component | Description |
|-----------|-------------|
| **Table** | Sortable columns, row selection, row actions menu, expandable rows, sticky header. Responsive: collapses to card list on mobile |
| **Data Card** | Stat display: icon + label + value + trend indicator |
| **List** | Clickable list items with icon, title, description, trailing action |
| **Key-Value Pair** | Label: Value display for detail views |
| **Code Block** | Syntax-highlighted code display with copy button |
| **Timeline** | Vertical timeline for activity/logs |

### 3.6 Form Components

| Component | Description |
|-----------|-------------|
| **Form Group** | Label + Input + Helper/Error text stack |
| **Form Section** | Grouped form fields with section title + description |
| **Channel Selector** | Discord channel dropdown with # icon, channel type indicators (text/voice/category) |
| **Role Selector** | Discord role dropdown with colored circles matching role colors |
| **Color Picker** | Preset grid + custom hex input |
| **Duration Input** | Combined number + unit (seconds/minutes/hours/days) selector |
| **Template Editor** | Text input with variable insertion buttons ({user}, {channel}, etc.) and preview |

---

## 4. LANDING PAGE DESIGN

### 4.1 Page Structure

Design a single-page marketing website with the following sections in order:

#### Section 1: Hero
- **Layout:** Full viewport height, centered content
- **Background:** Subtle animated gradient mesh or grid pattern with brand colors. Optionally: floating abstract 3D shapes or particle effects
- **Content:**
  - FluxCore logomark (animated entrance)
  - Headline: "The All-in-One Discord Bot Framework" (or better copy)
  - Subheadline: 1–2 sentences about self-hosted, modular, powerful, open source
  - **Primary CTA:** "Get Started" → links to documentation/setup guide
  - **Secondary CTA:** "View on GitHub" → GitHub repo link (with GitHub icon)
  - **Tertiary element:** "Star count" badge from GitHub
- **Social proof strip** below CTAs: "Trusted by X servers" or "Built with TypeScript, Discord.js, React"
- **Bottom:** Subtle scroll-down indicator (animated chevron)

#### Section 2: Feature Showcase
- **Layout:** Alternating left-right sections or bento grid
- **Design:** Each feature gets a card/section with:
  - Icon (from Lucide set)
  - Title
  - 2–3 sentence description
  - Visual: Screenshot, illustration, or interactive demo preview

**Features to highlight (in order of impact):**

1. **Interactive Music Player**
   - Visual: Mock of the Discord music player embed with buttons
   - Points: Two play modes (open + library), DJ roles, 24/7 mode, queue management, volume control

2. **Temporary Voice Channels**
   - Visual: Mock of the TempVoice control panel with button grid
   - Points: Auto-creation, user controls, settings persistence, ownership transfer

3. **Event-Driven Automation**
   - Visual: Flow diagram or rule builder mock showing event → condition → action
   - Points: 23 event types, 10 action types, template variables, conditional execution

4. **Smart Moderation**
   - Visual: Mock of moderation commands or audit log
   - Points: Ban, kick, timeout, clear, role hierarchy checks, reason tracking

5. **Web Dashboard**
   - Visual: Dashboard screenshot/mock showing guild management
   - Points: Discord OAuth, per-guild config, real-time sync, mobile responsive

6. **Self-Hosted & Open Source**
   - Visual: Docker/terminal illustration
   - Points: MIT license, Docker-ready, full data ownership, extensible architecture

#### Section 3: Dashboard Preview
- **Layout:** Full-width section with browser frame mockup
- **Content:** High-fidelity screenshot or interactive preview of the dashboard
- **Tabs or carousel** showing different dashboard pages: Guild selection → Rules → Music → TempVoice → Logs
- **Caption** for each view explaining the functionality

#### Section 4: Tech Stack / Architecture
- **Layout:** Horizontal icon strip or bento grid
- **Content:** Show the technology logos with labels:
  - TypeScript, React 19, Fastify, Discord.js v14, PostgreSQL, Prisma, Lavalink, Docker, Tailwind CSS, TanStack, Turborepo
- **Optional:** Brief architecture diagram showing monorepo structure (Bot ↔ Database ↔ Dashboard)

#### Section 5: Feature Comparison Table (Optional but impactful)
- Compare FluxCore vs MEE6, Dyno, Carl-bot on key differentiators:
  - Self-hosted ✓ vs ✗
  - Open Source ✓ vs ✗
  - No paywalled features ✓ vs ✗
  - Custom automation rules ✓ vs Limited
  - Music library mode ✓ vs ✗
  - TempVoice with persistence ✓ vs Basic

#### Section 6: Getting Started / Quick Setup
- **Layout:** Steps with terminal-style code blocks
- **Content:**
  ```
  Step 1: Clone the repository
  Step 2: Configure environment
  Step 3: Start with Docker Compose
  Step 4: Invite bot to your server
  ```
- Each step has an icon, title, and code snippet in a styled code block
- **CTA:** "Read Full Documentation"

#### Section 7: Community & Contribution
- **Layout:** Centered content block
- **Content:**
  - "Built by the community, for the community"
  - Links to: GitHub, Discord server (if exists), Documentation
  - Contributor avatars strip (pulled from GitHub)
  - "Contribute on GitHub" CTA

#### Section 8: Footer
- **Layout:** Multi-column footer
- **Columns:**
  - **Product:** Features, Dashboard, Documentation, Changelog
  - **Community:** GitHub, Discord, Contributing Guide
  - **Legal:** MIT License, Privacy (if applicable)
- **Bottom bar:** © 2026 FluxCore · "Built with ❤ and TypeScript"

### 4.2 Landing Page Interactions & Polish

- **Scroll animations:** Fade-in-up on section entry (use Intersection Observer, not heavy libraries)
- **Navbar:** Transparent on hero → solid on scroll with backdrop blur
- **Feature cards:** Subtle hover lift with shadow-glow
- **Code blocks:** Typing animation on first view
- **CTAs:** Gradient background with subtle shimmer/glow effect on hover
- **Dark mode only** — no light mode toggle needed for landing page (matches Discord aesthetic)

---

## 5. DASHBOARD DESIGN

### 5.1 Global Layout

```
┌──────────────────────────────────────────────────────┐
│  Top Navbar (sticky)                                  │
│  [Logo] [Breadcrumb]              [Notifications] [User Menu] │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │  Main Content Area                      │
│  (fixed)   │  (scrollable)                           │
│            │                                         │
│  [Home]    │  ┌─────────────────────────────────┐   │
│  [Music]   │  │  Page Header                     │   │
│  [Voice]   │  │  Title + Description + Actions   │   │
│  [Actions] │  ├─────────────────────────────────┤   │
│  [Logs]    │  │                                  │   │
│  [Settings]│  │  Page Content                    │   │
│            │  │                                  │   │
│  ────────  │  │                                  │   │
│  [Docs]    │  │                                  │   │
│  [Support] │  └─────────────────────────────────┘   │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

- **Sidebar:** 240px wide, collapsible to 64px (icon-only mode). Shows guild icon + name at top. Navigation grouped by category. Active item has brand-color left border accent + tinted background.
- **Top Navbar:** 56px height. Contains: logo/hamburger (mobile), breadcrumb path, search trigger (⌘K), notification bell, user avatar + dropdown.
- **Main Content:** Max-width 1200px, centered with responsive padding. Scrollable independently.
- **Mobile (<768px):** Sidebar becomes a slide-out drawer triggered by hamburger icon. Bottom navigation bar for primary sections.

### 5.2 Page Designs

---

#### 5.2.1 Authentication Pages

**Login Page (`/auth/login`)**
- Centered card on dark background with subtle gradient
- FluxCore logo at top
- "Sign in with Discord" button (Discord's blurple color with Discord logo)
- Brief explanation: "Sign in to manage your Discord servers"
- Footer: links to docs, GitHub

**OAuth Callback (`/auth/callback`)**
- Loading spinner with "Connecting to Discord..." message
- Auto-redirects on success

---

#### 5.2.2 Guild Selection Page (`/` — Home)

**Purpose:** Select which server to manage

**Layout:**
- Page header: "Your Servers" with subtitle "Select a server to manage"
- Search/filter bar to find servers by name
- Responsive grid of Guild Cards (3 columns desktop, 2 tablet, 1 mobile)

**Guild Card Design:**
- Server icon (64px avatar with fallback to initials)
- Server name (bold)
- Member count (muted text)
- Bot status indicator (green dot = bot active)
- Hover: subtle lift + border glow
- Click: navigates to guild dashboard

**Empty State:**
- If no guilds: "No servers found" + "Invite FluxCore to a server" CTA
- If not admin anywhere: "You need Manage Server permission" explanation

---

#### 5.2.3 Guild Dashboard Overview (`/guild/:id`)

**Purpose:** At-a-glance status of all features for this guild

**Page Header:**
- Guild icon + name (large)
- "Manage [Server Name]" subtitle
- Guild stats strip: member count, bot uptime, active features count

**Content: Feature Status Grid (Bento Layout)**

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Music System   │  TempVoice      │  Action Rules    │
│   ● Active       │  ● 3 Hubs       │  ● 12 Rules      │
│   Mode: Library  │  Active Channels │  7 Active         │
│   Now Playing:.. │  ────           │  ────              │
│   [Manage →]     │  [Manage →]     │  [Manage →]       │
├─────────────────┼─────────────────┼─────────────────┤
│  Moderation      │  Recent Logs     │  Quick Actions    │
│  Last action:    │  ▸ Rule "Welcome"│  [Invite Bot]     │
│  Timeout @user   │  ▸ Rule "AutoMod"│  [View Docs]      │
│  2 hours ago     │  ▸ 3 more...     │  [Support]        │
│  [View Logs →]   │  [All Logs →]    │                   │
└─────────────────┴─────────────────┴─────────────────┘
```

Each card shows:
- Feature icon + name
- Status (enabled/disabled with toggle or indicator)
- Key metrics (1–2 numbers)
- Quick action link to feature page

**Activity Feed (Below grid):**
- Recent 5 action logs as a compact timeline
- Each entry: timestamp, rule name, event type, status badge

---

#### 5.2.4 Music Management Page (`/guild/:id/music`)

**Page Header:**
- "Music System" title
- Status badge (Active/Inactive)
- Description: "Configure music playback settings and manage your library"

**Tab Bar:** `Settings` | `Library`

**Settings Tab:**

Form layout with sections:

**Section: Playback Mode**
- Radio group: "Open Mode" (anyone can search & play) vs "Library Mode" (curated albums only)
- Info banner explaining each mode

**Section: Permissions**
- DJ Role selector (role dropdown with colored indicators)
- Helper text: "Only users with this role can use DJ commands. Leave empty to allow everyone."

**Section: Playback Settings**
- Default Volume: Slider (0–100%) with real-time value display
- Max Queue Size: Number input (1–500) with stepper buttons
- Auto-Disconnect Timeout: Duration input (number + unit selector: seconds/minutes)
- 24/7 Mode: Toggle switch with description "Keep the bot connected even when no one is listening"

**Section: Save**
- "Save Changes" primary button (disabled when no changes, loading state on submit)
- "Reset to Defaults" ghost button

**Library Tab (visible in Library Mode):**

**Album Grid:**
- Header: "Music Library" + "Create Album" button
- Grid of album cards (2–3 columns)
- Each album card:
  - Album name (editable inline)
  - Track count badge
  - Expand/collapse chevron
  - Delete button (with confirm dialog)

**Expanded Album → Track List:**
- Table: # | Title | Duration | Source | Actions
- "Add Track" row at bottom with URL/search input
- Each track: play preview (if possible), delete button
- Drag-to-reorder (optional)

**Empty State:**
- "No albums yet" + illustration
- "Create your first album to get started" + CTA button

---

#### 5.2.5 TempVoice Management Page (`/guild/:id/tempvoice`)

**Page Header:**
- "Temporary Voice Channels" title
- Description: "Configure hub channels that auto-create temporary voice channels"

**Content:**

**Config List (Card layout):**
- Each config as a card:
  - Hub channel name (with 🔊 voice icon)
  - Category assignment (if set)
  - Name template display (e.g., `{user}'s Channel`)
  - Created date
  - Edit button → opens edit form
  - Delete button → confirm dialog

**Create/Edit Form (in modal or slide-out panel):**
- Hub Channel: Voice channel selector (filtered to show only voice channels)
- Category: Category channel selector (optional)
- Name Template: Text input with variable helper
  - Variable chips below: `{user}` (click to insert)
  - Preview: "Preview: JohnDoe's Channel"
- Save / Cancel buttons

**Limits Notice:**
- Info banner: "Maximum 5 hub configurations per server"
- Show X/5 used

---

#### 5.2.6 Action Rules Page (`/guild/:id/actions`)

**Page Header:**
- "Automation Rules" title
- Description: "Create event-driven rules that automatically respond to Discord events"
- "Create Rule" primary CTA button

**Content:**

**Rules Table:**
| Enabled | Name | Event | Actions | Priority | Last Triggered | Actions |
|---------|------|-------|---------|----------|---------------|---------|
| Toggle  | Welcome Message | Member Join | Send Message | 1 | 2 hours ago | Edit · Delete |

- Sortable by any column
- Filter bar: search by name, filter by event type, filter by enabled/disabled
- Bulk actions: enable/disable selected
- Empty state: "No rules yet. Create your first automation rule."

**Create/Edit Rule (Full page or large modal):**

**Step-by-step form or sectioned single page:**

**Section 1: Basic Info**
- Rule Name: Text input
- Priority: Number input (for execution order)
- Enabled: Toggle

**Section 2: Trigger Event**
- Event Type: Searchable dropdown with grouped options:
  - **Member Events:** memberJoin, memberLeave, memberBanned, memberUnbanned
  - **Message Events:** messageCreated, messageDeleted
  - **Role Events:** roleAdded, roleRemoved
  - **Channel Events:** channelCreated, channelDeleted
  - **Voice Events:** voiceJoin, voiceLeave
  - **Reaction Events:** reactionAdded, reactionRemoved
  - **Other Events:** nicknameChanged, memberTimeout, threadCreated, boostStart, boostEnd
- Each option shows an icon + description

**Section 3: Conditions (Optional)**
- Collapsible section
- Include/Exclude Channels: Multi-channel selector
- Include/Exclude Roles: Multi-role selector
- Include/Exclude Users: User ID input (multi)

**Section 4: Actions**
- "Add Action" button (max 5 per rule)
- Each action row:
  - Action Type dropdown: sendMessage, sendEmbed, sendDM, addRole, removeRole, logToChannel, sendWebhook, setNickname, createThread, addReaction
  - Dynamic fields based on action type:
    - `sendMessage`: Channel selector + Template editor
    - `sendEmbed`: Channel selector + Embed builder (title, description, color, footer, fields)
    - `sendDM`: Template editor
    - `addRole` / `removeRole`: Role selector
    - `logToChannel`: Channel selector
    - `sendWebhook`: URL input (HTTPS validated) + Template editor
    - `setNickname`: Template editor
    - `createThread`: Template editor for thread name
    - `addReaction`: Emoji picker
  - Remove action button (trash icon)

**Template Editor Sub-Component:**
- Text area with toolbar
- Variable insertion buttons: `{user}`, `{user.mention}`, `{user.tag}`, `{channel}`, `{channel.mention}`, `{guild}`, `{guild.memberCount}`, `{role}`, `{timestamp}`
- Live preview panel showing rendered template with sample data

**Save button** with validation (name required, at least one action, valid action configs)

---

#### 5.2.7 Action Logs Page (`/guild/:id/logs`)

**Page Header:**
- "Execution Logs" title
- Description: "View the history of automated rule executions"

**Filters Bar:**
- Date range picker
- Rule name filter (searchable dropdown)
- Event type filter (dropdown)
- Status filter: All | Success | Error

**Logs Table:**
| Time | Rule | Event Type | Action Type | Status | Error |
|------|------|-----------|-------------|--------|-------|
| Mar 22, 14:32 | Welcome Message | memberJoin | sendMessage | ✓ Success | — |
| Mar 22, 14:30 | Auto Role | memberJoin | addRole | ✗ Error | Missing permissions |

- Status column: Green badge for success, red badge for error
- Error column: Truncated with expand-on-click
- Pagination: 25 per page with page numbers
- Export button (CSV/JSON)

**Log Detail (Expandable Row or Side Panel):**
- Full error message/stack trace
- Rule configuration at time of execution
- Trigger event details (user, channel, etc.)
- Execution duration

---

#### 5.2.8 Guild Settings Page (`/guild/:id/settings`)

**Page Header:**
- "Server Settings" title
- Description: "Configure global settings for your server"

**Sections:**

**Section: Action System**
- Max Rules Per Server: Number input (1–100)
- Log Channel: Channel selector (optional, for action execution logs)
- Enabled: Toggle switch with "Enable/disable the entire action system"

**Section: General Bot Settings (Future)**
- Bot prefix (if applicable)
- Language selector
- Timezone selector

**Section: Danger Zone**
- Red-bordered section at bottom
- "Reset All Settings" button with confirm dialog
- "Remove Bot Data" button with double-confirm

---

#### 5.2.9 User Profile / Account Page (Global, not per-guild)

**Accessible from user avatar dropdown in navbar**

**Content:**
- Discord avatar + username display
- Connected Discord account info
- Active sessions list
- "Sign Out" button
- "Sign Out of All Devices" in danger zone

---

### 5.3 Dashboard Interactions & Polish

- **Page transitions:** Subtle fade + slide when navigating between pages
- **Form auto-save indicator:** "Unsaved changes" warning when navigating away
- **Optimistic updates:** Toggle switches, enable/disable actions update instantly with rollback on error
- **Loading states:** Skeleton screens matching the final layout (not generic spinners)
- **Error boundaries:** Per-section error handling with retry buttons
- **Keyboard navigation:** Full keyboard support, visible focus rings (brand-colored)
- **Responsive breakpoints:**
  - Desktop: ≥1280px (full sidebar + content)
  - Laptop: 1024–1279px (compact sidebar)
  - Tablet: 768–1023px (collapsed sidebar, drawer)
  - Mobile: <768px (bottom nav, stacked layout, full-width cards)

---

## 6. PLANNED FEATURE PAGES (Design for future implementation)

Design these pages even though they are not yet built — the design should be ready when development begins:

### 6.1 Welcome & Goodbye System (`/guild/:id/welcome`)
- Enable/disable toggle
- Welcome channel selector
- Message template editor with embed builder
- DM welcome toggle + template
- Auto-role selector (roles to assign on join)
- Goodbye channel + message template
- Preview panel showing how the welcome/goodbye message will look in Discord

### 6.2 Leveling System (`/guild/:id/leveling`)
- Enable/disable toggle
- XP rate settings (per message, per voice minute)
- Level-up notification channel + message template
- Role rewards table: Level → Role assignment
- Ignored channels/roles
- Leaderboard preview

### 6.3 Reaction Roles (`/guild/:id/reaction-roles`)
- Create reaction role panel: select message, assign emoji → role pairs
- Button roles: create button grid → role assignment
- Dropdown roles: create dropdown menu → role assignment
- Preview of how it looks in Discord

### 6.4 Ticket System (`/guild/:id/tickets`)
- Ticket panel creation (channel + button text + embed)
- Ticket category settings
- Staff roles assignment
- Auto-close settings (inactivity timeout)
- Transcript settings (channel + format)
- Ticket statistics dashboard (open, closed, avg response time)

### 6.5 Logging System (`/guild/:id/logging`)
- Enable/disable per event category
- Channel assignment per log type:
  - Message logs (edits, deletes)
  - Member logs (joins, leaves, bans)
  - Role logs (assignments, removals)
  - Voice logs (joins, leaves, moves)
  - Channel logs (creates, deletes, updates)
- Log format settings (embed style, compact, verbose)

### 6.6 Economy System (`/guild/:id/economy`)
- Currency name + emoji
- Daily reward amount + streak bonuses
- Work command cooldown + payout range
- Shop item management (name, price, role/action)
- Leaderboard settings

### 6.7 Moderation Dashboard (`/guild/:id/moderation`)
- Active bans/timeouts list with unban/untimeout actions
- Warning system: view/add/remove warnings per user
- Auto-mod settings: spam detection, caps filter, invite filter, banned words
- Moderation statistics: actions over time chart

### 6.8 Security & Anti-Abuse (`/guild/:id/security`)
- Anti-nuke settings (action thresholds per time window)
- Anti-raid settings (join rate detection)
- Account age filter (minimum account age to join)
- Verification level settings
- Server snapshot management (create/restore)

---

## 7. RESPONSIVE DESIGN SPECIFICATIONS

### Breakpoints
| Name | Min Width | Sidebar | Layout |
|------|-----------|---------|--------|
| Mobile | 0px | Hidden (drawer) | Single column, bottom nav |
| Tablet | 768px | Collapsed (icons only) | Flexible grid |
| Laptop | 1024px | Expanded (narrow, 200px) | 2-column forms |
| Desktop | 1280px | Full (240px) | Full layout |
| Wide | 1536px | Full + extra content padding | Max-width content |

### Mobile-Specific Patterns
- **Bottom Navigation Bar:** 5 icons for primary sections (Home, Music, Voice, Rules, Settings)
- **Cards stack vertically** instead of grid
- **Tables convert to card lists** with key data visible, details on tap
- **Forms go full-width** with larger touch targets (min 44×44px)
- **Modals become full-screen sheets** sliding up from bottom
- **Sidebar becomes a slide-out drawer** with overlay backdrop

---

## 8. ACCESSIBILITY REQUIREMENTS

- All interactive elements must be keyboard accessible
- Focus indicators must be visible and use brand colors (not browser default)
- Color is never the only way to convey information (always pair with icons/text)
- All images/icons have appropriate alt text or aria-labels
- Form inputs have associated labels (not just placeholders)
- Error messages are announced to screen readers (aria-live)
- Modals trap focus and return focus on close
- Minimum touch target size: 44×44px
- Reduced motion: respect `prefers-reduced-motion` media query
- Semantic HTML: proper heading hierarchy, landmarks, lists

---

## 9. DESIGN DELIVERABLES EXPECTED

Please produce the following:

### 9.1 Design System
1. **Color palette** with all tokens, hex values, and usage guidelines
2. **Typography scale** with font specimens and hierarchy examples
3. **Spacing and sizing scales** with visual references
4. **Complete component library** with all states (default, hover, active, focus, disabled, loading, error)
5. **Icon guidelines** with size and usage rules
6. **Animation/motion specifications**
7. **Shadow and elevation system**

### 9.2 Landing Page
1. **Full-page design** at desktop (1440px), tablet (768px), and mobile (375px) widths
2. **All sections** as specified in Section 4
3. **Interaction annotations** (hover states, scroll animations, transitions)
4. **Hero section** with multiple creative options (at least 2 variants)

### 9.3 Dashboard
1. **All page designs** listed in Section 5 at desktop and mobile widths
2. **All future feature pages** listed in Section 6 at desktop width
3. **Navigation states** (sidebar expanded, collapsed, mobile drawer)
4. **All form states** (empty, filled, error, loading, success)
5. **All empty states** (zero-data for each page)
6. **Loading/skeleton states** for each page

### 9.4 Branding
1. **Logo** in all variants (logomark, wordmark, lockups) in SVG format
2. **Favicon** set (16×16, 32×32, 180×180 Apple Touch, 512×512 for PWA)
3. **Open Graph image** (1200×630) for social sharing
4. **Brand guidelines document** covering logo usage, spacing, color dos/don'ts

---

## 10. TECHNICAL CONSTRAINTS

- **Framework:** React 19 with TanStack Router
- **Styling:** Tailwind CSS 4 (utility-first, CSS variable tokens)
- **Icons:** Lucide React
- **Fonts:** Loaded via Google Fonts or self-hosted (WOFF2)
- **No component library dependency** — all components are custom-built
- **Dark mode only** — no light mode required (may be added later)
- **CSS Variables** for all design tokens (enabling future theming)
- **Animations:** CSS transitions/animations preferred. Framer Motion for complex interactions only.
- **Bundle size matters** — avoid heavy illustration libraries or unnecessary assets

---

## 11. DESIGN PRINCIPLES

1. **Discord-Native Feel:** The dashboard should feel like a natural extension of Discord — familiar dark tones, similar spacing, recognizable patterns.
2. **Information Density:** Show meaningful data without overwhelming. Progressive disclosure — summary first, details on demand.
3. **Immediate Feedback:** Every action should have visible, instant feedback (optimistic updates, loading indicators, success confirmations).
4. **Consistent Patterns:** Same interaction pattern for same action type across all pages. If you edit rules in a modal, edit TempVoice configs in a modal too.
5. **Error Prevention:** Disable destructive actions by default, require confirmation for deletions, validate inputs before submission.
6. **Zero Configuration to Start:** Sensible defaults everywhere. A new guild should work with zero configuration, but allow deep customization for power users.
7. **Performance Perception:** Skeleton screens, optimistic updates, and pre-fetching make the app feel fast even on slow connections.

---

*This prompt represents the complete design specification for FluxCore's visual identity and user experience. The AI agent should use this as the authoritative source for all design decisions.*
