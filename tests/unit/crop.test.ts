import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROP,
  WINDOW_ASPECT,
  ZOOM,
  clampCrop,
  cropKey,
  cropSlack,
  cropStyle,
  isDefaultCrop,
} from "@/lib/image/crop";

/**
 * The crop maths is what makes "handles real photos" true, so the cases below
 * are the shapes people actually upload rather than round numbers: a portrait
 * phone photo, a landscape group shot, and the square export from every social
 * app. The invariant under all of them is the same — the photo may be moved to
 * any framing, and may never be moved far enough to show a gap.
 */

const PORTRAIT = { width: 3024, height: 4032 }; // iPhone, held upright: 3:4
const LANDSCAPE = { width: 4032, height: 3024 }; // the same phone, turned
const SQUARE = { width: 1080, height: 1080 };
const PANORAMA = { width: 4000, height: 800 };

describe("cropSlack", () => {
  it("gives a photo that exactly fills the window nowhere to go", () => {
    // 3:4 is the window's own aspect, so cover fits it with nothing spare.
    expect(cropSlack(DEFAULT_CROP, PORTRAIT)).toEqual({ x: 0, y: 0 });
  });

  it("allows horizontal travel for a landscape photo and no vertical", () => {
    const slack = cropSlack(DEFAULT_CROP, LANDSCAPE);

    // 4:3 in a 3:4 window is 16/9 as wide as it needs to be; half the overflow
    // is reachable in each direction.
    expect(slack.x).toBeCloseTo((4032 / 3024 / WINDOW_ASPECT - 1) / 2, 6);
    expect(slack.x).toBeGreaterThan(0.35);
    expect(slack.y).toBe(0);
  });

  it("allows vertical travel for a photo taller than the window", () => {
    // Square is *wider* than 3:4, so it overflows horizontally, not vertically.
    expect(cropSlack(DEFAULT_CROP, SQUARE).y).toBe(0);
    expect(cropSlack(DEFAULT_CROP, SQUARE).x).toBeGreaterThan(0);

    // A photo narrower than 3:4 is the one that overflows the other way.
    expect(cropSlack(DEFAULT_CROP, { width: 600, height: 1600 }).y).toBeGreaterThan(0);
  });

  it("opens up both axes once the photo is zoomed", () => {
    const slack = cropSlack({ ...DEFAULT_CROP, zoom: 2 }, PORTRAIT);
    expect(slack.x).toBeCloseTo(0.5, 6);
    expect(slack.y).toBeCloseTo(0.5, 6);
  });

  it("freezes panning while the photo has no measured size yet", () => {
    expect(cropSlack(DEFAULT_CROP, null)).toEqual({ x: 0, y: 0 });
    expect(cropSlack(DEFAULT_CROP, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("clampCrop", () => {
  it("keeps an offset that is inside the photo", () => {
    const crop = { zoom: 1, x: 0.2, y: 0 };
    expect(clampCrop(crop, LANDSCAPE)).toEqual(crop);
  });

  it("stops a drag at the photo's edge rather than past it", () => {
    const dragged = clampCrop({ zoom: 1, x: 5, y: 5 }, LANDSCAPE);
    const slack = cropSlack({ zoom: 1, x: 0, y: 0 }, LANDSCAPE);

    expect(dragged.x).toBeCloseTo(slack.x, 6);
    // No vertical slack on this shape, so a diagonal drag flattens.
    expect(dragged.y).toBe(0);
  });

  it("pulls an offset back in when zooming out shrinks the slack", () => {
    // Legal at 3×: half a window's travel in each direction.
    const zoomedIn = clampCrop({ zoom: 3, x: 0.5, y: 0.5 }, PORTRAIT);
    expect(zoomedIn).toEqual({ zoom: 3, x: 0.5, y: 0.5 });

    // The same offset at 1× would leave a wedge of background along two edges.
    const zoomedOut = clampCrop({ ...zoomedIn, zoom: 1 }, PORTRAIT);
    expect(zoomedOut).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("holds the zoom inside its own range", () => {
    expect(clampCrop({ zoom: 0.1, x: 0, y: 0 }, PORTRAIT).zoom).toBe(ZOOM.min);
    expect(clampCrop({ zoom: 99, x: 0, y: 0 }, PORTRAIT).zoom).toBe(ZOOM.max);
  });

  it("survives a shape with almost no height", () => {
    const clamped = clampCrop({ zoom: 1, x: 9, y: 9 }, PANORAMA);
    expect(Number.isFinite(clamped.x)).toBe(true);
    expect(Number.isFinite(clamped.y)).toBe(true);
    expect(clamped.y).toBe(0);
  });
});

describe("cropStyle", () => {
  it("emits nothing at all for the default framing", () => {
    // A no-op transform on every card would still create a compositing layer in
    // the rasterizer's clone, for a photo nobody has touched.
    expect(cropStyle(DEFAULT_CROP)).toEqual({});
    expect(cropStyle(undefined)).toEqual({});
  });

  it("writes the offset as a percentage so it survives being scaled", () => {
    // The card is drawn at four sizes; percentages of the element's own box are
    // the only unit that means the same thing at all of them.
    const style = cropStyle({ zoom: 2, x: 0.25, y: -0.1 });
    expect(style.transform).toContain("translate(25.0000%, -10.0000%)");
    expect(style.transform).toContain("scale(2.0000)");
    // Order matters: scale must not multiply the translation. See the comment.
    expect(style.transform?.indexOf("translate")).toBeLessThan(
      style.transform?.indexOf("scale") ?? -1,
    );
  });
});

describe("cropKey", () => {
  it("changes whenever the framing changes, so a stale render is thrown away", () => {
    expect(cropKey(DEFAULT_CROP)).toBe(cropKey({ zoom: 1, x: 0, y: 0 }));
    expect(cropKey(DEFAULT_CROP)).not.toBe(cropKey({ zoom: 1.5, x: 0, y: 0 }));
    expect(cropKey(DEFAULT_CROP)).not.toBe(cropKey({ zoom: 1, x: 0.02, y: 0 }));
  });
});

describe("isDefaultCrop", () => {
  it("recognises only the untouched framing", () => {
    expect(isDefaultCrop(DEFAULT_CROP)).toBe(true);
    expect(isDefaultCrop({ zoom: 1, x: 0, y: 0.0001 })).toBe(false);
  });
});
