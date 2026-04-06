# Welcome Page — UI Audit

**File:** `apps/dashboard/src/client/routes/guild/$guildId/welcome.tsx`
**Sub-components:**
- `apps/dashboard/src/client/components/WelcomeImageEditor.tsx` (inline `EmbedEditor` defined in page file)

---

## Structure

### Full Layout Hierarchy

```
div.space-y-8
  PageHeader (title, subtitle)
  Tabs (defaultValue="welcome")
    TabsList
      TabsTrigger[value="welcome"]
      TabsTrigger[value="welcome-image"]
      TabsTrigger[value="farewell"]
      TabsTrigger[value="farewell-image"]
      TabsTrigger[value="dm"]
      TabsTrigger[value="autorole"]
    TabsContent[value="welcome"]
      Card.bg-surface.p-6
        div.mb-6.flex.items-center.justify-between
          div > h3 + p.text-sm.text-text-muted
          Switch (welcomeEnabled)
        Separator.mb-6
        div.mb-6 > Label + Input (channel ID)
        h4.mb-3.text-sm.font-semibold (embed builder heading)
        EmbedEditor (welcomeMessage)
    TabsContent[value="welcome-image"]
      Card.bg-surface.p-6
        div.mb-6.flex.items-center.justify-between
          div > h3 + p.text-sm.text-text-muted
          Switch (welcomeImageEnabled)
        Separator.mb-6
        WelcomeImageEditor (conditional: enabled) | p.text-sm.text-text-muted (disabled)
    TabsContent[value="farewell"]
      Card.bg-surface.p-6  (mirrors welcome tab structure)
    TabsContent[value="farewell-image"]
      Card.bg-surface.p-6  (mirrors welcome-image tab structure)
    TabsContent[value="dm"]
      Card.bg-surface.p-6
        div.mb-6.flex.items-center.justify-between
          div > h3 + p.text-sm.text-text-muted
          Switch (dmEnabled)
        Separator.mb-6
        h4.mb-3.text-sm.font-semibold
        EmbedEditor (dmMessage)
    TabsContent[value="autorole"]
      Card.bg-surface.p-6
        h3 + p.text-sm.text-text-muted
        Separator.mb-6
        div > Label + Input (role IDs, comma-separated)
  div.flex.gap-3   (Action buttons)
    Button (Save Changes)
    Button[variant="outline"] (Send Test)
```

### EmbedEditor Component Tree (inline)

```
div.space-y-4
  div > Label + Input (embed title)
  div > Label + Textarea[rows=3] (embed description)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-2
    div > Label + Input[type=text] (color hex)
    div > Label + Input (footer)
  div.grid.grid-cols-1.gap-4.sm:grid-cols-2
    div > Label + Input (thumbnail URL)
    div > Label + Input (image URL)
  p.text-xs.text-text-muted (variable reference)
```

### WelcomeImageEditor Component Tree

```
div.space-y-6
  div (Live Preview)
    div.mb-2.flex.items-center.gap-2
      Eye icon + Label + Button[ghost,sm] (Refresh)
    div.overflow-hidden.rounded-lg.border.border-border/50.bg-background
      img (preview) | div.flex.h-48 (placeholder)
  Separator
  div (Template Selection)
    div.mb-3 > Sparkles icon + Label
    div.grid.grid-cols-2.gap-2.sm:grid-cols-3
      button (per template, styled border)
  Separator
  div (Background)
    div.mb-3 > Image icon + Label
    div.mb-4.flex.gap-2 > 3x Button (Solid Color / Gradient / Custom Image)
    [Conditional content based on background type:]
      color: input[type=color] + Input (hex)
      preset: div.grid.grid-cols-3.gap-2 > button (per gradient preset)
      image: file input (hidden) + Button (Upload) + Button (Remove) + Badge + p
  div (Overlay)
    div.mb-3 > Label + Switch
    [Conditional: opacity Slider]
  Separator
  div (Avatar)
    div.mb-3 > Circle icon + Label
    div.grid.grid-cols-1.gap-4.sm:grid-cols-2
      div > Label + Select (shape)
      div > Label + Slider (border width)
      div > Label + input[color] + Input (border color)
      div > Label + Switch (glow) + [conditional: input[color] + Input]
  Separator
  div (Typography)
    div.mb-3 > Type icon + Label
    div.mb-4 (Title/Username)
      Label + grid.sm:grid-cols-3
        div > Label + Select (font)
        div > Label + input[color] + Input (color)
        div > Label + Slider (size)
    div (Subtitle/Custom Text)
      Label + Input (text) + p (variables)
      grid.sm:grid-cols-3
        div > Label + Select (font)
        div > Label + input[color] + Input (color)
        div > Label + Slider (size)
  Separator
  div.grid.grid-cols-1.gap-6.sm:grid-cols-2
    div (Accent Color)
      div > Palette icon + Label
      div > input[color] + Input (hex)
      p.text-xs.text-text-muted
    div (Delivery Mode)
      Label + Select (with/before/only)
```

---

## Components Inventory

| Component | Source | Variants/Props Used | States |
|-----------|--------|---------------------|--------|
| `PageHeader` | custom | `title`, `subtitle` | static |
| `Tabs` | shadcn/ui | `defaultValue="welcome"` | 6 tabs |
| `TabsTrigger` | shadcn/ui | 6 tab values | active/inactive |
| `Card` | shadcn/ui | `className="bg-surface p-6"` | static |
| `Switch` | shadcn/ui | 5 instances (welcome, welcomeImage, farewell, farewellImage, dm) + overlay + glow | controlled |
| `Input` | shadcn/ui | text, `type="text"` for hex colors, `className="mt-1 w-64"` | controlled |
| `Textarea` | shadcn/ui | `rows={3}` | controlled |
| `Label` | shadcn/ui | `htmlFor`, size variants | static |
| `Separator` | shadcn/ui | `className="mb-6"` | static |
| `Button` | shadcn/ui | default, `variant="outline"`, `variant="ghost"`, `size="sm"` | disabled on isPending |
| `Select` | shadcn/ui | multiple instances | controlled |
| `Slider` | shadcn/ui | various min/max/step configs | controlled |
| `Badge` | shadcn/ui | `variant="outline"` | static indicator |
| `WelcomeImageEditor` | custom | `guildId`, `settings`, `onChange`, `type` | complex multi-section |
| Lucide icons | lucide-react | `Eye`, `RefreshCw`, `Sparkles`, `Image`, `Circle`, `Type`, `Palette`, `Upload`, `Trash2` | static/animated |
| Native `input[type=color]` | HTML | color pickers | native browser control |
| Native `input[type=file]` | HTML | hidden, triggered programmatically | hidden |

---

## Interaction Behavior

### Tab Switching
- 6 tabs with no URL persistence
- Default: "welcome" tab
- Tab bar may overflow horizontally on mobile with 6 tabs -- **potential scrolling issue**

### Feature Enable/Disable
- Each section has a `Switch` toggle at the top
- Toggles update local state immediately (no server call until Save)
- Image sections: conditionally render `WelcomeImageEditor` based on toggle
- All state synced from server via `useEffect` on `config` change

### Embed Editor
- All fields are controlled inputs updating local state
- Color field: manual hex parsing (`parseInt(hex, 16)`)
- No real-time validation -- invalid hex produces `NaN` which becomes `undefined`
- Variables reference shown as static text below editor

### Welcome Image Editor
- **Live Preview:** Auto-generates via debounced mutation (600ms delay)
  - Shows loading text "Generating preview..." while pending
  - Shows placeholder "Preview will appear here" when no URL
  - Refresh button triggers immediate preview generation
  - `RefreshCw` icon animates with `animate-spin` when pending
- **Template Selection:** Click to select, active template has `border-primary bg-primary/10`
- **Background Type:** Toggle between Solid Color / Gradient / Custom Image via button group
  - Color: native color picker + hex input
  - Gradient: 6 preset buttons with gradient backgrounds
  - Image: hidden file input triggered by Upload button, max 3MB validation
- **Overlay:** Switch toggle + conditional opacity slider (0-100%)
- **Avatar:** Shape select + border width slider + border color picker + glow toggle
- **Typography:** Font select + color picker + size slider for both title and subtitle
- **Accent Color:** Color picker + hex input
- **Delivery Mode:** Select with 3 options

### Save & Test
- **Save button:** Calls `handleSave` which collects all state and calls `updateConfig.mutate`
  - On success: `toast.success`
  - On error: `toast.error` with API error message
  - Disabled while `isPending`, text changes to `t("saving")`
- **Test button:** Calls `handleTest` which calls `testWelcome.mutate`
  - Disabled while `isPending` or when `!welcomeEnabled`
  - On success: `toast.success` with channel ID
  - On error: `toast.error`

### Form State Management
- **No form library** (no react-hook-form, no zod validation)
- All state is `useState` hooks synced from server via `useEffect([config])`
- **Auto-role IDs:** Free text input, comma-separated, split/trim on save

---

## Dynamic States

### Loading State
- Full page: Shows `PageHeader` with `loadingSubtitle` + `p.text-text-muted` with loading text
- **Not using `PageSkeleton`** -- inconsistent with other pages
- WelcomeImageEditor: inline loading handled by query hooks (templates/fonts/presets may flash)

### Empty State
- Disabled image sections: `p.text-sm.text-text-muted` with disabled message
- No explicit empty state for when no config exists (config is always present after load)

### Error State
- Save/Test: `toast.error()` via sonner
- Background upload: `toast.error("Failed to upload background")` -- hardcoded English string
- File size validation: `toast.error("Background image must be under 3 MB")` -- hardcoded English string
- **No inline error indicators** for form fields (no validation feedback)

### Success State
- Save: `toast.success(t("toast.saved"))`
- Test: `toast.success(t("toast.testSent", { channelId }))`
- Background upload: `toast.success("Background uploaded")` -- hardcoded English string

---

## RTL Analysis

### Issues Found

1. **`mr-1` at WelcomeImageEditor line 309:** `<Upload className="mr-1 h-3 w-3" />` -- uses `mr-1` instead of `me-1`. **RTL BUG.**

2. **`mr-1` at WelcomeImageEditor line 318:** `<Trash2 className="mr-1 h-3 w-3" />` -- uses `mr-1` instead of `me-1`. **RTL BUG.**

3. **`me-1` at WelcomeImageEditor line 169:** `<RefreshCw className="me-1 h-3 w-3" />` -- correctly uses logical property. **Inconsistent** with the above `mr-1` usages.

4. **`ms-auto` at WelcomeImageEditor line 168:** Correctly uses logical property.

5. **`text-start` at WelcomeImageEditor line 202:** Template button uses `text-start` -- correctly uses logical property.

6. **`border-s-4` at roles page preview:** Not in this page.

7. **`mt-1 w-64` on channel inputs:** Direction-neutral.

### RTL Verdict
Two `mr-1` instances in WelcomeImageEditor (lines 309, 318) need to be changed to `me-1`. The rest of the page is RTL-safe.

---

## Responsive Analysis

### Mobile (< 640px)
- Tab bar with 6 tabs: **will likely overflow** and require horizontal scrolling. The shadcn TabsList may or may not handle this gracefully depending on implementation.
- Embed editor grids: `grid-cols-1` (stacked)
- WelcomeImageEditor template grid: `grid-cols-2`
- Avatar settings: `grid-cols-1` (stacked)
- Typography settings: `grid-cols-1` (stacked)
- Accent/delivery grid: `grid-cols-1` (stacked)
- Action buttons: `flex gap-3` (side by side, should fit)

### Tablet/Desktop (>= 640px, `sm:`)
- Embed editor grids: `sm:grid-cols-2`
- Template grid: `sm:grid-cols-3`
- Avatar grid: `sm:grid-cols-2`
- Typography grid: `sm:grid-cols-3`
- Accent/delivery: `sm:grid-cols-2`

### Breakpoints Used
- `sm:` only (640px)

### Responsive Gaps
1. **6-tab TabsList overflow:** With 6 tabs ("Welcome", "Welcome Image", "Farewell", "Farewell Image", "DM", "Auto-Role"), the tab bar will almost certainly overflow on mobile. Needs scrollable tabs or a different navigation pattern.
2. **Channel ID inputs:** `w-64` is fixed and may be too narrow for some channel IDs or too wide relative to mobile viewport.
3. **Image editor is extremely long:** On mobile, the WelcomeImageEditor renders a very long single-column form. Could benefit from sub-sections or collapsible groups.

---

## Modals/Overlays

### None
- No dialogs or modals in this page
- Select dropdowns use Radix Popover positioning internally
- Native color picker opens browser-specific color dialog

---

## Design System Compliance

### Color Tokens

| Usage | Actual | Expected | Status |
|-------|--------|----------|--------|
| Card background | `bg-surface` | Not a defined token | **UNDEFINED TOKEN** |
| Muted text | `text-text-muted` | Correct | Correct |
| Preview border | `border-border/50` | `border` token at 50% opacity | Acceptable |
| Preview background | `bg-background` | `background` (#0e0e10) | Correct |
| Template active | `border-primary bg-primary/10` | `primary` (#a3a6ff) at 10% | Correct |
| Gradient preset active | `border-primary ring-2 ring-primary/30` | Correct | Correct |
| Lucide icon color | `text-primary` | Correct | Correct |
| Lucide icon color | `text-text-muted` | Correct | Correct |

### Typography

| Element | Actual | Expected |
|---------|--------|----------|
| Section heading | `text-lg font-semibold` | Appropriate |
| Sub-heading | `text-sm font-semibold` | Appropriate for labels |
| Variable reference | `text-xs text-text-muted` | Appropriate muted metadata |
| Template name | `text-sm font-medium` | Appropriate |
| Template description | `text-xs text-text-muted line-clamp-2` | Appropriate |
| Labels (Image Editor) | `text-xs` | Appropriate for compact forms |

### Spacing
- `space-y-8` page level: consistent
- `space-y-6` image editor sections: consistent
- `space-y-4` embed editor: consistent
- `p-6` card padding: consistent
- `mb-6` section margins: consistent
- `gap-2`, `gap-3`, `gap-4`: appropriate for form elements

### Border/Radius
- Preview container: `rounded-lg border border-border/50` -- appropriate
- Template buttons: `rounded-lg border` -- appropriate
- Gradient preset buttons: `h-16 rounded-lg border` -- appropriate
- Color picker inputs: `rounded border border-border/50` (native input styling via `className`)

### Hardcoded Values
- **Hardcoded English strings in WelcomeImageEditor:**
  - `"Live Preview"` (line 162)
  - `"Refresh"` (line 170)
  - `"Generating preview..."` (line 181)
  - `"Preview will appear here"` (line 181)
  - `"Template"` (line 195)
  - `"Background"` (line 223)
  - `"Solid Color"`, `"Gradient"`, `"Custom Image"` (lines 236-238)
  - `"Overlay Darkening"` (line 338)
  - `"Opacity"` (line 347)
  - `"Avatar"` (line 369)
  - `"Shape"` / `"Circle"` / `"Rounded Square"` / `"Square"` (lines 373-387)
  - `"Border Width"`, `"Border Color"`, `"Glow Effect"` (lines 391, 402, 422)
  - `"Typography"` (line 458)
  - `"Title (Username)"`, `"Subtitle (Custom Text)"` (lines 464, 516)
  - `"Font"`, `"Color"`, `"Size"`, `"Text"` (various)
  - `"Variables: ..."` (line 527)
  - `"Accent Color"`, `"Delivery Mode"` (lines 592, 613)
  - `"With embed message"`, `"Before embed message"`, `"Image only (no embed)"` (lines 624-626)
  - `"Background image must be under 3 MB"` (line 127)
  - `"Background uploaded"` / `"Failed to upload background"` (lines 138-139)
  - `"Background set"` (line 324)
  - `"JPG, PNG, or WebP. Max 3 MB."` (line 329)
  - `"Used for decorations, borders, and template accents."` (line 608)
  - `"Upload Image"` / `"Uploading..."` / `"Remove"` (lines 310, 318)
- **All WelcomeImageEditor strings are NOT internationalized** -- massive i18n gap
- Default image settings have hardcoded hex values: `#1a1a2e`, `#a3a6ff`, `#000000`, `#ffffff`, `#6b7280` -- these are configuration defaults, acceptable

### Design System Rule Violations
1. **`bg-surface` undefined token:** Same issue as warnings page -- not a valid Obsidian Engine surface tier.
2. **Native `input[type=color]` elements:** 5+ instances of native color pickers that use browser-default styling, completely outside the design system. These should be wrapped in a custom color picker component.
3. **Massive i18n gap:** The entire `WelcomeImageEditor` component has hardcoded English strings (50+ strings). Every label, button text, placeholder, and description needs to be wrapped in `t()` calls.
4. **Separator usage:** Multiple `Separator` components used as visual dividers between sections. This is a borderline violation of the "No-Line Rule" but acceptable for form section delineation.
5. **Inconsistent loading state:** This page uses a custom loading state (PageHeader + text) instead of `PageSkeleton` used by other pages.
6. **No form validation feedback:** No visual indicators for invalid input (e.g., invalid hex color, missing required fields).
