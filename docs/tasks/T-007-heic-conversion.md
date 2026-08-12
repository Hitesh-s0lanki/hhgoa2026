# T-007 — HEIC / HEIF decode

|                |                                   |
| -------------- | --------------------------------- |
| **Phase**      | 1 — Ingest                        |
| **Status**     | ☐ Not started                     |
| **Estimate**   | 3 h                               |
| **Depends on** | [T-006](T-006-file-validation.md) |
| **Blocks**     | T-009                             |
| **Satisfies**  | FR-1.5                            |

## Why this exists

HEIC is the iPhone camera default. If this does not work, the app does not work for most of its audience. It is also the only place in the pipeline where we cannot hit the "near-instant" budget, so it needs honest, well-behaved feedback rather than optimism.

## Scope

**In:** capability-based routing to a WASM decoder, lazy loading of that decoder, the progressive-feedback rule, and failure copy that tells the user how to avoid the problem next time.

**Out:** validation ([T-006](T-006-file-validation.md)), orientation and downscaling ([T-008](T-008-exif-and-downscale.md)).

## The landscape

```
   Can the browser decode HEIC natively?
   ┌──────────────────────┬──────────┬──────────────────────────────────┐
   │ Safari iOS / macOS   │ usually  │ Apple's platform decoder          │
   │ Chrome (any OS)      │ no       │ needs libheif via WASM            │
   │ Firefox              │ no       │ needs WASM                        │
   │ Android WebView      │ no       │ needs WASM                        │
   └──────────────────────┴──────────┴──────────────────────────────────┘

   Complication: iOS often transcodes on export. A photo picked through
   <input type="file"> frequently arrives as JPEG because iOS converted it
   for compatibility — but not always. It depends on iOS version, which
   picker appeared, and the source app.
```

Conclusion, and the central design decision of this task: **do not branch on file type. Branch on whether the native decode succeeded.** Any type-based branch will be wrong for some real device.

## Implementation notes

### Try-native-first

```ts
// lib/image/decode.ts
import { sniff } from "./validate";
import { IngestError } from "./errors";

export async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    // Fast path: Chrome/Firefox for JPEG/PNG/WebP, Safari for all of those + HEIC.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const kind = await sniff(file);
    if (kind !== "image/heic") throw new IngestError("DECODE_FAILED");
    return decodeHeic(file);
  }
}
```

Two properties fall out of this ordering, both valuable:

- Safari users never download the WASM decoder at all.
- Chrome-on-Android users download it only when they actually hand us a HEIC.

### The lazy WASM wrapper

```ts
// lib/image/heic.ts
let mod: Promise<typeof import("heic-to")> | null = null;

/** Loads the HEIC decoder chunk once. ~1 MB — never in the entry bundle. */
function load() {
  return (mod ??= import("heic-to"));
}

export async function decodeHeic(file: File): Promise<ImageBitmap> {
  const { heicTo } = await load();
  const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  // Round-trip through createImageBitmap so EXIF orientation is applied uniformly.
  return createImageBitmap(jpeg, { imageOrientation: "from-image" });
}

/** Optional: warm the chunk when a HEIC is likely, without blocking anything. */
export function prefetchHeicDecoder() {
  void load();
}
```

Converting to JPEG at 0.92 rather than PNG is deliberate: PNG of a 12 MP photo is enormous and slow to re-decode, and the photo is lossy-originated anyway. The quality loss is not visible at our output sizes.

### The progressive-feedback rule

HEIC decode takes roughly 300 ms to 3 s depending on the photo and the phone. A spinner that flashes for 200 ms is worse than no spinner.

```ts
// Show feedback only if we are actually slow.
const SHOW_AFTER = 400;

export async function decodeWithFeedback(file: File, onSlow: () => void) {
  const timer = setTimeout(onSlow, SHOW_AFTER);
  try {
    return await decodeToBitmap(file);
  } finally {
    clearTimeout(timer);
  }
}
```

And when it does show, the copy is specific: **"Converting your photo…"** — not "Processing", not "AI thinking", not a fake progress bar. It says what is happening, which is the entire difference the brief's "no progress theatre" line is asking for.

### Library choice

| Option                 | Notes                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **`heic-to`**          | Modern, maintained, promise-based, ships libheif WASM. Preferred. |
| `heic2any`             | Widely used, works, older API, larger bundle. Solid fallback.     |
| `libheif-js` directly  | Most control, most work. Only if the wrappers misbehave.          |
| Server-side conversion | Contradicts ADR-001 — uploads the face and adds a round trip.     |

Verify whichever you pick actually decodes `iphone-hdr.heic`. 10-bit HEIC with an HDR gain map is where these libraries most often differ, and it is a normal photo from any recent iPhone.

## Acceptance criteria

- [ ] `iphone.heic` decodes to a correct bitmap in desktop Chrome
- [ ] `iphone.heic` decodes in Android Chrome on a real device
- [ ] `iphone-hdr.heic` (10-bit / gain map) decodes without artefacts
- [ ] Safari decodes HEIC **without** loading the WASM chunk — verify in the network panel
- [ ] The WASM chunk is absent from the initial bundle — verify in the build output
- [ ] JPEG / PNG / WebP never trigger the HEIC path
- [ ] A HEIC that fails to decode produces `DECODE_FAILED` with the "Most Compatible" hint
- [ ] A corrupt non-HEIC file produces `DECODE_FAILED` without loading the chunk
- [ ] "Converting your photo…" appears only when decode exceeds 400 ms
- [ ] Decode of a typical 12 MP iPhone HEIC completes in under 2.5 s on a mid-range Android
- [ ] EXIF orientation is correct on the HEIC path too (it goes through `createImageBitmap`)

## Files touched

```
lib/image/decode.ts
lib/image/heic.ts
components/states/Converting.tsx
tests/fixtures/formats/iphone.heic
tests/fixtures/formats/iphone-hdr.heic
```

## How to test

Real devices only for the parts that matter. Take a fresh photo on an iPhone with **Settings → Camera → Formats → High Efficiency**, then:

1. Upload it in iOS Safari → should work with no WASM chunk fetched.
2. AirDrop it to a Mac, upload in Chrome → should work via the WASM path.
3. Send it to an Android phone, upload in Chrome → should work via the WASM path.
4. Time each one and record the numbers against the NFR-1 budget.

Then switch the iPhone to "Most Compatible", take another photo, and confirm the JPEG path is used with no decoder load.

## Gotchas

- **Do not branch on `file.type`.** It is `''` for HEIC in several Android pickers and `image/heic` in others, and iOS may have already transcoded the file to JPEG regardless of what the extension says. The try/catch ordering above is the only reliable approach.
- **The chunk is big.** 1–1.5 MB of WASM. On venue wifi that is a noticeable wait _on top of_ the decode. Consider `prefetchHeicDecoder()` on a touch device where the picker just opened — speculative, cheap, and invisible if unused.
- **Decoding is main-thread-blocking unless you are careful.** Ideally run it inside the render worker ([T-013](T-013-canvas-renderer-core.md)) so a 2 s decode does not freeze the page.
- **Memory.** A 12 MP HEIC → JPEG → bitmap chain holds several large objects at once. `close()` intermediates and drop the JPEG blob reference immediately after `createImageBitmap`.
- **HDR / 10-bit HEIC** can decode with a colour shift or fail entirely in some library versions. It is not exotic — it is the iPhone default. Test it explicitly.
- **Live Photos** may present as HEIC + MOV. Only `files[0]` is used, and a MOV should be rejected by [T-006](T-006-file-validation.md).
- **Do not `await import()` inside the click handler** if you later add a native-share call in the same gesture — the yield consumes the user gesture. Relevant to [T-025](T-025-native-share-sheet.md).

## References

- [07 — Image Pipeline, Stage 2](../07-image-pipeline.md#the-heic-problem)
- [libheif](https://github.com/strukturag/libheif)
