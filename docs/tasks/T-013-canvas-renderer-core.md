# T-013 — Renderer core: worker + OffscreenCanvas

|                |                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| **Phase**      | 3 — Render engine                                                                  |
| **Status**     | ☐ Not started                                                                      |
| **Estimate**   | 4 h                                                                                |
| **Depends on** | [T-004](T-004-template-spec-and-registry.md), [T-010](T-010-cover-fit-geometry.md) |
| **Blocks**     | T-014, T-015, T-016, T-019, T-021                                                  |
| **Satisfies**  | FR-3.1                                                                             |

## Why this exists

The heart of the product. One function that takes a `TemplateSpec` plus a photo and produces pixels — used identically for the on-screen preview and the exported file, which is how FR-3.6 (preview equals output) becomes a structural guarantee rather than a discipline.

Running it in a worker is what keeps the crop drag at 60 fps while compositing a 2160 px canvas.

## Scope

**In:** `render()`, the layer draw functions, the asset preload cache, the worker host and its message protocol, and the main-thread fallback.

**Out:** text layout ([T-014](T-014-text-layout-engine.md)), the specific templates ([T-015](T-015-format-a-pfp-frame.md)/[T-016](T-016-format-b-builder-card.md)), blob encoding ([T-019](T-019-export-and-variants.md)), the visible canvas element ([T-021](T-021-live-preview-surface.md)).

## Implementation notes

### The one rule

```ts
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
```

`render()` accepts a 2D context and a data object. Nothing else. No React, no `window`, no DOM. That constraint is what lets the same code run in a worker, on the main thread as a fallback, and in a Node test — and it is the first thing to check if the architecture starts to rot.

### The renderer

```ts
// lib/render/render.ts
export async function render(ctx: Ctx, req: RenderRequest): Promise<void> {
  const { template: tpl, image, transform, fields, outputScale: s } = req;
  const W = tpl.size.w * s;
  const H = tpl.size.h * s;
  const px = (n: Norm, axis: "x" | "y" = "x") => n * (axis === "x" ? W : H);

  // Preload everything BEFORE the first stroke. A mid-render async load
  // produces a visible flash of missing layers.
  await Promise.all([ensureFonts(), preloadAssets(tpl)]);

  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high"; // visibly better when downsampling

  for (const layer of tpl.layers) {
    switch (layer.kind) {
      case "fill":
        drawFill(ctx, layer, W, H);
        break;
      case "gradient":
        drawGradient(ctx, layer, W, H);
        break;
      case "image":
        drawAsset(ctx, layer, px);
        break;
      case "photo":
        drawPhoto(ctx, layer, image, transform, px);
        break;
      case "text":
        drawText(ctx, layer, fields, px, W, H);
        break;
      case "custom":
        customLayers[layer.id]?.(ctx, tpl, { w: W, h: H });
        break;
      default: {
        const _never: never = layer; // exhaustiveness: a new Layer kind is a compile error
        void _never;
      }
    }
  }
}
```

The `never` default is worth the four lines: adding a layer kind to the union in [T-004](T-004-template-spec-and-registry.md) without handling it here becomes a type error instead of a silently missing layer.

### The photo layer

```ts
// lib/render/layers.ts
function drawPhoto(ctx: Ctx, layer: PhotoLayer, image: NormalizedImage, t: Transform, px: PxFn) {
  const dx = px(layer.rect.x),
    dy = px(layer.rect.y, "y");
  const dw = px(layer.rect.w),
    dh = px(layer.rect.h, "y");
  const { sx, sy, sw, sh } = coverFit(image, { w: dw, h: dh }, t);

  ctx.save();
  clipShape(ctx, layer, px); // rounded rect or circle
  ctx.drawImage(image.bitmap, sx, sy, sw, sh, dx, dy, dw, dh); // 9-arg form
  ctx.restore(); // ← releases the clip

  if (layer.ring) {
    ctx.save();
    ctx.strokeStyle = layer.ring.color;
    ctx.lineWidth = px(layer.ring.width);
    // Inset by half the stroke so the ring sits inside the slot, not straddling it.
    pathShape(ctx, layer, px, px(layer.ring.width) / 2);
    ctx.stroke();
    ctx.restore();
  }
}
```

One `save()`/`restore()` pair per clipped layer, always. A leaked clip region silently blanks every subsequent layer and is genuinely unpleasant to track down, because the symptom appears in a different layer than the bug.

### Asset preloading and caching

```ts
// lib/render/assets.ts
const cache = new Map<string, ImageBitmap>();

export async function preloadAssets(tpl: TemplateSpec): Promise<void> {
  const srcs = tpl.layers.filter((l) => l.kind === "image").map((l) => l.src);
  await Promise.all(
    srcs
      .filter((s) => !cache.has(s))
      .map(async (src) => {
        const res = await fetch(src);
        if (!res.ok) {
          console.warn(`[assets] missing ${src}`);
          return;
        }
        cache.set(src, await createImageBitmap(await res.blob()));
      }),
  );
}

export const getAsset = (src: string) => cache.get(src);
```

Module-level, so a slider drag re-rendering 60 times per second does not re-fetch anything. `fetch` + `createImageBitmap` rather than `new Image()` because it works in worker scope, where `Image` does not exist.

**A missing asset warns and skips rather than throwing.** A render that produces most of the design is better than a blank canvas, and the warning tells you which file to fix.

### Worker protocol

```ts
// lib/render/worker.ts
type Msg =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "load"; file: File }
  | { type: "render"; req: SerializableRenderRequest }
  | { type: "export"; req: SerializableRenderRequest; mime: string; quality?: number };

let canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D;
let image: NormalizedImage | null = null;

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  switch (m.type) {
    case "init":
      canvas = m.canvas;
      ctx = canvas.getContext("2d")!;
      break;

    case "load": // decode inside the worker
      image = await normalize(m.file); // T-007/T-008 — off main thread
      self.postMessage({ type: "loaded", width: image.width, height: image.height });
      break;

    case "render": {
      resize(m.req);
      await render(ctx, { ...m.req, image: image! });
      const bmp = canvas.transferToImageBitmap();
      self.postMessage({ type: "frame", bitmap: bmp }, [bmp]); // transferred, not copied
      break;
    }

    case "export": {
      resize(m.req);
      await render(ctx, { ...m.req, image: image! });
      const blob = await canvas.convertToBlob({ type: m.mime, quality: m.quality });
      self.postMessage({ type: "blob", blob });
      break;
    }
  }
};
```

Running HEIC decode in the worker too is a meaningful win: a 2 s WASM decode on the main thread freezes the whole page, including the state that would show "Converting…".

`ImageBitmap` in the transfer list means the frame moves without a copy. Forgetting the transfer list makes every frame a structured clone of several megabytes.

### Main-thread fallback

```ts
// lib/render/host.ts
export function createRenderer() {
  if (caps.offscreenCanvas && typeof Worker !== "undefined") return workerRenderer();
  return mainThreadRenderer(); // identical render(), regular canvas, rAF-coalesced
}
```

Both hosts expose the same interface, so no component knows which is in play. The fallback is genuinely the same `render()` — the only difference is where it runs.

### Coalescing

```ts
// Never render more than once per frame, no matter how fast state changes.
let pending: RenderRequest | null = null,
  scheduled = false;
export function requestRender(req: RenderRequest) {
  pending = req;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const r = pending!;
    pending = null;
    send(r);
  });
}
```

A slider fires far more events than frames. Without coalescing, the worker queue backs up and the drag feels laggy even though each render is fast.

## Acceptance criteria

- [ ] `render()` imports nothing from `react`, `next`, or the DOM
- [ ] The same `render()` runs in a worker and on the main thread with identical output
- [ ] All assets and fonts are loaded before the first stroke — no flash of missing layers
- [ ] Assets are fetched once and cached across re-renders
- [ ] A missing asset warns and skips; the render still completes
- [ ] `outputScale: 1` and `outputScale: 2` produce proportionally identical results
- [ ] Photo layers use the 9-argument `drawImage` with a `coverFit` source rect
- [ ] Clip regions are always released (`save`/`restore` paired)
- [ ] Ring strokes sit inside the slot, not straddling its edge
- [ ] Adding a `Layer` kind without handling it is a **compile** error
- [ ] Renders are coalesced to at most one per animation frame
- [ ] A full 2160 px render completes in under 500 ms on a mid-range phone
- [ ] `ImageBitmap` frames are transferred, not copied — verify no memory growth during a drag
- [ ] `imageSmoothingQuality: 'high'` is set

## Files touched

```
lib/render/render.ts
lib/render/layers.ts
lib/render/shapes.ts
lib/render/assets.ts
lib/render/worker.ts
lib/render/host.ts
```

## How to test

Render each template into a headless canvas at scale 1 and scale 2, export both, and upscale the 1× to compare against the 2× — they should differ only in sampling quality, never in layout. Any positional difference means a pixel value leaked into a template where a `Norm` belongs.

Then, in the browser: drag the crop slider under 4× CPU throttle while watching the frame rate. If it drops below 60, either coalescing or the worker path is not working.

## Gotchas

- **The 5-argument `drawImage` stretches.** `drawImage(img, dx, dy, dw, dh)` ignores the source rect entirely and squashes the photo to fit. Always the 9-argument form for photo layers.
- **A leaked clip blanks later layers.** The symptom shows up in the wrong place. Pair every `save()` with a `restore()` in the same function, and prefer a helper that cannot forget.
- **`transferToImageBitmap` empties the canvas.** After calling it, the canvas is blank. Fine for our flow (we redraw every frame), but surprising if you assume the content persists.
- **Fonts do not exist in a worker by default.** The `FontFace` registration from [T-002](T-002-design-tokens-and-ui.md) must run in worker scope too, or all text silently uses a fallback.
- **`new Image()` is undefined in a worker.** Use `fetch` + `createImageBitmap` for assets.
- **Cross-origin assets taint the canvas** and make `convertToBlob` throw a `SecurityError`. Serve every brand asset same-origin from `public/`. This is also why we do not use a CDN for them.
- **Resizing the canvas clears it.** Set `canvas.width`/`height` once per size change, before drawing — not between layers.
- **Do not round the destination rect to integers** if the template's normalized values produce fractional pixels; rounding introduces a 1 px layout drift between 1× and 2× that is visible when comparing.
- **Firefox `OffscreenCanvas` support varies by version** for the 2D context. The capability check plus the main-thread fallback covers it, but test Firefox explicitly rather than assuming.

## References

- [07 — Image Pipeline, Stage 4](../07-image-pipeline.md#stage-4--composite)
- [04 — Architecture, ADR-002](../04-architecture.md#adr-002--render-in-a-web-worker-with-offscreencanvas)
