"use client";

import { type ImageKind, isSupportedKind, sniffImage } from "./sniff";

/**
 * Camera roll → something the card can actually draw (T-007 → T-009).
 *
 * Three jobs, in one pass, because they are the same pass:
 *
 *   1. **Decode.** Every browser reads JPEG, PNG and WebP. HEIC is read only by
 *      Safari, and the brief names HEIC explicitly — so a file the browser
 *      cannot decode is handed to a WASM decoder instead of being painted as a
 *      broken image. The decoder is a 3 MB chunk and is fetched *only* on the
 *      failure path, which means an iPhone (where the decode succeeds natively)
 *      never downloads it.
 *   2. **Orient.** EXIF rotation is applied by loading through an `<img>`, whose
 *      default `image-orientation: from-image` bakes the rotation into both
 *      `naturalWidth/Height` and anything `drawImage` paints from it. Doing it
 *      this way rather than parsing EXIF ourselves means the browser's own
 *      answer is the one used, and there is no second implementation to drift.
 *   3. **Downscale.** A 12 MP phone photo is ~4000 px wide and several MB. The
 *      card draws it into a ~128 px window, and the exporter inlines it as a
 *      base64 data URI *three times* per share. Resizing to a 1600 px edge up
 *      front is the single largest speed win in the flow — it turns a ~5 MB
 *      data URI into ~600 KB, on every capture.
 *
 * The result is always something `<img>`, `modern-screenshot` and UploadThing
 * all handle, so nothing downstream has to know where the photo came from.
 */

/**
 * Longest edge of the normalized photo, in pixels.
 *
 * The photo's largest appearance anywhere is the sheet export: a 128 px window
 * at 3×, so ~384 px, and the zoom control can crop *into* the source but never
 * asks for more of it. 1600 leaves a wide margin over that — enough that the
 * card artwork could double in size before this became the limit — while still
 * cutting a 4032 px original by 60% in each axis.
 */
const MAX_EDGE = 1600;

/** Photographs, so JPEG. High enough that the recompression is not visible. */
const JPEG_QUALITY = 0.9;

export type Photo = {
  /** Normalized and upload-ready. The original file when nothing had to change. */
  file: File;
  /** Object URL for `file`. The caller owns it and must revoke it. */
  url: string;
  /** Natural size *after* orientation and downscale — what the crop maths uses. */
  width: number;
  height: number;
  kind: ImageKind;
  /** True when the bytes were re-encoded (HEIC decode and/or a downscale). */
  converted: boolean;
};

/** A rejection the UI shows verbatim. Anything else is a bug, not a bad file. */
export class PhotoError extends Error {}

/**
 * `<img>` rather than `createImageBitmap`: `imageOrientation: "from-image"` only
 * reached Safari in 16.4, while the CSS default on an `<img>` has applied EXIF
 * rotation since Safari 13.4 — and the app's floor is "whatever the phone has".
 *
 * `decode()` rather than `onload` because it is the one that *rejects* on an
 * undecodable image, which is exactly the HEIC-on-Chrome signal this needs.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img);
}

/**
 * HEIC → JPEG, in WASM, on the browsers that cannot do it themselves.
 *
 * The import is dynamic and reached only after a native decode has already
 * failed. `heic-to/next` is the build the package ships for bundlers that
 * inline the worker rather than resolving it from a URL at runtime — the plain
 * entry point works in a script tag and 404s the worker under Turbopack.
 */
async function decodeHeic(file: File): Promise<Blob> {
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "image/jpeg", quality: JPEG_QUALITY });
}

/** Canvas → Blob, as a promise, because `toBlob` predates them. */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("That photo could not be read."))),
      type,
      quality,
    );
  });
}

/**
 * Redraw at the target size. Also the step that *flattens* orientation: the
 * source `<img>` is already rotated, so the canvas receives upright pixels and
 * the output carries no EXIF for anything downstream to re-apply.
 */
async function resize(img: HTMLImageElement, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("That photo could not be read.");

  // The default is already this on every current browser, but a downscale of
  // this ratio is exactly where a nearest-neighbour fallback would show.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  return canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
}

/** Fit inside a `MAX_EDGE` box, preserving aspect. Never scales up. */
export function targetSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scaled: false };

  const ratio = maxEdge / longest;
  return {
    // `max(1, …)` guards the degenerate 4000×1 panorama, whose short edge would
    // otherwise round to a zero-height canvas and throw.
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** `photo.heic` → `photo.jpg`, so the extension matches the bytes after a convert. */
function renamed(name: string, extension: string): string {
  return `${name.replace(/\.[^./\\]+$/, "") || "photo"}.${extension}`;
}

/**
 * The whole pipeline. Rejects with a `PhotoError` whose message is written for
 * the person who picked the file; every other throw is unexpected.
 */
export async function ingestPhoto(file: File): Promise<Photo> {
  const kind = await sniffImage(file);
  if (!isSupportedKind(kind)) {
    throw new PhotoError("That's not a photo we can read. Try a JPG, PNG or HEIC.");
  }

  /** Every object URL minted below, so a failure part-way leaks none of them. */
  const urls: string[] = [];
  const mint = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return url;
  };
  const release = (keep?: string) => {
    for (const url of urls) if (url !== keep) URL.revokeObjectURL(url);
  };

  try {
    let source: Blob = file;
    let converted = false;

    let img: HTMLImageElement;
    try {
      img = await loadImage(mint(source));
    } catch (cause) {
      // Only HEIC has a second chance — a corrupt JPEG is just corrupt, and
      // handing it to the HEIF decoder would trade one failure for a slower one.
      if (kind !== "heic") {
        throw new PhotoError("That photo could not be opened. Try a different one.");
      }

      try {
        source = await decodeHeic(file);
      } catch (heicCause) {
        console.warn("[photo] HEIC decode failed", cause, heicCause);
        throw new PhotoError("That HEIC photo could not be converted. Try a JPG or PNG.");
      }

      converted = true;
      img = await loadImage(mint(source));
    }

    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) {
      throw new PhotoError("That photo could not be opened. Try a different one.");
    }

    const target = targetSize(naturalWidth, naturalHeight);

    /*
     * HEIC is re-encoded even when Safari decoded it natively and the photo was
     * already small enough. The bytes are kept and uploaded, and a stored
     * `.heic` is a file only one engine can open — the point of accepting the
     * format is to hand back something universal, so "it worked on the device
     * that produced it" is not the bar. Everything else is left untouched
     * unless it is too big, which keeps a small PNG lossless.
     */
    if (target.scaled || kind === "heic") {
      source = await resize(img, target.width, target.height);
      converted = true;
    }

    // Nothing changed: hand back the original File rather than a copy, so the
    // upload sends the bytes the user picked and the name they recognise.
    if (!converted) {
      const url = mint(source);
      release(url);
      return { file, url, width: target.width, height: target.height, kind, converted: false };
    }

    const normalized = new File([source], renamed(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
    const url = mint(normalized);
    release(url);

    return {
      file: normalized,
      url,
      width: target.width,
      height: target.height,
      kind,
      converted: true,
    };
  } catch (cause) {
    release();
    throw cause;
  }
}
