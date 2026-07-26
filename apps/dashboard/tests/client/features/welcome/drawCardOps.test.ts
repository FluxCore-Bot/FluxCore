import { describe, it, expect } from "vitest";
import { drawCard } from "@fluxcore/systems/welcome/image/core/draw";
import { getAllTemplates } from "@fluxcore/systems/welcome/image/templates";
import type { Ctx2D, GradientLike, RenderBackend } from "@fluxcore/systems/welcome/image/core/types";
import type { RenderInput, WelcomeImageSettings } from "@fluxcore/systems/welcome/image/types";

/**
 * This suite drives `drawCard` — the exact function `renderer.ts` calls for
 * the browser preview — with a plain object in place of a canvas context.
 *
 * It proves two things at once:
 *
 *  1. RUNTIME browser-safety: `core/draw.ts` (and everything it imports —
 *     core/text.ts, the templates, the font manifest) executes to completion
 *     with no canvas of any kind and no Node builtin. If any of those modules
 *     ever grew an accidental `import("@napi-rs/canvas")` or `node:fs` call,
 *     this test would throw at import time or at the call site, regardless
 *     of what environment vitest runs under — reading the import list can't
 *     tell you that as reliably as actually calling the function can.
 *
 *  2. Draw-order/argument regression: nothing else in the suite pins the
 *     SEQUENCE of canvas calls `drawCard` makes, or the exact arguments each
 *     call receives. An inverted gradient stop, two swapped fillRect
 *     arguments, or a decoration drawn before the background instead of
 *     after would all change the recorded op log and fail the snapshot.
 */

interface Op {
  op: string;
  args: unknown[];
}

/** Stand-in for an HTMLImageElement/SKRSImage — just enough to identify it in the log. */
interface StubImage {
  source: "avatar" | "background";
  key: string;
}

function labelStyle(style: string | GradientLike): string {
  return typeof style === "string" ? style : (style as { label: string }).label;
}

/**
 * A recording double for Ctx2D<StubImage>. Every property write and every
 * method call appends one entry to `ops`, in call order, with its arguments
 * — so `ops` is a complete, replayable trace of what `drawCard` did.
 */
function createRecordingCtx(ops: Op[]): Ctx2D<StubImage> {
  let gradientSeq = 0;

  function makeGradient(kind: "linear" | "radial", args: number[]): GradientLike & { label: string } {
    const label = `${kind}Gradient#${gradientSeq++}`;
    ops.push({ op: `create${kind === "linear" ? "Linear" : "Radial"}Gradient`, args: [...args, label] });
    return {
      label,
      addColorStop(offset: number, color: string) {
        ops.push({ op: `${label}.addColorStop`, args: [offset, color] });
      },
    };
  }

  let _fillStyle: string | GradientLike = "";
  let _strokeStyle: string | GradientLike = "";
  let _lineWidth = 1;
  let _lineCap: Ctx2D["lineCap"] = "butt";
  let _font = "";
  let _textAlign: Ctx2D["textAlign"] = "start";
  let _textBaseline: Ctx2D["textBaseline"] = "alphabetic";
  let _direction: Ctx2D["direction"] = "inherit";

  return {
    get fillStyle() { return _fillStyle; },
    set fillStyle(v) { _fillStyle = v; ops.push({ op: "set fillStyle", args: [labelStyle(v)] }); },
    get strokeStyle() { return _strokeStyle; },
    set strokeStyle(v) { _strokeStyle = v; ops.push({ op: "set strokeStyle", args: [labelStyle(v)] }); },
    get lineWidth() { return _lineWidth; },
    set lineWidth(v) { _lineWidth = v; ops.push({ op: "set lineWidth", args: [v] }); },
    get lineCap() { return _lineCap; },
    set lineCap(v) { _lineCap = v; ops.push({ op: "set lineCap", args: [v] }); },
    get font() { return _font; },
    set font(v) { _font = v; ops.push({ op: "set font", args: [v] }); },
    get textAlign() { return _textAlign; },
    set textAlign(v) { _textAlign = v; ops.push({ op: "set textAlign", args: [v] }); },
    get textBaseline() { return _textBaseline; },
    set textBaseline(v) { _textBaseline = v; ops.push({ op: "set textBaseline", args: [v] }); },
    get direction() { return _direction; },
    set direction(v) { _direction = v; ops.push({ op: "set direction", args: [v] }); },

    save() { ops.push({ op: "save", args: [] }); },
    restore() { ops.push({ op: "restore", args: [] }); },
    beginPath() { ops.push({ op: "beginPath", args: [] }); },
    moveTo(x, y) { ops.push({ op: "moveTo", args: [x, y] }); },
    lineTo(x, y) { ops.push({ op: "lineTo", args: [x, y] }); },
    rect(x, y, w, h) { ops.push({ op: "rect", args: [x, y, w, h] }); },
    roundRect(x, y, w, h, radii) { ops.push({ op: "roundRect", args: [x, y, w, h, radii] }); },
    arc(x, y, radius, start, end) { ops.push({ op: "arc", args: [x, y, radius, start, end] }); },
    clip() { ops.push({ op: "clip", args: [] }); },
    fill() { ops.push({ op: "fill", args: [] }); },
    stroke() { ops.push({ op: "stroke", args: [] }); },
    fillRect(x, y, w, h) { ops.push({ op: "fillRect", args: [x, y, w, h] }); },
    strokeRect(x, y, w, h) { ops.push({ op: "strokeRect", args: [x, y, w, h] }); },
    createLinearGradient(x0, y0, x1, y1) { return makeGradient("linear", [x0, y0, x1, y1]); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return makeGradient("radial", [x0, y0, r0, x1, y1, r1]); },
    measureText(text: string) {
      ops.push({ op: "measureText", args: [text] });
      // Deterministic: independent of any real font metrics, so the log
      // never shifts because a CI box has different fonts installed.
      return { width: text.length * 10 };
    },
    fillText(text, x, y) { ops.push({ op: "fillText", args: [text, x, y] }); },
    drawImage(image, dx, dy, dw, dh) {
      ops.push({ op: "drawImage", args: [image.source, image.key, dx, dy, dw, dh] });
    },
  };
}

/** Backend that never touches the network or a filesystem — pure in-memory tokens. */
const backend: RenderBackend<StubImage> = {
  loadImage: (url) => Promise.resolve({ source: "avatar", key: url }),
  loadBackgroundImage: (imageKey) => Promise.resolve({ source: "background", key: imageKey }),
  measureImage: () => ({ width: 2000, height: 1500 }),
};

function buildSettings(template: string): WelcomeImageSettings {
  return {
    template,
    background: { type: "image", imageKey: "bg-123.png", color: "#1a1a2e" },
    overlay: { enabled: true, color: "#000000", opacity: 0.5 },
    avatar: {
      shape: "circle",
      borderColor: "#a3a6ff",
      borderWidth: 3,
      glowEnabled: true,
      glowColor: "#a3a6ff",
    },
    title: { font: "PlayfairDisplay", color: "#ffffff", size: 0 },
    subtitle: { font: "Orbitron", color: "#a3a6ff", size: 0, text: "أهلاً {user.name} في {server}" },
    accentColor: "#a3a6ff",
    sendMode: "with",
  };
}

const member: RenderInput["member"] = {
  username: "ahmed",
  displayName: "أحمد",
  avatarUrl: "https://cdn.example.test/avatar.png",
};

const guild: RenderInput["guild"] = {
  name: "سيرفر الاختبار",
  memberCount: 4321,
};

describe("drawCard op-log (browser-safety + draw-order pin)", () => {
  const templates = getAllTemplates();

  it("covers exactly the six known templates", () => {
    expect(templates.map((t) => t.name).sort()).toEqual(
      ["aurora", "elegant", "horizon", "minimal", "neon", "starter"].sort(),
    );
  });

  for (const { name } of templates) {
    it(`renders a stable op sequence for "${name}"`, async () => {
      const ops: Op[] = [];
      const ctx = createRecordingCtx(ops);

      await drawCard(ctx, buildSettings(name), member, guild, backend);

      // A real draw happened — background, avatar, and both text calls.
      expect(ops.length).toBeGreaterThan(10);
      expect(ops.some((o) => o.op === "drawImage")).toBe(true);
      expect(ops.filter((o) => o.op === "fillText")).toHaveLength(2);

      // RTL member/subtitle text must set direction "rtl" before the
      // measureText call that fitText uses to decide on truncation — this
      // is the exact ordering the Arabic-rendering fix depends on.
      const directionSets = ops
        .map((o, i) => ({ ...o, i }))
        .filter((o) => o.op === "set direction");
      expect(directionSets.every((o) => o.args[0] === "rtl")).toBe(true);
      for (const d of directionSets) {
        const nextMeasure = ops.slice(d.i + 1).find((o) => o.op === "measureText");
        expect(nextMeasure).toBeDefined();
      }

      expect(ops).toMatchSnapshot();
    });
  }
});
