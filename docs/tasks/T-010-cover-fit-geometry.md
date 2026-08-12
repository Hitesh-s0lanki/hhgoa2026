# T-010 — Cover-fit geometry + portrait bias

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 2 — Framing                            |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 3 h                                    |
| **Depends on** | [T-009](T-009-ingest-orchestration.md) |
| **Blocks**     | T-011, T-012, T-013                    |
| **Satisfies**  | FR-2.1, FR-2.2, FR-2.5                 |

## Why this exists

The brief is explicit: portrait, landscape, off-centre crops, different aspect ratios — and the user must **never** be asked to pre-crop. This function is where that requirement is met or missed.

It is also the highest-leverage function in the codebase: about 25 lines, pure, and every visual output depends on it being right.

## Scope

**In:** `coverFit()`, the portrait bias constant, the invariant test suite.

**Out:** face detection ([T-011](T-011-smart-subject-positioning.md)), the drag UI ([T-012](T-012-manual-crop-control.md)), drawing ([T-013](T-013-canvas-renderer-core.md)).

## The problem, drawn

```
   Photo 4000×3000 (4:3)  →  Slot 1:1        crop the SIDES
   ┌────────────────────────────┐
   │░░░░│                │░░░░░│             sw = height × slotAR
   │░░░░│    VISIBLE     │░░░░░│             sh = height
   │░░░░│                │░░░░░│
   └────────────────────────────┘

   Photo 3000×4000 (3:4)  →  Slot 1:1        crop TOP & BOTTOM
   ┌──────────────┐
   │░░░░░░░░░░░░░░│ ← less                   sw = width
   ├──────────────┤                          sh = width ÷ slotAR
   │   VISIBLE    │
   ├──────────────┤                          …and shift the window UP,
   │░░░░░░░░░░░░░░│ ← more                    because faces live high
   └──────────────┘

   Panorama 10000×100 → Slot 1:1             crop almost everything
   ┌──────────────────────────────────────┐
   │░░░░░░░░░░░░░░│VIS│░░░░░░░░░░░░░░░░░░│  must still not crash
   └──────────────────────────────────────┘
```

## Implementation notes

```ts
// lib/image/fit.ts
export type SourceRect = { sx: number; sy: number; sw: number; sh: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far up to shift a vertically-cropped photo, as a fraction of available slack. */
const PORTRAIT_BIAS = -0.24;

export function coverFit(
  img: { width: number; height: number },
  slot: { w: number; h: number },
  t: Transform = { scale: 1, offsetX: 0, offsetY: 0 },
  opts: { autoBias?: boolean } = { autoBias: true },
): SourceRect {
  const slotAR = slot.w / slot.h;
  const imgAR = img.width / img.height;

  // The source window that maps exactly onto the slot with no distortion.
  let sw: number, sh: number;
  let croppedVertically: boolean;
  if (imgAR > slotAR) {
    sh = img.height;
    sw = sh * slotAR;
    croppedVertically = false; // crop sides
  } else {
    sw = img.width;
    sh = sw / slotAR;
    croppedVertically = true; // crop top/bottom
  }

  // Zoom shrinks the window (more crop). Never allow it to exceed the source.
  sw = Math.min(img.width, sw / t.scale);
  sh = Math.min(img.height, sh / t.scale);

  const slackX = img.width - sw;
  const slackY = img.height - sh;

  // Auto-bias applies only when the user hasn't expressed a vertical preference
  // and only when we're actually cropping vertically.
  const bias = opts.autoBias && croppedVertically && t.offsetY === 0 ? PORTRAIT_BIAS : 0;

  const sx = clamp((slackX / 2) * (1 + t.offsetX), 0, slackX);
  const sy = clamp((slackY / 2) * (1 + t.offsetY + bias), 0, slackY);

  return { sx, sy, sw, sh };
}
```

### Why `PORTRAIT_BIAS = -0.24`

Pure centring is wrong for portraits. In a typical phone portrait the head occupies roughly the upper third; centring a 3:4 photo into a 1:1 slot lands the crop on the chest and clips the forehead.

```
   centred (bias 0)              biased −0.24
   ┌──────────────┐              ┌──────────────┐
   │░░ forehead ░░│ ✗ clipped    │              │
   ├──────────────┤              │   ┌──────┐   │ ✓ headroom
   │    eyes      │              │   │ face │   │
   │    mouth     │              │   └──────┘   │
   ├──────────────┤              ├──────────────┤
   │░░░░░░░░░░░░░░│              │░░░░░░░░░░░░░░│
   └──────────────┘              └──────────────┘
```

One constant, no dependencies, no latency — and it fixes the majority of bad automatic crops. Tune it against real photos; anywhere in −0.20 to −0.30 is defensible. Above −0.35 you start clipping chins on close-ups.

Note the `t.offsetY === 0` condition: the moment a user drags vertically, or a face detector supplies a measured offset, the heuristic must get out of the way. Two competing corrections stacking on each other is worse than either alone.

### Deriving a transform from a face box

```ts
/** Convert a detected face box into the offsets that frame it well. */
export function transformForFace(
  img: { width: number; height: number },
  slot: { w: number; h: number },
  face: { x: number; y: number; w: number; h: number }, // pixels in img space
): Transform {
  const base = coverFit(img, slot, { scale: 1, offsetX: 0, offsetY: 0 }, { autoBias: false });
  const slackX = img.width - base.sw;
  const slackY = img.height - base.sh;

  const faceCx = face.x + face.w / 2;
  // Aim the eyeline at ~40% down the slot — reads better than dead centre.
  const targetCy = face.y + face.h * 0.42;

  const wantSx = clamp(faceCx - base.sw / 2, 0, slackX);
  const wantSy = clamp(targetCy - base.sh * 0.4, 0, slackY);

  return {
    scale: 1,
    offsetX: slackX > 0 ? (wantSx / slackX) * 2 - 1 : 0,
    offsetY: slackY > 0 ? (wantSy / slackY) * 2 - 1 : 0,
  };
}
```

Guarding the divisions on `slack > 0` is not cosmetic: for a square photo in a square slot the slack is exactly zero, and dividing by it produces `NaN` offsets that silently blank the render.

## Acceptance criteria

- [ ] `sw / sh === slot.w / slot.h` for **every** input combination — no distortion, ever
- [ ] `sx ≥ 0`, `sy ≥ 0`, `sx+sw ≤ width`, `sy+sh ≤ height` for every transform, including extremes
- [ ] Square photo → square slot at default transform returns the whole image
- [ ] A 3:4 portrait into a 1:1 slot yields `sy < centred` (headroom)
- [ ] `scale > 1` crops in; `scale` never produces a window larger than the source
- [ ] Panorama (10000×100) and strip (100×10000) return valid rects without `NaN`
- [ ] `offsetX/Y` at ±1 clamp to the edges without exceeding them
- [ ] Auto-bias is suppressed when `offsetY !== 0`
- [ ] `transformForFace` returns finite offsets when slack is zero
- [ ] Pure function: no DOM, no canvas, no imports beyond types

## Files touched

```
lib/image/fit.ts
tests/unit/fit.test.ts
```

## How to test

The two property tests carry almost all the value — they are the formal statement of FR-2.1 and FR-2.5. Full suite in [12 — QA](../12-qa-and-testing.md#unit-tests-vitest):

```ts
for (const slot of slots)
  for (const img of images) {
    it("preserves aspect ratio", () => {
      expect(coverFit(img, slot).sw / coverFit(img, slot).sh).toBeCloseTo(slot.w / slot.h, 5);
    });
    it("stays in bounds under every transform", () => {
      /* … */
    });
  }
```

Then verify visually: render every fixture in `tests/fixtures/aspect/` into both templates on a dev page and look at them as a grid. Numbers prove the invariants; eyes prove it looks composed.

## Gotchas

- **`object-fit: cover` in CSS is not a substitute.** It works for an `<img>` preview but tells you nothing about what to pass to `drawImage`. And if the preview uses CSS cover while the export uses different math, preview and output diverge — the bug FR-3.6 exists to prevent.
- **`drawImage` has a 9-argument form for a reason.** `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`. Using the 5-argument form and expecting the slot to crop instead **stretches** the photo. This is the single most common cause of "why is everyone's face squashed".
- **Sampling outside the source is silent.** Negative `sx` or `sx+sw > width` renders transparent slivers at the edge, which look like a frame alignment bug and send you hunting in the wrong file. Hence the clamps.
- **Float precision.** Compare aspect ratios with `toBeCloseTo`, not `===`. And when passing to `drawImage`, do **not** round the source rect to integers — sub-pixel source coordinates are legal and rounding introduces a visible jitter while dragging.
- **Zero-slack division.** Square-into-square gives `slack === 0`. Every normalized offset calculation needs the guard.
- **Do not bake the bias into the stored transform.** Keep it a render-time adjustment, or the first user drag will jump by 24% of the slack as the bias switches off.

## References

- [07 — Image Pipeline, Stage 3](../07-image-pipeline.md#stage-3--fit)
- [MDN: drawImage 9-arg form](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)
