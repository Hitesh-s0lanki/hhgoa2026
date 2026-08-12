"use client";

import { CAPTURE_SIZES } from "@/components/editor/CaptureSurface";
import { canEncodeWebp, rasterize, slugify, toFile } from "./rasterize";

/**
 * The files a finished pass produces, and the plumbing to get them out of the
 * browser — either onto the user's disk or into an upload.
 *
 * Nothing here talks to the network. Download is deliberately a pure client
 * path: no session, no upload, no row, no way for it to fail because a service
 * is down (ADR-005 in spirit — storage stays opt-in).
 */

/** 3× on the 704×556 sheet → 2112×1668. Print-ish without being a huge file. */
const SHEET_SCALE = 3;

/** 2× on 1200×630 → 2400×1260, so the link thumbnail is sharp on a retina phone. */
const OG_SCALE = 2;

/** High enough that the difference from lossless is invisible on flat artwork. */
const WEBP_QUALITY = 0.9;

export type PassImages = {
  /**
   * Lossless PNG of both faces — what Download saves. Deliberately *not* the
   * WebP: this is a file someone keeps and re-uploads elsewhere, and a `.webp`
   * is the thing that gets rejected by the one form that only takes PNG/JPEG.
   */
  download: File;
  /**
   * The same sheet in the smallest format this browser can encode. Only ever
   * displayed by `/share/[id]` in a real browser, so WebP is free of risk here
   * and cuts it from ~380 KB to ~100 KB on the share tap.
   */
  sheet: File;
  /**
   * The 1200×630 crop behind `og:image`. **Always PNG**, even where WebP is
   * available. This one is read by crawlers rather than browsers — X handles
   * WebP, but LinkedIn and some chat unfurlers do not, and the failure mode is
   * a posted link with a blank preview, which is the entire point of the file.
   * Worth ~170 KB to not gamble on someone else's parser.
   */
  og: File;
};

export type CaptureNodes = {
  sheet: HTMLElement | null;
  og: HTMLElement | null;
};

function required(node: HTMLElement | null, which: string): HTMLElement {
  if (!node) throw new Error(`The ${which} is not ready yet.`);
  return node;
}

/** WebP where the browser can encode it, PNG where it cannot (WebKit). */
const wireFormat = () =>
  canEncodeWebp()
    ? ({ type: "image/webp", quality: WEBP_QUALITY } as const)
    : ({ type: "image/png" } as const);

/**
 * Every image the pass needs, in one pass over the capture surface.
 *
 * Sequential, not `Promise.all`: each capture is a synchronous layout + paint
 * of a full-size clone, so running them together only interleaves on the same
 * main thread and makes the first finish later. Sequential also lets each
 * capture read the fonts and the photo out of the previous one's cache, which
 * is where most of its time would otherwise go.
 *
 * This whole function runs *before* any button is pressed — it is kicked off
 * when the pass dialog opens (see `usePassShare`), so the cost lands while the
 * user is looking at their card rather than while they wait on a spinner.
 */
export async function renderPassImages(
  nodes: CaptureNodes,
  name: string,
  signal?: AbortSignal,
): Promise<PassImages> {
  const slug = slugify(name);
  const sheetNode = required(nodes.sheet, "card");
  const wire = wireFormat();

  const png = await rasterize(sheetNode, { scale: SHEET_SCALE, signal });
  const download = toFile(png, `hhgoa-2026-pass-${slug}`);

  // On WebKit the wire format *is* PNG, so re-capturing would spend half a
  // second producing a byte-identical file. Reuse it instead.
  const sheet =
    wire.type === "image/png"
      ? download
      : toFile(
          await rasterize(sheetNode, { scale: SHEET_SCALE, signal, ...wire }),
          `hhgoa-2026-card-${slug}`,
        );

  const og = toFile(
    await rasterize(required(nodes.og, "link preview"), { scale: OG_SCALE, signal }),
    `hhgoa-2026-og-${slug}`,
  );

  return { download, sheet, og };
}

/**
 * Save a file the page already holds. An object URL rather than a data URL —
 * a 2112×1668 PNG base64-encodes to several megabytes of string, and Safari
 * refuses `data:` downloads over a size limit anyway.
 */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;

  // Must be in the document for the click to count as a user-initiated
  // navigation in Firefox.
  document.body.append(link);
  link.click();
  link.remove();

  // Revoking synchronously cancels the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export { CAPTURE_SIZES };
