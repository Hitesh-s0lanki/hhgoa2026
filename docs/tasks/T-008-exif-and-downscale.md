# T-008 — EXIF orientation + downscale normalization

|                |                                   |
| -------------- | --------------------------------- |
| **Phase**      | 1 — Ingest                        |
| **Status**     | ☐ Not started                     |
| **Estimate**   | 2.5 h                             |
| **Depends on** | [T-006](T-006-file-validation.md) |
| **Blocks**     | T-009                             |
| **Satisfies**  | FR-1.8                            |

## Why this exists

Two classic bugs, both fatal to the product's credibility:

1. **Sideways photos.** Phone cameras store the sensor's raw orientation and record the correction as an EXIF flag. Draw the pixels without applying it and a portrait photo appears rotated 90°.
2. **Tab crashes.** A 48 MP photo decoded to RGBA is ~192 MB. Two of those alive at once kills the tab on an older iPhone.

This task produces the `NormalizedImage` everything downstream assumes: upright, size-capped, ready to draw.

## Scope

**In:** orientation handling (native path + manual fallback), the size cap, `NormalizedImage` construction, bitmap lifecycle discipline, and the eight-orientation fixture set.

**Out:** decode itself ([T-007](T-007-heic-conversion.md)), crop geometry ([T-010](T-010-cover-fit-geometry.md)).

## The eight orientations

```
   value  meaning              transform needed
   ─────  ───────────────────  ─────────────────────────────
     1    normal               none
     2    mirrored horizontal  scale(-1, 1)
     3    rotated 180°         rotate(180°)
     4    mirrored vertical    scale(1, -1)
     5    transposed           rotate(90°CW) + scale(-1,1)
     6    rotated 90° CW       rotate(90°CW)     ← most common on phones
     7    transverse           rotate(90°CCW) + scale(-1,1)
     8    rotated 90° CCW      rotate(90°CCW)
```

Values 5–8 also **swap width and height**, which is the part hand-rolled implementations get wrong.

## Implementation notes

### The native path — one option, all eight cases

```ts
const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
```

Supported in Chrome, Firefox, and Safari 16+. It handles all eight values, swaps dimensions where required, and does it in the browser's optimized decoder. Use it. Do not write a rotation matrix if you do not have to.

### Combining with the size cap

```ts
// lib/image/normalize.ts
const MAX_EDGE = 4096; // ≥2× our largest export; leaves headroom for zoom

export async function normalize(file: File): Promise<NormalizedImage> {
  // Cheap metadata probe. Note: this respects EXIF for dimensions only if we
  // ask it to, so ask consistently.
  const probe = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width: w, height: h } = probe;

  if (Math.max(w, h) <= MAX_EDGE) {
    return { bitmap: probe, width: w, height: h, source: await kindOf(file) };
  }

  // Too big: re-decode with resize so peak memory stays bounded, then drop the probe.
  probe.close();
  const s = MAX_EDGE / Math.max(w, h);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    resizeWidth: Math.round(w * s),
    resizeHeight: Math.round(h * s),
    resizeQuality: "high",
  });
  return { bitmap, width: bitmap.width, height: bitmap.height, source: await kindOf(file) };
}
```

Using `resizeWidth`/`resizeHeight` on `createImageBitmap` downsamples **during** decode rather than after, which is the difference between a 192 MB peak and a 48 MB one. `resizeQuality: 'high'` matters — the default produces visibly aliased results when downscaling by 3× or more.

The double-decode for oversized images is a deliberate trade: a little extra time on rare large photos, in exchange for never holding the full-size bitmap.

### The manual fallback (only for browsers without `imageOrientation`)

```ts
// lib/image/orient.ts
export function applyOrientation(ctx: CanvasRenderingContext2D, o: number, w: number, h: number) {
  switch (o) {
    case 2:
      ctx.transform(-1, 0, 0, 1, w, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, w, h);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, h);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, h, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, h, w);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, w);
      break;
  }
}

// Canvas dimensions swap for 5–8:
const [cw, ch] = o >= 5 ? [h, w] : [w, h];
```

Read the orientation value with `exifr` (small, tree-shakeable) — `await exifr.orientation(file)`. Only build this path if [Q-15](../11-open-questions.md) resolves toward supporting Safari 15 or older; otherwise it is dead code.

### Lifecycle discipline

```ts
// Whenever the user replaces the photo:
state.image?.bitmap.close(); // ← not optional on mobile Safari

// Never retain the File after normalize() — it is the largest object in play.
```

`ImageBitmap` holds memory outside the JS heap, so the GC will not save you. Three or four leaked 12 MP bitmaps is a crashed tab, and the crash looks like a random app failure rather than a leak.

## Acceptance criteria

- [ ] All eight fixtures `exif-1.jpg` … `exif-8.jpg` render **upright**
- [ ] Fixtures 5–8 report swapped width/height
- [ ] A 48 MP photo is capped to 4096 px on its long edge
- [ ] Downscaling uses `resizeQuality: 'high'` — no visible aliasing
- [ ] Peak memory for a 48 MP input stays bounded (no full-size bitmap ever held)
- [ ] Replacing the photo 10× in a row does not grow memory or crash the tab
- [ ] `NormalizedImage.width/height` match `bitmap.width/height` exactly
- [ ] HEIC files, coming via [T-007](T-007-heic-conversion.md), are also oriented correctly
- [ ] Works in Chrome, Safari, and Firefox

## Files touched

```
lib/image/normalize.ts
lib/image/orient.ts        (fallback only)
lib/types.ts               (NormalizedImage)
tests/fixtures/orientation/exif-{1..8}.jpg
```

## How to test

Generate the fixtures from a single base image with obviously asymmetric content — text works best, because a wrong rotation is unmistakable:

```bash
for i in 1 2 3 4 5 6 7 8; do
  cp base.jpg "tests/fixtures/orientation/exif-$i.jpg"
  exiftool -overwrite_original -Orientation=$i -n "tests/fixtures/orientation/exif-$i.jpg"
done
```

Then build a dev page that loads all eight side by side. All eight must look identical. This is a two-minute visual check that catches the most-reported bug class in this kind of app, and it is worth wiring permanently into the dev tools page.

Memory: Chrome DevTools → Performance monitor → watch the JS heap _and_ the "GPU memory" line while replacing photos repeatedly. On iOS, use Safari's Web Inspector timeline against a real device.

## Gotchas

- **`imageOrientation` defaults to `'none'`** in `createImageBitmap`. Omitting the option means no orientation is applied and every phone photo comes out sideways. This is the bug.
- **`<img>` tags apply EXIF automatically; canvas does not.** So a photo can look correct in an `<img>` preview and be sideways in the export. If your preview uses an `<img>` and your export uses canvas, you will not notice until someone downloads a file. Use the canvas for both ([T-021](T-021-live-preview-surface.md)).
- **`drawImage` from an `<img>` is inconsistent across browsers** with respect to EXIF. Another reason to normalize to an `ImageBitmap` once, at the boundary.
- **Do not double-apply.** If you route through `createImageBitmap` with `from-image` and _then_ apply a manual transform, the photo ends up rotated twice.
- **HEIC has orientation too.** After the WASM conversion to JPEG, the EXIF flag may or may not survive. Routing the converted blob back through `createImageBitmap(..., 'from-image')` (as [T-007](T-007-heic-conversion.md) does) handles both cases.
- **`bitmap.close()` on a bitmap still being drawn** throws. Close after the render settles, not during.
- **4096 px is a considered number:** 2× our largest export (2160), so a user can zoom in without softness, while staying inside typical mobile texture limits.

## References

- [07 — Image Pipeline, EXIF](../07-image-pipeline.md#exif-orientation)
- [MDN: createImageBitmap options](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
