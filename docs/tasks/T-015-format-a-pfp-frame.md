# T-015 — Format A: PFP frame template

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Phase**      | 3 — Render engine                                                            |
| **Status**     | ☐ Not started                                                                |
| **Estimate**   | 3 h                                                                          |
| **Depends on** | [T-013](T-013-canvas-renderer-core.md), [T-003](T-003-brand-asset-intake.md) |
| **Blocks**     | —                                                                            |
| **Satisfies**  | FR-3.2                                                                       |

> **Updated 8 Aug 2026 for the real brand kit** ([13](../13-brand-identity.md)). Two reversals from the original draft: the ground is `#0B6839` flat (no gradient), and **there is no grain layer** — hhgoa.com is flat vector throughout, so texture would be off-brand.

## Why this exists

The primary deliverable. A square, branded profile picture: the user's photo untouched, sitting inside a frame that looks like the event designed it.

This is also the task where "on-brand, not stickered" (NFR-2.2) is won or lost. The engine is done by now; this is a design task expressed as data.

## Scope

**In:** the `pfp-frame` spec, layer composition, the overlap that makes it read as integrated, and visual verification against the reference.

**Out:** the render engine ([T-013](T-013-canvas-renderer-core.md)), asset production ([T-003](T-003-brand-asset-intake.md)), export ([T-019](T-019-export-and-variants.md)).

## What "integrated" means, concretely

```
   ✗ STICKERED                          ✓ INTEGRATED
   ┌────────────────────┐               ┌────────────────────┐
   │                    │               │▚▚▚ HH GOA 2026 ▞▞▞ │
   │                    │               │  ╭──────────────╮  │
   │    USER PHOTO      │               │  │              │  │
   │                    │               │  │  USER PHOTO  │  │
   │                    │               │  │              │  │
   │         ┌────────┐ │               │  ╰──────────────╯  │
   │         │  LOGO  │ │               │ ░░░░░░░░░░░░░░░░░░ │
   └─────────┴────────┴─┘               └────────────────────┘

   photo bleeds to the edge,            photo sits in a deliberate slot;
   logo floats on top with no           frame edge overlaps it; pattern,
   compositional relationship           palette and lockup share one system
```

Four things do the work:

1. **The photo is inset**, not full-bleed. It occupies a slot the design defines.
2. **The frame overlaps the photo's edge**, so the two are interlocked rather than stacked.
3. **A ring or border in the brand accent** ties the photo to the palette.
4. **The lockup has a reserved position** in the layout, not a corner it was dropped into.

## Implementation notes

```ts
// lib/templates/pfp-frame.ts
import { brand } from "@/lib/brand/tokens";
import type { TemplateSpec } from "./types";

export const pfpFrame: TemplateSpec = {
  id: "pfp-frame",
  label: "PFP Frame",
  size: { w: 1080, h: 1080 },
  background: brand.color.primary,
  fields: [], // no text input from the user
  layers: [
    // 1 · ground — FLAT. hhgoa.com uses no gradients anywhere.
    { kind: "fill", color: brand.color.primary },

    // 2 · the photo, inset — drawn BEFORE the palms so they can overlap it
    {
      kind: "photo",
      rect: { x: 0.1, y: 0.16, w: 0.8, h: 0.62 },
      radius: 0.04,
      ring: { width: 0.01, color: brand.color.accent },
    },

    // 3 · palm columns, cropped from the event's own footer trees.png
    { kind: "image", src: "/branding/palms.png", rect: { x: 0, y: 0, w: 1, h: 1 } },

    // 4 · the radiating sun, drawn procedurally in #FEE101
    { kind: "custom", id: "sun-rays" },

    // 5 · wordmark — yellow Imbue caps with the black offset shadow
    {
      kind: "image",
      src: "/branding/wordmark.png",
      rect: { x: 0.18, y: 0.045, w: 0.64, h: 0.075 },
    },

    // 6 · flower band along the base
    { kind: "image", src: "/branding/flowers.png", rect: { x: 0, y: 0.88, w: 1, h: 0.12 } },

    {
      kind: "text",
      box: { x: 0.08, y: 0.815, w: 0.84, h: 0.05 },
      token: "GOA · 28–31 OCT 2026",
      font: "body",
      size: 0.03,
      color: brand.color.offwhite,
      align: "center",
      transform: "upper",
      letterSpacing: 0.004,
    },
  ],
};
```

### Why 1080 × 1080

The platform sweet spot. X, Instagram, LinkedIn, and Slack all accept and display a 1:1 avatar well, and 1080 is above every platform's downscale threshold without being wastefully large. Export at `outputScale: 2` → 2160 px ([T-019](T-019-export-and-variants.md)).

### The sun, drawn not shipped

`Sun rise.png` is 3.2 MB. The sun inside it is a half-disc plus straight rays — ~15 lines of canvas, infinitely sharper at any scale, and free:

```ts
// lib/templates/custom/sun.ts
export function drawSunRays(ctx: Ctx, _tpl: TemplateSpec, size: { w: number; h: number }) {
  const cx = size.w * 0.5,
    cy = size.h * 0.8,
    r = size.w * 0.085;
  ctx.save();
  ctx.fillStyle = brand.color.accent;
  ctx.strokeStyle = brand.color.accent;
  ctx.lineCap = "round";
  ctx.lineWidth = size.w * 0.006;

  ctx.beginPath(); // half-disc, flat edge down
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.fill();

  for (let i = 0; i <= 10; i++) {
    // rays fanning over the half-circle
    const a = Math.PI + (i / 10) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
    ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}
```

Fully deterministic, so visual snapshots ([T-029](T-029-cross-device-qa.md)) stay stable.

### No grain

The original draft called for a procedural grain overlay. **Drop it.** hhgoa.com is flat vector throughout — no texture, no noise, no gradients. Grain would be the one element on the card that is not in the brand's language, which is exactly the "generic badge" failure NFR-2.2 is guarding against.

### Variants (P3)

Because a template is just data, a style variant is a new file plus a registry line:

```ts
// e.g. a pink-ground variant using the same layers
export const pfpFramePink: TemplateSpec = {
  ...pfpFrame,
  id: "pfp-frame-pink",
  label: "Sunset",
  background: brand.color.pink,
  layers: recolorFill(pfpFrame.layers, brand.color.pink),
};
```

Ship one style well before adding a second. A style picker with three mediocre options is worse than one confident design.

## Acceptance criteria

- [ ] Renders at 1080² and, at `outputScale: 2`, at 2160² with proportionally identical layout
- [ ] Sits convincingly beside a real hhgoa.com asset — same design system
- [ ] The palms visibly overlap the photo's edge — no seam or gap
- [ ] Portrait, landscape, and square photos all fill the slot with no distortion
- [ ] The ring is inside the slot, unbroken, and the same visual weight at 1× and 2×
- [ ] The wordmark is legible at 1080², and still readable when scaled to 48 px (X avatar size)
- [ ] **No grain, no gradient, no texture** — flat fills only
- [ ] The sun is drawn procedurally and is deterministic across runs
- [ ] Exported greens match `#0B6839` exactly (no P3 drift)
- [ ] No brand element is clipped at the canvas edge
- [ ] The photo is never full-bleed (it must read as placed in a slot)
- [ ] Renders in under 300 ms at scale 1 on a mid-range phone
- [ ] Exports cleanly with no canvas taint error

## Files touched

```
lib/templates/pfp-frame.ts
lib/templates/custom/sun.ts
lib/templates/index.ts
public/branding/palms.png
public/branding/flowers.png
public/branding/wordmark.png
```

## How to test

Render the full aspect fixture set into this template and view the results as one grid image. Look for: distortion, edge gaps, faces clipped by the frame, the logo colliding with photo content.

Then do the honest test. Put the output next to `Sun rise.png` or `footer trees.png` from hhgoa.com and ask whether they look like the same design system. If the photo looks pasted in, the fix is more overlap between the palms and the photo edge — not a bigger wordmark.

## Gotchas

- **Layer order is the whole trick.** Photo before frame. Reversed, the photo covers the frame's inner edge and the result reads as stickered no matter how good the artwork is.
- **The ring must be inset by half its stroke width.** Canvas strokes straddle the path, so a ring drawn on the slot boundary bleeds outward by half its width and clips at the rounded corners.
- **Full-bleed photos always look stickered.** However nice the overlay, if the photo runs to the canvas edge there is no composition — only decoration on top of a photo.
- **`globalCompositeOperation` must be restored.** Leaving `'overlay'` set affects every subsequent draw, and since grain is last in this template you may not notice until a variant reorders the layers.
- **The wordmark must survive avatar size.** X displays avatars at 48 px. Test the output scaled down to 48 px — if the lockup becomes mud, it is too detailed or too small in the composition.
- **Imbue's hairlines vanish when downsampled.** If the wordmark is set as live text rather than the PNG, check it at 48 px before trusting it.
- **`globalCompositeOperation` must be restored** if any custom layer sets it.

## References

- [13 — Brand Identity](../13-brand-identity.md) — palette, fonts, asset inventory
- [06 — Brand & Templates, Format A](../06-brand-and-templates.md#format-a--pfp-frame)
- [01 — Project Overview](../01-project-overview.md#format-a--pfp-frame)
