# T-019 — Export to PNG/JPEG + size variants

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 4 — Output                             |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 2 h                                    |
| **Depends on** | [T-013](T-013-canvas-renderer-core.md) |
| **Blocks**     | T-020, T-022, T-023, T-025             |
| **Satisfies**  | FR-3.7, FR-4.4                         |

## Why this exists

The deliverable is a file. This task turns the rendered canvas into a `Blob` at the right resolution, in the right format, with a sensible name — and makes it available _before_ the user taps share, because the native share sheet cannot wait for a render ([T-025](T-025-native-share-sheet.md)).

## Scope

**In:** blob encoding, output scale, format selection per use case, filename generation, eager export, blob URL lifecycle.

**Out:** the download interaction ([T-020](T-020-download-action.md)), upload ([T-023](T-023-storage-presigned-upload.md)).

## Implementation notes

### Output matrix

| Use                | Format     | Scale | Result             | Why                                            |
| ------------------ | ---------- | ----- | ------------------ | ---------------------------------------------- |
| Download (default) | PNG        | 2×    | 2160² or 2160×2700 | Lossless; crisp logo and type edges            |
| Download (small)   | JPEG q0.92 | 2×    | ~400–800 KB        | Offered when the PNG is over ~4 MB             |
| Native share       | JPEG q0.92 | 2×    | ~600 KB            | Share sheets and messaging apps prefer smaller |
| Link share upload  | JPEG q0.90 | 1×    | ~250 KB, ≤1200 px  | Fast upload; well inside X's OG limits         |
| Story variant (P3) | PNG        | 2×    | 1080×1920          | Different template, same engine                |

### Why export at 2×

```
   render at 1× (1080)  →  viewed at 1080  →  fine
   render at 1× (1080)  →  viewed at 2160  →  soft, upscaled
   render at 2× (2160)  →  viewed at 1080  →  crisp (platform downsamples well)
```

Platforms downscale far better than they upscale, and the cost is only encode time. Text and logo edges are where the difference shows.

Note this is `outputScale` in the render request, **not** `devicePixelRatio`. The export size must not depend on the user's screen — two people on different phones must get the same file.

```ts
// lib/render/export.ts
export type ExportSpec = {
  mime: "image/png" | "image/jpeg";
  quality?: number;
  scale: number;
  maxEdge?: number;
};

export const EXPORTS = {
  download: { mime: "image/png", scale: 2 },
  downloadJpg: { mime: "image/jpeg", quality: 0.92, scale: 2 },
  nativeShare: { mime: "image/jpeg", quality: 0.92, scale: 2 },
  linkShare: { mime: "image/jpeg", quality: 0.9, scale: 1, maxEdge: 1200 },
} as const satisfies Record<string, ExportSpec>;
```

### Encoding

```ts
// OffscreenCanvas (worker) — preferred
const blob = await canvas.convertToBlob({ type: spec.mime, quality: spec.quality });

// Main-thread canvas fallback
const blob = await new Promise<Blob>((res, rej) =>
  canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), spec.mime, spec.quality),
);
```

`toBlob` is asynchronous and off the main thread internally, unlike `toDataURL` — which is synchronous, blocks for hundreds of milliseconds on a large canvas, and produces a base64 string ~33% larger than the binary. Only use `toDataURL` as a last-resort fallback.

### Filenames

```ts
// lib/render/export.ts
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

export function filename(templateId: string, fields: Fields, mime: string) {
  const who = slug(fields.name ?? "");
  const ext = mime === "image/png" ? "png" : "jpg";
  return ["hh-goa-2026", templateId, who].filter(Boolean).join("-") + "." + ext;
}
// → hh-goa-2026-builder-card-hitesh-solanki.png
// → hh-goa-2026-pfp-frame.png            (Format A has no name field)
```

Accent stripping matters: a filename with combining diacriticals can be mangled by some filesystems and share targets. Names in non-Latin scripts slug to empty, which is why the `filter(Boolean)` is there — the result degrades to `hh-goa-2026-builder-card.png` rather than producing a trailing dash.

### Eager export

The native share sheet must be called synchronously within the user's gesture ([T-025](T-025-native-share-sheet.md)). If the blob does not exist yet, awaiting a render consumes the gesture and the share is blocked with a `NotAllowedError`.

So: export as soon as the preview settles, in the background.

```ts
// after a render completes and nothing is pending
scheduleIdle(async () => {
  const blob = await exportBlob(EXPORTS.nativeShare);
  set({ exportBlob: blob }); // ready before the user can plausibly tap
});
```

Use `requestIdleCallback` where available, a `setTimeout(…, 300)` otherwise. Invalidate `exportBlob` on every state change so a stale blob can never be shared — a share of the _previous_ crop is a genuinely confusing bug.

### Blob URL lifecycle

```ts
// Revoke the OLD url when replacing, never the one currently in use.
const url = URL.createObjectURL(blob);
if (prevUrl) URL.revokeObjectURL(prevUrl);
```

Every un-revoked blob URL pins its blob in memory for the page's lifetime. A user who adjusts the crop twenty times leaks twenty multi-megabyte blobs, and on mobile Safari that is a crashed tab.

Do not revoke immediately after triggering a download — some browsers have not finished reading the blob. Revoke on the next state change, or after a generous timeout.

### Size guard

```ts
const MAX_PNG = 4 * 1024 * 1024;
if (blob.size > MAX_PNG) {
  // Offer the JPEG instead rather than silently switching formats.
  set({ suggestJpeg: true });
}
```

Suggest, do not switch. A user who asked for a PNG and silently got a JPEG has been given something other than what they chose.

## Acceptance criteria

- [ ] PNG export at 2× produces 2160² (Format A) and 2160×2700 (Format B)
- [ ] Layout at 2× is proportionally identical to 1× (no drift)
- [ ] Export size does not depend on `devicePixelRatio`
- [ ] JPEG export at q0.92 is under 1 MB for a typical photo
- [ ] Link-share export is ≤ 1200 px and under 400 KB
- [ ] Filenames are lowercase, hyphenated, accent-free, ≤ 64 chars
- [ ] A non-Latin name degrades to a valid filename with no trailing dash
- [ ] `exportBlob` is ready in state before the user can plausibly tap share
- [ ] `exportBlob` is invalidated on any transform, field, or template change
- [ ] Old blob URLs are revoked; repeated exports do not grow memory
- [ ] Encode of a 2160 px canvas completes in under 500 ms on a mid-range phone
- [ ] Text and logo edges are crisp at 2×, verified by zooming into the file
- [ ] No `SecurityError` from a tainted canvas

## Files touched

```
lib/render/export.ts
lib/render/worker.ts       (export message handler)
lib/store.ts               (exportBlob, invalidation)
```

## How to test

Export both templates, open the files at 100% zoom, and inspect the logo edges and the smallest text — that is where 1× vs 2× is unmistakable. Check file sizes against the matrix above.

Then test invalidation, which is the subtle part: upload a photo, wait for the eager export, drag the crop, and immediately tap share. The shared image must reflect the _new_ crop. If it shows the old one, invalidation is missing or racing.

Memory: export twenty times in a row while watching memory in DevTools. Flat is correct; a staircase means blob URLs are leaking.

## Gotchas

- **`toDataURL` blocks the main thread** for a long time on a 2160 px canvas and inflates the payload by 33%. Use `toBlob`/`convertToBlob`.
- **`transferToImageBitmap` clears the canvas.** If the preview path uses it, re-render before exporting rather than assuming the canvas still holds content.
- **A tainted canvas throws on export.** Any cross-origin asset without CORS taints it, and the error surfaces here rather than at draw time — which makes it look like an export bug. Serve brand assets same-origin.
- **JPEG has no alpha.** A template with a transparent background exports with black where it should be clear. Both our templates have opaque backgrounds, but a future variant might not — fill the background explicitly before a JPEG encode.
- **`quality` is ignored for PNG.** Passing it is harmless but misleading in code review.
- **Do not revoke a blob URL synchronously after a download click.** Some browsers have not read it yet and the download silently fails.
- **A stale `exportBlob` is a real bug class.** Any state change must invalidate it. Consider keying the blob to a render generation counter so a mismatch is detectable rather than assumed.

## References

- [07 — Image Pipeline, Stage 5](../07-image-pipeline.md#stage-5--encode)
- [MDN: HTMLCanvasElement.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
