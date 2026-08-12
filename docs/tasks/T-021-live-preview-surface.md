# T-021 — Live preview surface & regeneration

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 4 — Output                             |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 2.5 h                                  |
| **Depends on** | [T-013](T-013-canvas-renderer-core.md) |
| **Blocks**     | T-012, T-027                           |
| **Satisfies**  | FR-3.6, FR-1.9                         |

## Why this exists

The preview is the product's main surface. Two hard requirements meet here:

1. **The preview must equal the output** (FR-3.6). Not approximately — the same renderer, the same template, only a different scale.
2. **It must never feel like it is "generating"** (NFR-1). No spinner between an adjustment and its result. The preview _is_ the artwork, not a report on the artwork.

## Scope

**In:** the visible `<canvas>`, DPR-correct sizing, receiving frames from the worker, layout stability, the replace-photo affordance, `data-render-settled` for tests.

**Out:** the renderer ([T-013](T-013-canvas-renderer-core.md)), the crop gesture ([T-012](T-012-manual-crop-control.md)), export ([T-019](T-019-export-and-variants.md)).

## Implementation notes

### Sizing: two separate concerns

Canvas has a backing-store size and a CSS display size. Conflating them produces the classic blurry-canvas bug.

```tsx
// components/editor/PreviewCanvas.tsx
export function PreviewCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { templateId } = useStore();
  const tpl = templates[templateId];

  return (
    <div
      // Reserve the aspect box up front so nothing shifts when the photo lands.
      style={{ aspectRatio: `${tpl.size.w} / ${tpl.size.h}` }}
      className="relative mx-auto w-full max-w-[420px]"
    >
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  );
}
```

```ts
// Backing store: display size × DPR, capped so a 3× phone doesn't render 3× the pixels.
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const cssW = el.clientWidth;
canvas.width = Math.round(cssW * dpr);
canvas.height = Math.round(cssW * dpr * (tpl.size.h / tpl.size.w));
```

Capping DPR at 2 is deliberate: on a 3× device the visual difference between 2× and 3× on a photo is imperceptible, and the render cost is 2.25× higher.

Note the preview's `outputScale` is derived from the _display_ size, while the export's comes from `EXPORTS.download` ([T-019](T-019-export-and-variants.md)). Same template, same math, different scale — that is the whole of FR-3.6.

### Reserving the aspect box

`aspectRatio` on the wrapper, set from the template, means the space is correct before any photo exists. Without it, the preview appears and shoves the page down — a layout shift that hurts both CLS and the feeling of stability. This is also why the empty state lives _inside_ the reserved box rather than replacing it.

### Receiving frames

```ts
// The worker owns an OffscreenCanvas and sends completed frames.
worker.onmessage = (e) => {
  if (e.data.type !== "frame") return;
  const bmp: ImageBitmap = e.data.bitmap;
  const ctx = canvasRef.current!.getContext("2d")!;
  ctx.transferFromImageBitmap?.(bmp) ?? ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  canvasRef.current!.dataset.renderSettled = "true";
};
```

Better still: transfer control of the visible canvas to the worker once with `canvas.transferControlToOffscreen()`, so the worker paints directly to the screen and no per-frame message is needed at all. Where that is unavailable, the message-per-frame path above works.

### The no-spinner rule

```
   photo selected
        │
        ├─ 0 ms      shell + reserved aspect box visible (already there)
        ├─ ~150 ms   skeleton shimmer inside the box  ← only if still empty
        ├─ ~400 ms   "Converting…" — ONLY on the HEIC path
        └─ ready     first frame, fade in over 150 ms
```

Adjustments after the first frame get **no** loading state at all. A render takes under 100 ms; anything shown for that long is a flash, and a flash reads as instability. The only legitimate visible wait in the whole app is HEIC decode ([T-007](T-007-heic-conversion.md)).

### Replace photo

```tsx
<button onClick={openPicker} className="absolute right-3 bottom-3 …">
  Change photo
</button>
```

An overlay control on the preview, not a separate step. FR-1.9 requires replacing without a page reload; the store's `selectFile` ([T-009](T-009-ingest-orchestration.md)) already handles the transition, including keeping the current preview if the new file fails.

### `data-render-settled`

```ts
// set to 'false' on every render request, 'true' when a frame is painted
```

This attribute is what makes the visual regression tests in [T-029](T-029-cross-device-qa.md) reliable instead of flaky. Screenshotting on a timeout is guesswork; screenshotting on an explicit settle signal is deterministic. Worth adding even though it only exists for tests.

### Responsive layout

```
   Mobile (< 640)              Desktop (≥ 1024)
   ┌───────────────┐           ┌──────────────┬────────────┐
   │   PREVIEW     │           │              │  controls  │
   │               │           │   PREVIEW    │  form      │
   ├───────────────┤           │              │  actions   │
   │   controls    │           │              │            │
   │   actions     │           └──────────────┴────────────┘
   └───────────────┘
```

On mobile the preview stays pinned above the controls so it remains visible while typing ([T-018](T-018-builder-form.md)) — a form that pushes the preview off-screen defeats the point of a live preview.

## Acceptance criteria

- [ ] The preview uses the same `render()` as the export
- [ ] The preview is visually identical to the downloaded file (proportionally)
- [ ] Canvas is crisp on retina; DPR is capped at 2
- [ ] The aspect box is reserved before any photo loads — zero layout shift
- [ ] No spinner appears for adjustment re-renders
- [ ] The skeleton appears only if the first frame is still absent at ~150 ms
- [ ] "Converting…" appears only on the HEIC path, only after 400 ms
- [ ] The first frame fades in; subsequent frames do not
- [ ] "Change photo" replaces the image without a page reload
- [ ] A failed replacement keeps the existing preview
- [ ] Switching template re-renders at the new aspect without a flash of the old one
- [ ] `data-render-settled` is `false` during a render and `true` after
- [ ] Rotating the phone re-sizes the canvas without losing crop state
- [ ] Adjustments repaint within 100 ms on a mid-range phone
- [ ] `prefers-reduced-motion` disables the fade

## Files touched

```
components/editor/PreviewCanvas.tsx
components/editor/EditorShell.tsx
lib/render/host.ts
lib/store.ts
```

## How to test

The FR-3.6 check is the important one and it is easy to do properly: screenshot the preview at a known width, download the file, scale it to the same width, and diff them. They should be identical apart from resampling. Any structural difference means two render paths exist somewhere.

Then check stability: load the page on a throttled connection and watch for layout shift as the shell, then the skeleton, then the frame appear. Nothing should move.

Rotate the phone mid-edit and confirm the crop survives — the canvas resizes but `transform` is independent of display size, so it should.

## Gotchas

- **CSS size ≠ backing store size.** Setting only the CSS size gives a blurry canvas; setting only `width`/`height` gives a canvas that ignores layout. Set both, deliberately.
- **Assigning `canvas.width` clears the canvas.** So a resize must be followed by a re-render, not just a repaint.
- **`transferControlToOffscreen` is one-way.** Once transferred, the main thread cannot get a 2D context from that canvas again. Fine, but it means the fallback path must be chosen before the transfer, not after.
- **Do not use an `<img>` for the preview.** An `<img>` applies EXIF orientation automatically while canvas does not, so the preview could look right while the export is sideways ([T-008](T-008-exif-and-downscale.md)).
- **A spinner for a 60 ms render is worse than nothing.** It reads as jank. Trust the render speed and show nothing.
- **Reserve the box, always.** The layout shift when the preview appears is one of those details that separates a tool that feels finished from one that does not.
- **Do not tie `outputScale` to `devicePixelRatio` for the export.** That is the preview's concern only; the exported file must be identical for every user ([T-019](T-019-export-and-variants.md)).
- **iOS Safari has a canvas area limit** (historically around 16.7 M pixels). A 2160×2700 export is ~5.8 M, comfortably inside — but a hypothetical 4× export would not be.

## References

- [03 — User Flows, Step 3](../03-user-flows.md#step-3--adjust-optional)
- [02 — Requirements, NFR-1](../02-requirements.md#nfr-1--performance-near-instant)
