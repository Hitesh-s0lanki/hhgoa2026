import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrSymbol } from "@/lib/share/qr-symbol";
import { passQrTarget } from "@/lib/share/qr-target";
import { EVENT, SITE_URL, absoluteUrl, isPublicSiteUrl } from "@/lib/site";

/**
 * The point of this file: "it looks like a QR code" is not a test.
 *
 * The card carried a decorative hash pattern for a while and it was completely
 * convincing at pass scale — finder squares, plausible module field, the lot.
 * The only way to tell that apart from a working code, short of pointing a
 * phone at it, is to put a real decoder on the other end. So these tests draw
 * the symbol the card draws and read it back with `jsQR`, the same scanner
 * implementation browsers' JS QR readers are built on.
 */

/** Every `M{x} {y}h1v1h-1z` in the path, back into the grid it came from. */
function decode(value: string, pixelsPerModule = 4): string | null {
  const { size, path } = qrSymbol(value);

  const dark = new Set<string>();
  for (const [, x, y] of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    dark.add(`${x},${y}`);
  }

  // RGBA, one pixel row at a time — light ground, dark modules, exactly the
  // way the card paints it.
  const width = size * pixelsPerModule;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);

  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      if (!dark.has(`${Math.floor(px / pixelsPerModule)},${Math.floor(py / pixelsPerModule)}`)) {
        continue;
      }
      const at = (py * width + px) * 4;
      data[at] = data[at + 1] = data[at + 2] = 0;
    }
  }

  return jsQR(data, width, width)?.data ?? null;
}

describe("qrSymbol", () => {
  it("produces a code a scanner can actually read", () => {
    expect(decode("https://hhgoa.app/share/k3f9x2m7qp1a")).toBe(
      "https://hhgoa.app/share/k3f9x2m7qp1a",
    );
  });

  it("reads back every URL the card can carry", () => {
    for (const value of [
      absoluteUrl("/"),
      absoluteUrl("/share/000000000000"),
      absoluteUrl("/share/zzzzzzzzzzzz"),
      EVENT.site,
      // The longest plausible origin — a Vercel preview URL is not short, and
      // a symbol that only decodes on the production domain is a trap.
      "https://hhgoa2026-git-main-hitesh-projects.vercel.app/share/k3f9x2m7qp1a",
    ]) {
      expect(decode(value), value).toBe(value);
    }
  });

  it("keeps the four-module quiet zone clear on every side", () => {
    const { size, path } = qrSymbol(EVENT.site);
    const dark = [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(([, x, y]) => [+x, +y]);

    for (const [x, y] of dark) {
      for (const n of [x, y]) {
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThan(size - 4);
      }
    }
  });

  it("stays small enough to read on a 92px card slot", () => {
    // Version 3 is 29 modules; with the quiet zone that is 37 across. At 92px
    // each module clears ~2.5px on screen and ~7.5px in the 3× export. A
    // longer URL would push the version up and the modules below that.
    expect(qrSymbol(absoluteUrl("/share/k3f9x2m7qp1a")).size).toBeLessThanOrEqual(37);
  });

  it("is deterministic, so the server and the browser draw the same markup", () => {
    expect(qrSymbol(EVENT.site)).toEqual(qrSymbol(EVENT.site));
  });
});

describe("passQrTarget", () => {
  const public_ = isPublicSiteUrl(SITE_URL);

  it("points at the pass's own page once it has an id", () => {
    const target = passQrTarget("k3f9x2m7qp1a");
    expect(target).toBe(public_ ? absoluteUrl("/share/k3f9x2m7qp1a") : EVENT.site);
  });

  /*
   * The failure this exists to prevent: a card that is downloaded and never
   * posted has no /share page, so encoding one would put a code that scans to
   * a 404 onto an image the person already has.
   */
  it("falls back to the generator when there is no pass id yet", () => {
    for (const id of [null, undefined, ""]) {
      expect(passQrTarget(id)).toBe(public_ ? absoluteUrl("/") : EVENT.site);
    }
  });

  it("never encodes an origin only the serving machine can resolve", () => {
    const targets = [passQrTarget(null), passQrTarget("k3f9x2m7qp1a")];
    for (const target of targets) {
      expect(isPublicSiteUrl(target), target).toBe(true);
    }
  });
});
