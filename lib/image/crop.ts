import type { CSSProperties } from "react";

/**
 * Where the photo sits inside the pass's arch window (T-010, T-012).
 *
 * The brief is explicit that people will not crop first — they will upload a
 * landscape group shot with their face off to one side. A centred `object-fit:
 * cover` handles the aspect ratio but not that: the subject gets cropped out
 * and there is nothing the user can do about it. This is what they can do
 * about it.
 *
 * The model is deliberately resolution-independent. `zoom` is a multiplier on
 * the cover fit, and `x`/`y` are offsets expressed as a **fraction of the
 * window's own size** — not pixels. That matters because the same crop is drawn
 * at four different sizes: the ~96 px editor, the 128 px card window, the same
 * window at 3× in the export, and again at 1.18× inside the OG image. A pixel
 * offset would mean four different crops; a fraction means one.
 */

export type Crop = {
  /** 1 = the plain cover fit. Above that, zoomed in. */
  zoom: number;
  /** Horizontal offset, as a fraction of the window's width. */
  x: number;
  /** Vertical offset, as a fraction of the window's height. */
  y: number;
};

export const DEFAULT_CROP: Crop = { zoom: 1, x: 0, y: 0 };

export const ZOOM = { min: 1, max: 3, step: 0.02 } as const;

/** The arch is `aspect-3/4`. Kept here so the maths and the artwork agree. */
export const WINDOW_ASPECT = 3 / 4;

export function isDefaultCrop(crop: Crop): boolean {
  return crop.zoom === DEFAULT_CROP.zoom && crop.x === DEFAULT_CROP.x && crop.y === DEFAULT_CROP.y;
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/**
 * How far the photo can travel before its own edge enters the window.
 *
 * Under `cover`, one axis exactly fits and the other overflows; zoom then
 * multiplies both. Half the overflow is the slack in each direction, so a drag
 * clamped to this can reframe the whole photo and can never expose a gap.
 *
 * A photo with no natural size yet (still decoding) reports no slack, which
 * freezes panning rather than letting it fly off to an arbitrary position.
 */
export function cropSlack(
  crop: Crop,
  natural: { width: number; height: number } | null,
  windowAspect = WINDOW_ASPECT,
): { x: number; y: number } {
  if (!natural?.width || !natural.height) return { x: 0, y: 0 };

  const aspect = natural.width / natural.height;
  // `max(1, …)`: the axis that fits exactly has a ratio below 1 before zoom,
  // and only the overflowing one contributes slack at zoom 1.
  const spanX = Math.max(1, aspect / windowAspect) * crop.zoom;
  const spanY = Math.max(1, windowAspect / aspect) * crop.zoom;

  return { x: Math.max(0, (spanX - 1) / 2), y: Math.max(0, (spanY - 1) / 2) };
}

/**
 * Pull a crop back inside its slack. Called on every drag *and* after every
 * zoom change — zooming out shrinks the slack, and an offset that was legal at
 * 3× would otherwise leave a wedge of background along one edge.
 */
export function clampCrop(
  crop: Crop,
  natural: { width: number; height: number } | null,
  windowAspect = WINDOW_ASPECT,
): Crop {
  const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, crop.zoom));
  const slack = cropSlack({ ...crop, zoom }, natural, windowAspect);
  return { zoom, x: clamp(crop.x, slack.x), y: clamp(crop.y, slack.y) };
}

/**
 * The crop as CSS, for an `object-cover` image filling its window.
 *
 * `translate` before `scale` in the list, which applies the scale *first* and
 * leaves the translation in un-scaled units — so the percentages stay a
 * fraction of the window rather than of the zoomed image, which is what makes
 * [[cropSlack]]'s arithmetic hold at every zoom level.
 *
 * Percentages rather than pixels for the same reason the model is fractional:
 * a percentage on `translate` resolves against the element's own border box,
 * which *is* the window at every one of the sizes this is drawn at.
 */
export function cropStyle(crop: Crop | undefined): CSSProperties {
  if (!crop || isDefaultCrop(crop)) return {};
  return {
    transform: `translate(${(crop.x * 100).toFixed(4)}%, ${(crop.y * 100).toFixed(4)}%) scale(${crop.zoom.toFixed(4)})`,
  };
}

/** A stable string for the render cache — see the signature in `Generator`. */
export function cropKey(crop: Crop | undefined): string {
  if (!crop) return "";
  return `${crop.zoom.toFixed(3)}:${crop.x.toFixed(4)}:${crop.y.toFixed(4)}`;
}
