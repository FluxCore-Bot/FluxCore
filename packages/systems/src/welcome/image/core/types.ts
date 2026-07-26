/** Minimal gradient surface shared by both canvas implementations. */
export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}

/**
 * The subset of CanvasRenderingContext2D the renderer uses. Both
 * `SKRSContext2D` (@napi-rs/canvas) and the browser's
 * `CanvasRenderingContext2D` satisfy this structurally.
 */
export interface Ctx2D<TImage = unknown> {
  fillStyle: string | GradientLike;
  strokeStyle: string | GradientLike;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  font: string;
  textAlign: "left" | "center" | "right" | "start" | "end";
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
  direction: "ltr" | "rtl" | "inherit";

  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, radii: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  clip(): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
  createRadialGradient(
    x0: number, y0: number, r0: number, x1: number, y1: number, r1: number,
  ): GradientLike;
  measureText(text: string): { width: number };
  fillText(text: string, x: number, y: number): void;
  drawImage(image: TImage, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * The genuinely environment-specific parts: how images are obtained and sized.
 * The server reads backgrounds through a StorageAdapter; the browser fetches
 * them over HTTP and reports size via naturalWidth/naturalHeight.
 */
export interface RenderBackend<TImage> {
  /** Load an image from an absolute URL (used for avatars). */
  loadImage(url: string): Promise<TImage>;
  /** Load a stored background by its storage key. Rejects if unavailable. */
  loadBackgroundImage(imageKey: string): Promise<TImage>;
  /** Intrinsic pixel dimensions of a loaded image. */
  measureImage(image: TImage): { width: number; height: number };
}
