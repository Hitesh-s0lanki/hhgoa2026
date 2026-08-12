"use client";

import { brand } from "@/lib/brand/tokens";

/**
 * DOM node → PNG.
 *
 * The renderer this replaces (T-013) was to be a canvas that re-draws the pass
 * from a TemplateSpec. That is still the right end state, but it is a second
 * implementation of a layout that already exists and already renders correctly
 * in `PassCard.tsx`, and the two would drift the first time a designer moved a
 * rule. Rasterising the real card removes the drift by construction: what
 * downloads *is* the preview, because it is the same DOM.
 *
 * `modern-screenshot` does this by cloning the node into an SVG `foreignObject`
 * with computed styles inlined and every external asset (fonts, the photo)
 * embedded as a data URI, then painting that SVG to a canvas. The browser does
 * the layout, so there is no approximation of CSS to get wrong — which is the
 * failure mode that got `html2canvas` rejected in docs/05-tech-stack.md.
 *
 * The module is ~30 KB and is only ever reached through a dynamic import, so it
 * stays out of the entry chunk (NFR-1's 200 KB budget).
 */

/** Loaded once, then reused. The second capture never pays the import again. */
let modulePromise: Promise<typeof import("modern-screenshot")> | null = null;

function loadRenderer() {
  modulePromise ??= import("modern-screenshot");
  return modulePromise;
}

export type RasterizeOptions = {
  /** Output pixel ratio. 3 on the card gives a 912×1368 PNG. */
  scale?: number;
  /** Defaults to PNG. `image/webp` silently yields PNG where unsupported. */
  type?: "image/png" | "image/webp";
  quality?: number;
  signal?: AbortSignal;
};

/**
 * Whether this browser's canvas can *encode* WebP — not merely display it.
 *
 * WebKit decodes WebP but, as of testing, still encodes PNG when asked for it,
 * and `toBlob` reports that by handing back a blob whose `type` is `image/png`
 * rather than by failing. So the answer is measured once, on a 1px canvas,
 * instead of assumed, and callers treat `blob.type` as authoritative either way.
 *
 * It matters because on this artwork — flat brand colour, hard type edges, one
 * photograph — WebP is roughly 2.3× smaller than PNG while JPEG is *larger*
 * than PNG (measured: 161 KB / 377 KB / 384 KB for the same sheet). That
 * difference is most of a second on the share tap.
 */
let webpSupport: boolean | null = null;

export function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport;
}

export async function rasterize(node: HTMLElement, options: RasterizeOptions = {}): Promise<Blob> {
  const { domToBlob } = await loadRenderer();
  options.signal?.throwIfAborted();

  const blob = await domToBlob(node, {
    scale: options.scale ?? 3,
    type: options.type ?? "image/png",
    quality: options.quality,
    // The capture nodes paint their own ground, but a node whose own background
    // is transparent would otherwise composite onto nothing and export with an
    // alpha hole where the brand green should be.
    backgroundColor: brand.color.primary,
    // Long enough for a cold font fetch on a phone, short enough that a hung
    // request surfaces as an error rather than a button that never returns.
    timeout: 15_000,
    fetch: { requestInit: { cache: "force-cache" } },
  });

  options.signal?.throwIfAborted();
  if (!blob) throw new Error("The card could not be rendered.");
  return blob;
}

/**
 * The first capture is far slower than the rest: it fetches both `next/font`
 * WOFF2 files and inlines them as data URIs, which is most of a second on a
 * phone. Every capture after that hits `modern-screenshot`'s resource cache.
 *
 * So the first one is spent early and thrown away — as soon as the user has
 * shown any intent (a photo, a keystroke), long before they press a button.
 * By the time they do, the expensive part is already paid for. This is the
 * difference between "seconds" and "a spinner".
 *
 * Deliberately silent: a warm-up that fails costs the user nothing but a slower
 * real capture, and there is nothing to tell them.
 */
export function warmRasterizer(node: HTMLElement | null): void {
  if (!node) return;
  void loadRenderer()
    .then(({ domToBlob }) =>
      // scale 0.1 — the point is the font and image embedding, not the pixels.
      domToBlob(node, { scale: 0.1, type: "image/png", timeout: 15_000 }),
    )
    .catch(() => {});
}

/**
 * A blob plus the filename it should carry once it is a download or an upload.
 *
 * The extension comes from what the browser actually encoded, never from what
 * was asked for — a `.webp` holding PNG bytes is the kind of thing that works
 * everywhere until it reaches the one tool that trusts the extension.
 */
export function toFile(blob: Blob, basename: string): File {
  const type = blob.type || "image/png";
  const extension = type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png";
  return new File([blob], `${basename}.${extension}`, { type });
}

/** `Hitesh Solanki` → `hitesh-solanki`, for filenames. Never empty. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    // NFKD splits "é" into "e" + a combining accent; the class strips the mark
    // and leaves the letter, so a name does not decay into a row of dashes.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "builder";
}
