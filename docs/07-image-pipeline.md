# 07 — Image Pipeline

The core engineering document. Everything here is client-side.

```
  File ──► VALIDATE ──► DECODE ──► NORMALIZE ──► FIT ──► COMPOSITE ──► ENCODE ──► Blob
           T-006        T-007/8    T-008         T-010/11/12  T-013/14/15/16   T-019
```

---

## Stage 1 · Validate

Cheap checks before we spend memory. Never trust `file.type` alone — it comes from the OS and is wrong often enough to matter (notably `""` for some HEIC pickers and Android WebViews).

```ts
// lib/image/validate.ts
const MAX_BYTES = 25 * 1024 * 1024;
const MIN_EDGE = 320; // hard reject below this
const WARN_EDGE = 600; // warn but allow

const MAGIC: Array<[string, (b: Uint8Array) => boolean]> = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8],
  ["image/png", (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ["image/webp", (b) => str(b, 0, 4) === "RIFF" && str(b, 8, 4) === "WEBP"],
  // HEIC/HEIF: ISO-BMFF 'ftyp' box at offset 4, brand at 8
  [
    "image/heic",
    (b) =>
      str(b, 4, 4) === "ftyp" &&
      ["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"].includes(str(b, 8, 4)),
  ],
];

export async function sniff(file: File) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return MAGIC.find(([, test]) => test(head))?.[0] ?? null;
}
```

Order of checks — fail fast, cheapest first:

1. `file.size === 0` → "That file looks empty."
2. `file.size > MAX_BYTES` → "That file's too big (max 25 MB)."
3. `sniff()` returns null → "That's not a photo. Try a JPG, PNG, or HEIC."
4. Post-decode: `min(w,h) < MIN_EDGE` → reject; `< WARN_EDGE` → warn, allow override.

Task: [T-006](tasks/T-006-file-validation.md)

---

## Stage 2 · Decode

### The fast path

```ts
const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
```

One call. It decodes off the main thread and applies EXIF orientation. Supported in Chrome, Firefox, and Safari 16+. This handles JPEG, PNG, WebP, and — on Safari — often HEIC too, because Apple's platform decoder is available to the browser.

### The HEIC problem

HEIC is not an edge case: it is the iPhone default. Three things are true and each needs handling.

```
   Which browsers can decode HEIC natively?
   ┌────────────────────┬──────────────┬─────────────────────────────────┐
   │ Safari (iOS/macOS) │ usually yes  │ platform decoder is available   │
   │ Chrome / Firefox   │ no           │ needs WASM (libheif)            │
   │ Android WebView    │ no           │ needs WASM                      │
   └────────────────────┴──────────────┴─────────────────────────────────┘

   Also: iOS often converts on the way out. A photo picked via
   <input type="file"> from an iPhone frequently arrives as JPEG
   already, because iOS transcodes for compatibility. Sometimes it
   does not — depends on iOS version, picker, and source app.
```

Therefore: **do not branch on file type. Branch on whether decode succeeded.**

```ts
// lib/image/decode.ts
export async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Native decode failed. If it smells like HEIC, convert; otherwise it's corrupt.
    const kind = await sniff(file);
    if (kind !== "image/heic") throw new UnreadableImageError();

    const { heicTo } = await import("heic-to"); // lazy chunk, ~1 MB wasm
    const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    return await createImageBitmap(jpeg, { imageOrientation: "from-image" });
  }
}
```

This ordering means Safari users never download the WASM decoder, and Chrome-on-Android users download it only when they actually hand us a HEIC.

**Progressive-feedback rule:** start a 400 ms timer when the HEIC path begins. If it is still running, show a real "Converting your photo…" state. If it finishes first, show nothing at all. Never show a state that flashes.

Task: [T-007](tasks/T-007-heic-conversion.md)

### EXIF orientation

Eight possible EXIF orientation values; only value 1 means "as stored".

```
   1 normal      2 mirror H     3 rotate 180   4 mirror V
   5 transpose   6 rotate 90CW  7 transverse   8 rotate 90CCW
```

`imageOrientation: 'from-image'` handles all eight. Only if `createImageBitmap` is unavailable do we need the manual path: read orientation with `exifr`, then apply the matching `ctx.transform()` before drawing. Both paths are covered in [T-008](tasks/T-008-exif-and-downscale.md), and the eight-orientation test fixture set is a required deliverable there — this is the single most common "my photo is sideways" bug class.

### Downscale

A 48 MP photo decoded to a bitmap is ~192 MB of RGBA. Cap it:

```ts
const MAX_EDGE = 4096; // ≥ 2× our largest export, plenty of headroom for zoom
```

`createImageBitmap` accepts `resizeWidth` / `resizeHeight` / `resizeQuality: 'high'`, which downsamples during decode rather than after — lower peak memory:

```ts
const probe = await createImageBitmap(file); // cheap metadata read
const s = Math.min(1, MAX_EDGE / Math.max(probe.width, probe.height));
probe.close();
const bitmap =
  s < 1
    ? await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeWidth: Math.round(probe.width * s),
        resizeQuality: "high",
      })
    : await createImageBitmap(file, { imageOrientation: "from-image" });
```

Always `bitmap.close()` old bitmaps when the user replaces a photo. Mobile Safari will kill the tab on repeated multi-megapixel leaks.

---

## Stage 3 · Fit

The requirement: any aspect ratio must fill a fixed slot with no distortion and no letterboxing. That is `object-fit: cover` — but we need it as numbers, because we are drawing, not styling.

### Cover-fit geometry

```
   Photo 4000×3000 (4:3 landscape)      Slot 1:1
   ┌────────────────────────────┐        ┌──────────┐
   │░░░░│                │░░░░░│   ──►  │          │
   │░░░░│    VISIBLE     │░░░░░│        │  center  │
   │░░░░│                │░░░░░│        │          │
   └────────────────────────────┘        └──────────┘
        └── crop ──┘  └── crop ──┘
   scale = slotH/photoH  (height-limited)

   Photo 3000×4000 (3:4 portrait)       Slot 1:1
   ┌──────────────┐                      ┌──────────┐
   │░░░░░░░░░░░░░░│  ← crop              │          │
   ├──────────────┤                 ──►  │  offset  │
   │   VISIBLE    │                      │  upward  │
   ├──────────────┤                      │          │
   │░░░░░░░░░░░░░░│  ← crop              └──────────┘
   └──────────────┘
   scale = slotW/photoW  (width-limited)
   ↑ this is where the face usually lives, so bias the crop up
```

```ts
// lib/image/fit.ts
export type SourceRect = { sx: number; sy: number; sw: number; sh: number };

/**
 * Returns the source rectangle of `img` to draw into `slot` such that the slot
 * is fully covered, aspect ratio preserved.
 * @param t.scale    1 = minimal cover. >1 zooms in (crops more).
 * @param t.offsetX  −1 = crop window hard left, 0 = centred, +1 = hard right.
 * @param t.offsetY  same, vertical. Clamped so we never sample outside the image.
 */
export function coverFit(
  img: { width: number; height: number },
  slot: { w: number; h: number },
  t: Transform = { scale: 1, offsetX: 0, offsetY: 0 },
): SourceRect {
  const slotAR = slot.w / slot.h;
  const imgAR = img.width / img.height;

  // Size of the source window that maps exactly onto the slot.
  let sw: number, sh: number;
  if (imgAR > slotAR) {
    sh = img.height;
    sw = sh * slotAR;
  } // landscape-ish: crop sides
  else {
    sw = img.width;
    sh = sw / slotAR;
  } // portrait-ish: crop top/bottom

  sw /= t.scale;
  sh /= t.scale;

  // Slack available to move the window around, then place it.
  const slackX = img.width - sw;
  const slackY = img.height - sh;
  const sx = clamp((slackX / 2) * (1 + t.offsetX), 0, slackX);
  const sy = clamp((slackY / 2) * (1 + t.offsetY), 0, slackY);

  return { sx, sy, sw, sh };
}
```

Properties worth asserting in tests ([T-010](tasks/T-010-cover-fit-geometry.md)):

- `sw/sh === slot.w/slot.h` for every input → no distortion, ever.
- `sx ≥ 0 && sy ≥ 0 && sx+sw ≤ width && sy+sh ≤ height` → never sample outside (which would render transparent edges).
- `scale: 1, offset: 0` on a square photo into a square slot → the full image.
- Extreme inputs (10000×100 panorama, 100×10000 strip) still return a valid rect.

### Smart vertical bias

Pure centring is wrong for portraits. Heads sit high in the frame; centring a 3:4 portrait into a 1:1 slot commonly clips the forehead or centres on the chest.

```ts
// Applied only when the crop is vertically constrained (portrait into a squarer slot).
const PORTRAIT_BIAS = -0.24; // shift window up by 24% of available slack
```

This one constant fixes the majority of bad automatic crops and costs nothing. It ships as the default in [T-010](tasks/T-010-cover-fit-geometry.md).

### Optional face refinement

A lazily-loaded detector can replace the heuristic with an actual measurement:

```
   detect faces
       │
       ├─ 0 faces  ──► keep heuristic
       ├─ 1 face   ──► centre the crop window on the face box,
       │                then nudge down so there is headroom
       │                (eyeline at ~40% of slot height reads best)
       └─ 2+ faces ──► centre on the union box, zoom out to contain it
```

Hard rules (ADR-008):

- Runs **after** the first preview is already painted. The user sees a result immediately; it may then improve by one small animated adjustment.
- Time-boxed at 800 ms. If it has not answered, we keep the heuristic and abandon it.
- Any failure is silent.

Task: [T-011](tasks/T-011-smart-subject-positioning.md)

### Manual override

Always available, because no heuristic is right every time. A pinch/drag surface over the preview plus a zoom slider, writing directly to `Transform`. Small, cheap, and it converts "the crop is wrong" from a bug report into a two-second gesture. Task: [T-012](tasks/T-012-manual-crop-control.md)

---

## Stage 4 · Composite

Single generic renderer, driven by the `TemplateSpec` ([06](06-brand-and-templates.md)).

```ts
// lib/render/render.ts
export async function render(ctx: Ctx2D, req: RenderRequest): Promise<void> {
  const { template: tpl, image, transform, fields, outputScale } = req;
  const W = tpl.size.w * outputScale;
  const H = tpl.size.h * outputScale;
  const px = (n: Norm, axis: "x" | "y" = "x") => n * (axis === "x" ? W : H);

  ctx.clearRect(0, 0, W, H);

  for (const layer of tpl.layers) {
    switch (layer.kind) {
      case "fill":
        drawFill(ctx, layer, W, H);
        break;
      case "gradient":
        drawGradient(ctx, layer, W, H);
        break;

      case "photo": {
        const slot = { w: px(layer.rect.w), h: px(layer.rect.h, "y") };
        const { sx, sy, sw, sh } = coverFit(image, slot, transform);
        ctx.save();
        clipShape(ctx, layer, px); // rounded rect or circle
        ctx.drawImage(
          image.bitmap,
          sx,
          sy,
          sw,
          sh,
          px(layer.rect.x),
          px(layer.rect.y, "y"),
          slot.w,
          slot.h,
        );
        ctx.restore();
        if (layer.ring) strokeShape(ctx, layer, px);
        break;
      }

      case "image":
        await drawAsset(ctx, layer, px);
        break; // from a preloaded cache
      case "text":
        drawText(ctx, layer, fields, px, W, H);
        break; // T-014
      case "custom":
        customLayers[layer.id]?.(ctx, tpl);
        break;
    }
  }
}
```

Drawing rules that matter:

| Rule                                                                     | Reason                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `ctx.imageSmoothingQuality = 'high'`                                     | Visible difference when downsampling a big photo                                |
| Preload every asset before the first draw                                | An async load mid-render produces a flash of missing layers                     |
| Cache decoded assets in a module-level `Map`                             | Re-render on every slider tick must not re-fetch                                |
| `await document.fonts.ready` (or worker `FontFace`) before any text draw | Canvas silently falls back to a default face otherwise — the #1 canvas-text bug |
| Same function for preview and export                                     | FR-3.6 becomes structural, not aspirational                                     |
| One `save()`/`restore()` pair per clipped layer                          | Leaked clip regions are maddening to debug                                      |

Task: [T-013](tasks/T-013-canvas-renderer-core.md)

### Worker topology

```
   Main thread                        Render worker
   ───────────                        ─────────────
   file picked
     ├─ validate
     └─ postMessage(file) ──────────► decode (HEIC lazy)
                                      downscale
        ◄──────── {w,h,ok} ───────────┘
   show shell + slot
     └─ postMessage(renderReq) ─────► render to OffscreenCanvas
        ◄──── transferToImageBitmap ──┘
   drawImage onto visible <canvas>

   export:
        postMessage({scale:2}) ─────► render + convertToBlob
        ◄──────────── Blob ──────────┘
```

`ImageBitmap` and `Blob` are transferable/structured-cloneable, so nothing large is copied. If `OffscreenCanvas` is missing, the same `render()` runs on the main thread against a regular canvas — the function only ever touches a 2D context.

---

## Stage 5 · Encode

| Use                | Format | Settings                         | Why                                                      |
| ------------------ | ------ | -------------------------------- | -------------------------------------------------------- |
| Download (default) | PNG    | `toBlob('image/png')`            | Lossless, crisp text and logo edges. 2–5 MB for a photo. |
| Download (small)   | JPEG   | `quality 0.92`                   | ~400–800 KB. Offered as "smaller file".                  |
| Share upload       | JPEG   | `quality 0.9`, longest edge 1200 | Fast upload; well within X's OG image limits.            |
| Story variant (P3) | PNG    | 1080 × 1920                      | Different template, same engine.                         |

```ts
const blob = await canvas.convertToBlob({ type: "image/png" }); // OffscreenCanvas
// or: await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
```

Export at `outputScale: 2` (2160 px for a 1080 template) then let the platform downscale — text and logo edges hold up better than rendering at 1× and letting the viewer upscale. Task: [T-019](tasks/T-019-export-and-variants.md)

---

## Memory discipline

Mobile Safari is unforgiving. Rules:

```ts
// on photo replace
oldBitmap?.close();
URL.revokeObjectURL(oldPreviewUrl);

// after export
URL.revokeObjectURL(downloadUrl); // but only after the click has been handled

// avoid
//   - keeping the original File around after decode (it's the largest object)
//   - stacking multiple full-res canvases
//   - re-decoding on every render (decode once, cache the bitmap)
```

A 12 MP photo plus a 2160² canvas plus an export blob is already ~90 MB of live data. Two of those alive at once is a tab crash on an older iPhone.

---

## Known failure modes, catalogued

| Symptom                             | Cause                                                    | Fix / owner                                                                    |
| ----------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Photo appears sideways              | EXIF orientation ignored                                 | `imageOrientation:'from-image'` · [T-008](tasks/T-008-exif-and-downscale.md)   |
| Photo appears stretched             | Drew with slot dimensions instead of a cover source rect | `coverFit` · [T-010](tasks/T-010-cover-fit-geometry.md)                        |
| Transparent slivers at photo edges  | Source rect sampled outside the bitmap                   | Clamp in `coverFit`                                                            |
| Text renders in Times/Arial         | Drew before fonts loaded                                 | Await font load · [T-014](tasks/T-014-text-layout-engine.md)                   |
| Text overflows the card             | No shrink/wrap/ellipsis chain                            | Layout engine · [T-014](tasks/T-014-text-layout-engine.md)                     |
| Blurry output on retina             | Canvas backing store not scaled                          | Fixed native size × `outputScale`, CSS-sized separately                        |
| Export tainted / `toBlob` throws    | Asset drawn from another origin without CORS             | Serve all brand assets same-origin from `public/`                              |
| Missing frame layer, intermittently | Asset still loading at draw time                         | Preload-all before first render · [T-013](tasks/T-013-canvas-renderer-core.md) |
| Tab crash on iPhone                 | Bitmap leak                                              | `close()` discipline, `MAX_EDGE` cap                                           |
| HEIC file rejected as "not a photo" | `file.type` empty, sniff missing a brand                 | Extend the `ftyp` brand list · [T-006](tasks/T-006-file-validation.md)         |
| Slider drag stutters                | Rendering on the main thread                             | Worker · ADR-002                                                               |
| Preview ≠ download                  | Two render paths                                         | One render function, two scales                                                |
