import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

/**
 * Screenshot placeholders for the documentation site.
 *
 * This app never runs a capture pipeline (no Playwright) against a live
 * dashboard: a real capture would contain real guild names, member names,
 * avatars, and moderation case details, which must never land on a public
 * site. Screenshots are captured manually, later, by a human working
 * through the checklist this same feature emits (see
 * `../scripts/manifest/build.mjs`'s `buildScreenshotChecklist`, written to
 * `SCREENSHOTS.md`), and dropped into `public/screenshots/` under the
 * filename that checklist names.
 *
 * How "exists at build time" is determined, and why it has to work this
 * way: `next.config.mjs` sets `output: 'export'` — this site is a static
 * export with no Node server at request time. Every route is rendered
 * exactly once, on the build machine, during `next build`. This component
 * has no "use client" directive, so it is a React Server Component: the
 * `node:fs` check below runs during that one build-time render, and
 * whichever branch it takes (real `<img>` or the placeholder box) is what
 * gets baked into the exported HTML. There is no client-side existence
 * check and there never should be one here — that would mean shipping an
 * `<img src>` that may 404 in the visitor's browser, which is exactly the
 * broken-image failure mode this component exists to prevent. A file
 * dropped into `public/screenshots/` only takes effect the next time the
 * site is rebuilt and exported, never by editing the already-shipped HTML.
 */

export interface ScreenshotPlaceholderProps {
  /** Public-relative path, e.g. "/screenshots/commands.png". */
  src: string;
  alt: string;
  /** Dashboard route to visit to (re)capture this screenshot. */
  route: string;
}

export type ScreenshotRenderDecision =
  | { kind: "image"; src: string; alt: string }
  | { kind: "placeholder"; alt: string; route: string };

const DEFAULT_PUBLIC_DIR = join(process.cwd(), "public");

/**
 * Pure existence check, exported separately from the component so it is
 * testable without a React renderer — this app has no rendering test
 * infrastructure (no jsdom / @testing-library/react dependency) today, and
 * adding one is out of scope for this check. `publicDir` defaults to the
 * real `public/` directory relative to wherever Next.js is invoked from
 * (`process.cwd()` during `next build`); tests override it with a
 * temporary directory instead of touching the real filesystem or `cwd`.
 */
export function screenshotFileExists(
  src: string,
  publicDir: string = DEFAULT_PUBLIC_DIR,
): boolean {
  return existsSync(join(publicDir, src));
}

/**
 * The component's entire branching decision, factored out of the JSX into
 * a plain, directly-inspectable return value — this is what the "two
 * branches" tests exercise.
 */
export function decideScreenshotRender(
  props: ScreenshotPlaceholderProps,
  publicDir: string = DEFAULT_PUBLIC_DIR,
): ScreenshotRenderDecision {
  if (screenshotFileExists(props.src, publicDir)) {
    return { kind: "image", src: props.src, alt: props.alt };
  }
  return { kind: "placeholder", alt: props.alt, route: props.route };
}

/**
 * Renders the real screenshot when it exists on disk at build time;
 * otherwise renders a labelled placeholder box captioned with the route to
 * (re)capture it from. Never emits an `<img>` whose `src` is already known,
 * at build time, not to resolve.
 */
export default function ScreenshotPlaceholder(props: ScreenshotPlaceholderProps): ReactElement {
  const decision = decideScreenshotRender(props);

  if (decision.kind === "image") {
    return (
      <img
        src={decision.src}
        alt={decision.alt}
        loading="lazy"
        style={{
          width: "100%",
          borderRadius: "0.5rem",
          border: "1px solid var(--fc-border)",
        }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Screenshot placeholder: ${decision.alt}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        borderRadius: "0.5rem",
        border: "1px dashed var(--fc-outline-variant)",
        backgroundColor: "var(--fc-surface-container)",
        padding: "2.5rem",
        textAlign: "center",
      }}
    >
      <span style={{ fontWeight: 600 }}>{decision.alt}</span>
      <span style={{ color: "var(--fc-text-muted)", fontSize: "0.875rem" }}>
        Screenshot not yet captured — visit <code>{decision.route}</code> to capture it.
      </span>
    </div>
  );
}
