# FluxCore Design System — "The Obsidian Engine"

## Overview

FluxCore is a modular Discord bot framework with an integrated admin dashboard. The design system treats the UI as a high-precision technical instrument — dark, dense where necessary, and breathable where it matters.

**Stitch Project:** `projects/15282765930401294642` (FluxCore Design Brief)

---

## Brand Identity

- **Name:** FluxCore
- **Tagline:** Modular Discord Bot Framework
- **Aesthetic:** Dark, technical, premium — like a single carved piece of obsidian
- **Icon Style:** Lucide icons at 1.5px stroke weight — light and airy

---

## Color Palette

### Core
| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0e0e10` | Absolute base |
| `primary` | `#a3a6ff` | Critical actions, brand moments |
| `primary-dim` | `#6063ee` | Gradient endpoints, secondary emphasis |
| `secondary` | `#ac8aff` | Technical accents, syntax highlighting |
| `on-primary` | `#0f00a4` | Text on primary surfaces |

### Surface Tiers (Tonal Architecture)
| Token | Hex | Level |
|-------|-----|-------|
| `surface-lowest` | `#000000` | Recessed areas, code blocks |
| `surface-low` | `#131315` | Main content areas |
| `surface-container` | `#19191c` | Container default |
| `surface-high` | `#1f1f22` | Elevated cards |
| `surface-hover` | `#262528` | Hover states, active tabs |
| `surface-bright` | `#2c2c2f` | Brightest surface |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `danger` | `#ff6e84` | Errors, destructive actions |
| `success` | `#57f287` | Success states |
| `warning` | `#fee75c` | Warnings |
| `info` | `#60a5fa` | Informational |
| `discord` | `#5865F2` | Discord brand integration |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text` | `#f9f5f8` | Primary text (never pure white) |
| `text-muted` | `#adaaad` | Secondary/muted text |

### Border & Outline
| Token | Hex | Usage |
|-------|-----|-------|
| `border` | `#1f1f22` | Default borders |
| `outline` | `#767577` | Visible outlines |
| `outline-variant` | `#48474a` | Ghost borders (10-15% opacity) |
| `ring` | `#a3a6ff` | Focus rings |

---

## Typography

| Role | Font | Usage |
|------|------|-------|
| Body | Inter | All UI controls, headers, descriptions |
| Label | Space Grotesk | Technical metadata, small tags |
| Mono | JetBrains Mono | Bot tokens, JSON, logs, metrics |

### Scale
- **Display-LG (3.5rem):** Hero, high-level status
- **Headline-SM (1.5rem):** Page headers — `font-weight: 600`, `letter-spacing: -0.02em`
- **Label-MD (0.75rem):** Technical metadata (Space Grotesk)
- **Body-MD (0.875rem):** Standard UI text

---

## Elevation & Depth

Elevation = surface shift, not shadow.

- **Level 0:** `background` (#0e0e10)
- **Level 1:** `surface-low` — large content blocks
- **Level 2:** `surface-high` — interactive cards/modules
- **Level 3:** `surface-hover` — tooltips, dropdowns

### Shadows
- Ambient: `0px 8px 32px rgba(0, 0, 0, 0.4)`
- "Powered-on" glow: `0px 0px 12px 0px rgba(99, 102, 241, 0.15)`
- Ghost border: `1px solid outline-variant` at 10% opacity

### Glassmorphism (modals, command palettes)
- Background: `surface-high` at 70% opacity
- Blur: `backdrop-filter: blur(12px)`
- Edge: 1px ghost border at 15% opacity

---

## Border Radius
| Token | Value |
|-------|-------|
| `sm` | 0.25rem (4px) |
| `DEFAULT` / `md` | 0.5rem (8px) |
| `lg` | 0.75rem (12px) |
| `xl` | 1rem (16px) |
| `full` | 9999px |

---

## Components

### Buttons
- **Primary:** Gradient `primary` → `primary-dim`, high contrast text
- **Secondary:** Ghost — no bg, 1px outline-variant (20% opacity), hover → surface-hover
- **Tertiary:** Text only, primary color

### Inputs
- **Base:** `surface-lowest` bg, no border
- **Focus:** 1px primary border + primary outer glow (4px blur, 10% opacity)
- **Technical data:** Auto-switch to mono font

### Cards & Lists
- No dividers between list items
- Use 0.625rem vertical spacing
- Subtle `surface-high` background on hover

### Status Indicators
- **Active:** Primary pulse (soft glow)
- **Error:** Danger with `error-container` background glow
- **Idle:** Outline grey

---

## Icon System

### Libraries
- **React Components:** `lucide-react` — 1.5px stroke weight, light and airy
- **Web Font Fallback:** Material Symbols Outlined (Google Fonts) — 24px, weight 400
- **Style:** Outlined, not filled

### Favicon
- **Format:** SVG (modern browsers) with gradient `#a3a6ff` → `#6063ee`
- **Mark:** Geometric "FC" monogram on `#0e0e10` background
- **Variants:**
  - `favicon.svg` — Rounded square (app icon)
  - `favicon-circle.svg` — Circular (avatar/profile)
  - `favicon-mark.svg` — Raw mark (no background)
- **Location:** `apps/dashboard/public/`
- **Manifest:** `site.webmanifest` with theme color `#0e0e10`

### Icon Reference (Lucide names)

| Category | Icons |
|----------|-------|
| **Navigation** | LayoutDashboard, Home, Settings, Menu, ChevronLeft/Right/Down/Up, ArrowLeft/Right, ExternalLink, PanelLeft |
| **Bot Core** | Bot, Server, Hash, Terminal, Shield, Key, Webhook, Database, Code, Plug |
| **Music** | Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, ListMusic, Music, Disc, Headphones, Radio, Mic |
| **Moderation** | Hammer, UserX, Clock, VolumeOff, AlertTriangle, Flag, Lock, Unlock, Eye, EyeOff, Trash2, Filter |
| **Voice** | Headphones, Mic, MicOff, Phone, PhoneOff, Users, UserPlus, UserMinus, Speaker |
| **Actions** | Plus, Pencil, Trash, Save, X, Search, SlidersHorizontal, ArrowUpDown, RefreshCw, Download, Upload, Copy, MoreHorizontal |
| **Status** | CheckCircle, XCircle, AlertTriangle, Info, Clock, Loader, Wifi, WifiOff, Zap, Activity, Heart, Star |
| **Content** | Type, Image, File, Folder, Paperclip, Link, Bookmark, Tag, Hash, AtSign, Calendar, Globe |
| **Dashboard** | BarChart3, PieChart, TrendingUp, TrendingDown, Gauge, Table2, LayoutGrid, List, Columns3, Maximize2 |
| **System** | Settings, Wrench, Bell, BellOff, ScrollText, History, Cloud, Server, Cpu, HardDrive |
| **Users** | User, Users, UserPlus, UserMinus, UserCheck, UserX, Crown, BadgeCheck, Shield |

### Material Symbols Reference (for non-React contexts)
`dashboard`, `home`, `settings`, `menu`, `smart_toy`, `dns`, `tag`, `terminal`, `extension`, `shield`, `key`, `link`, `api`, `database`, `code`, `play_arrow`, `pause`, `stop`, `skip_next`, `skip_previous`, `shuffle`, `repeat`, `volume_up`, `queue_music`, `graphic_eq`, `mic`, `album`

---

## Rules

1. **No-Line Rule:** No 1px borders for sectioning — use surface shifts
2. **No Pure White:** Use `#f9f5f8` for text
3. **Max 3 Depth Levels:** If you need a 4th, simplify the IA
4. **No Dividers in Lists:** Use spacing + hover backgrounds
5. **Technical Data in Mono:** Auto-switch inputs with technical content
