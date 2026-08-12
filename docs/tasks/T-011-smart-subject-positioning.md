# T-011 — Face-aware subject positioning

|                |                                                         |
| -------------- | ------------------------------------------------------- |
| **Phase**      | 2 — Framing                                             |
| **Status**     | ☐ Not started                                           |
| **Estimate**   | 3 h                                                     |
| **Depends on** | [T-010](T-010-cover-fit-geometry.md)                    |
| **Blocks**     | —                                                       |
| **Satisfies**  | FR-2.3                                                  |
| **Droppable**  | **Yes** — T-010 + T-012 already satisfy FR-2 acceptably |

## Why this exists

The brief mentions "off-centre crops". The geometric bias in [T-010](T-010-cover-fit-geometry.md) handles the common case (subject centred horizontally, head in the upper third). It does not handle someone standing at the left edge of a group shot, or a photo taken at arm's length from below.

An actual measurement of where the face is fixes those. But it must never cost the user time — hence ADR-008: this is a progressive enhancement, strictly off the critical path.

## Scope

**In:** lazy-loaded detector, the refinement flow, the time box, the animated adjustment, silent failure.

**Out:** the base heuristic ([T-010](T-010-cover-fit-geometry.md)), the manual control ([T-012](T-012-manual-crop-control.md)), any face recognition or identity inference — we detect a _box_, nothing more.

## The rules that make this safe

```
   1. First preview paints with the heuristic. Always. No waiting.
   2. Detector loads and runs AFTER that paint.
   3. Hard time box: 800 ms. Not answered? Abandon it.
   4. Any failure is silent — the user never learns a detector exists.
   5. If the user has already touched the crop, do not override them.
   6. The adjustment animates over ~250 ms so it reads as intentional polish,
      not as a glitch.
```

Rule 5 is the one most easily broken and the most annoying when it is: a detector result landing after the user started dragging feels like the app fighting them.

## Implementation notes

### Detector choice

| Option                                     | Size                         | Notes                                                                                                  |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **MediaPipe Face Detector (tasks-vision)** | ~1.5 MB wasm + ~230 KB model | Fast (~50–150 ms), accurate, well maintained. Preferred.                                               |
| TFJS BlazeFace                             | ~2–3 MB                      | Works; heavier runtime.                                                                                |
| `FaceDetector` (Shape Detection API)       | 0 KB                         | Free where it exists — but effectively Chrome-only and behind a flag. Try it first, do not rely on it. |
| OpenCV.js Haar cascade                     | ~8 MB                        | No.                                                                                                    |

Opportunistic use of the native API is worth the ten lines:

```ts
// lib/image/face.ts
async function detectNative(bitmap: ImageBitmap): Promise<Box[] | null> {
  const FD = (globalThis as any).FaceDetector;
  if (!FD) return null;
  try {
    const boxes = await new FD({ maxDetectedFaces: 5, fastMode: true }).detect(bitmap);
    return boxes.map((b: any) => b.boundingBox);
  } catch {
    return null;
  }
}
```

### The refinement flow

```ts
// lib/image/face.ts
export type Box = { x: number; y: number; width: number; height: number };

let detector: Promise<unknown> | null = null;

export async function detectFaces(bitmap: ImageBitmap, timeoutMs = 800): Promise<Box[]> {
  const native = await detectNative(bitmap);
  if (native) return native;

  const work = (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
    detector ??= (async () => {
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite" },
        runningMode: "IMAGE",
      });
    })();
    const d = (await detector) as any;
    // Detect on a downscaled copy — accuracy is unaffected, speed is not.
    const small = await downscaleTo(bitmap, 512);
    const res = d.detect(small);
    const k = bitmap.width / small.width;
    small.close();
    return (res.detections ?? []).map((det: any) => scaleBox(det.boundingBox, k));
  })();

  return Promise.race([work, new Promise<Box[]>((r) => setTimeout(() => r([]), timeoutMs))]).catch(
    () => [],
  );
}
```

Detecting on a 512 px copy is the main performance lever — BlazeFace was designed for small inputs and a full 4096 px bitmap buys nothing but latency.

Note `.catch(() => [])`: an empty array means "no information", which the caller already handles by keeping the heuristic. There is no error path to design.

### Applying the result

```ts
// in the store, after the first render has painted
async function refineFraming() {
  const { image, transform, userAdjusted, templateId } = get();
  if (!image || userAdjusted) return; // rule 5

  const faces = await detectFaces(image.bitmap);
  if (faces.length === 0) return; // rule 4

  const union = faces.length === 1 ? faces[0]! : unionBox(faces);
  const slot = photoSlotOf(templates[templateId]);
  const next = transformForFace(image, slot, toPx(union));

  // Ignore trivial corrections — a 3% nudge is not worth an animation.
  if (
    Math.abs(next.offsetY - transform.offsetY) < 0.05 &&
    Math.abs(next.offsetX - transform.offsetX) < 0.05
  )
    return;

  animateTransform(transform, next, 250); // rule 6
}
```

### Multi-face handling

```
   0 faces  → keep the heuristic
   1 face   → centre on it, eyeline at ~40% of slot height (transformForFace)
   2+ faces → union box; if it does not fit at scale 1, this is likely a group
              photo where the user is one of several — prefer the LARGEST face
              (usually closest to camera, usually the uploader) over the union
```

The 2+ rule is a judgement call worth stating: for a profile picture, framing the biggest face is more often what the user wanted than fitting everyone in.

## Acceptance criteria

- [ ] The first preview paints **before** the detector loads — verify by throttling the network
- [ ] The detector chunk and model are absent from the initial bundle
- [ ] Detection completes in under 300 ms on a mid-range phone for a typical photo
- [ ] The 800 ms time box is enforced; a hung detector never blocks anything
- [ ] Zero faces detected → framing is unchanged, no error, nothing logged user-visibly
- [ ] Detector load failure → silent, heuristic retained
- [ ] A user drag before the result lands → result is discarded
- [ ] Corrections under 5% are skipped (no pointless animation)
- [ ] The adjustment animates smoothly and respects `prefers-reduced-motion`
- [ ] An off-centre subject in `landscape-4x3.jpg` is visibly better framed than with the heuristic alone
- [ ] Group photo → the largest face is framed
- [ ] No face data is stored, logged, or transmitted anywhere

## Files touched

```
lib/image/face.ts
lib/image/fit.ts          (transformForFace — added in T-010)
lib/store.ts
public/models/            (tflite model, if using MediaPipe)
public/wasm/              (MediaPipe wasm assets)
```

## How to test

Build a comparison page: the same photo rendered with the heuristic and with the refined transform, side by side, for a set of deliberately awkward inputs — subject at the left edge, subject very low in frame, extreme close-up, group of four, a photo with no face at all, and a photo of a dog.

Then confirm the guarantees by breaking things: block the model request in DevTools (should be silent), add an artificial 5 s delay (time box should fire), and drag the crop immediately after upload (result should be discarded).

## Gotchas

- **Never on the critical path.** If any code path awaits detection before the first paint, this task has failed regardless of how well it detects.
- **The model is big.** ~1.5–3 MB. On venue wifi that is seconds. It must be a lazy chunk, and it is entirely reasonable for it to never load.
- **Detect on a small copy.** Running BlazeFace on a 4096 px bitmap is many times slower for no accuracy gain.
- **`prefers-reduced-motion`.** Jump straight to the final transform rather than animating.
- **This is face _detection_, not recognition.** No identity, no embeddings, no storage. Worth stating explicitly in the privacy copy ([T-031](T-031-privacy-and-abuse.md)) so nobody has to wonder.
- **Sunglasses, hats, profile views, and dark skin tones** all reduce detection rates to varying degrees. This is exactly why the manual control ([T-012](T-012-manual-crop-control.md)) is not optional — a detector that works unevenly across users is only acceptable when there is an equally good manual path.
- **MediaPipe needs its WASM assets served locally.** Pointing `FilesetResolver` at a CDN adds a third-party dependency on the render path; copy the assets into `public/` instead.
- **Do not run detection on every re-render.** Once per photo, cached against the image identity.

## References

- [07 — Image Pipeline, face refinement](../07-image-pipeline.md#optional-face-refinement)
- [04 — Architecture, ADR-008](../04-architecture.md#adr-008--face-detection-is-a-progressive-enhancement)
