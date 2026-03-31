# i18n & Accessibility

## Overview

Full internationalization (i18n) for the dashboard (client + server) and comprehensive WCAG AA accessibility compliance. Supports 50+ languages including RTL (Arabic, Hebrew).

## Architecture

### Shared Package: `@fluxcore/i18n`

```
packages/i18n/
├── src/
│   ├── index.ts           # Main exports
│   ├── types.ts           # Type definitions
│   ├── languages.ts       # Supported languages registry
│   ├── server.ts          # Server-side i18next init
│   ├── client.ts          # Client-side react-i18next init
│   └── locales/
│       └── en/
│           ├── common.json    # Nav, buttons, status, shared UI
│           └── errors.json    # All error messages (client + server)
```

### Client Integration

- **Library:** `react-i18next` + `i18next-http-backend` + `i18next-browser-languagedetector`
- **Loading:** HTTP backend fetches from `/api/i18n/:lng/:ns`
- **RTL:** Dynamic `dir` attribute on `<html>`, Tailwind `rtl:` variants
- **Language switcher:** Dropdown in nav, persists to `localStorage`

### Server Integration

- **Library:** `i18next` + `i18next-fs-backend`
- **Middleware:** Reads `Accept-Language` header, attaches `t()` to request
- **Error responses:** All `reply.code().send({ error })` use i18n keys
- **API:** `GET /api/i18n/:lng/:ns` serves translation JSON files

## Supported Languages (initial set)

English, Arabic (RTL), Hebrew (RTL), French, German, Spanish, Portuguese, Italian, Dutch, Polish, Czech, Slovak, Romanian, Bulgarian, Greek, Turkish, Russian, Ukrainian, Japanese, Korean, Chinese (Simplified), Chinese (Traditional), Thai, Vietnamese, Indonesian, Malay, Hindi, Bengali, Tamil, Filipino, Swedish, Norwegian, Danish, Finnish, Hungarian, Croatian, Serbian, Lithuanian, Latvian, Estonian, Slovenian, Persian (RTL), Urdu (RTL), Swahili, Afrikaans, Catalan, Basque, Galician

## Accessibility Improvements (WCAG AA)

### Color Contrast
- Audit all text/background combinations for 4.5:1 (normal text) and 3:1 (large text)
- Key fix: `text-text/50` and `text-text/40` opacity classes fail on dark backgrounds
- Replace opacity-based muted text with explicit contrast-safe colors

### Structural
- `sr-only` utility class for screen-reader-only content
- Skip-to-content link at top of page
- `aria-live` regions for dynamic content (toasts, data loading)
- Proper heading hierarchy (h1 > h2 > h3)

### Interactive Elements
- All icon-only buttons get tooltips + `aria-label`
- Form fields get descriptive tooltips explaining each setting
- Stats cards get tooltip explanations for metrics
- Keyboard navigation for all interactive elements (already via Radix)

### RTL Layout
- Sidebar flips to right side
- All directional padding/margin use Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`)
- Arrow icons reverse direction
- Text alignment follows document direction

## Namespaces

| Namespace | Scope |
|-----------|-------|
| `common` | Navigation, buttons, statuses, shared labels, sidebar items |
| `errors` | All error messages (400, 401, 403, 404, 500) |

Additional per-page namespaces added incrementally as pages are migrated.

## Translation Loading

1. Client detects browser language via `i18next-browser-languagedetector`
2. Falls back to English if language not supported
3. Fetches namespace JSON from `GET /api/i18n/:lng/:ns`
4. Server caches loaded translations in memory
5. Language preference persisted in `localStorage`

## String Extraction Strategy

Incremental — layout and common strings first, then page-by-page:

1. **Phase 1:** Layout (sidebar, header, root), common UI, error messages
2. **Phase 2:** Feature pages migrated as they're touched
3. **Phase 3:** Full coverage audit
