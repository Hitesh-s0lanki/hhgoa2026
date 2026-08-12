# 06 — Brand & Templates

> **The real brand kit has been extracted from hhgoa.com — see [13 — Brand Identity](13-brand-identity.md).**
> The asset-intake and placeholder sections below are superseded; the `TemplateSpec` contract is not.

## The requirement behind "on-brand"

The brief's real ask is a design one:

> Bad: a photo with a logo dropped on it.
> Good: an asset that looks like the HH Goa 2026 design team made it.

```
   ✗ STICKERED                      ✓ INTEGRATED
   ┌──────────────────┐             ┌──────────────────┐
   │                  │             │▚▚ HH GOA 2026 ▞▞ │ ← lockup is part
   │   USER  PHOTO    │             │  ╭────────────╮  │   of the layout
   │                  │             │  │            │  │
   │                  │             │  │   PHOTO    │  │ ← photo sits in a
   │      [LOGO]      │             │  │            │  │   deliberate slot
   └──────────────────┘             │  ╰────────────╯  │
                                    │ ░░ brand pattern │ ← texture, palette,
   logo floats, no                  └──────────────────┘   typography carry
   relationship to the                                     the identity
   composition
```

Practically, that means the brand must supply **more than a logo**: a palette, a typeface, some geometry or texture, and a compositional idea. Getting those is [T-003](tasks/T-003-brand-asset-intake.md), and it is the first real blocker on the project.

---

## Asset inventory

**Resolved.** The kit was extracted from hhgoa.com on 8 Aug 2026 — full palette, fonts, and asset list in [13 — Brand Identity](13-brand-identity.md). Harvesting and re-exporting is [T-003](tasks/T-003-brand-asset-intake.md).

Summary of what the templates consume:

| Asset                 | Derived from                        | Notes                                        |
| --------------------- | ----------------------------------- | -------------------------------------------- |
| `palms.png`           | `hhgoa.com/assets/footer trees.png` | palm columns, 2160 px, alpha                 |
| `flowers.png`         | same                                | bottom flower band                           |
| `wordmark.png`        | `hhgoa.com/assets/Hacker house.png` | yellow Imbue caps + black offset             |
| `goa-devanagari.svg`  | `hhgoa.com/assets/goa_hindi.svg`    | "गोवा", optional corner mark                 |
| the sun               | _drawn procedurally_                | half-disc + rays; do not ship the 3.2 MB PNG |
| `fonts/display.woff2` | Google Fonts — Imbue                | SIL OFL                                      |
| `fonts/body.woff2`    | Google Fonts — Victor Mono          | SIL OFL                                      |

---

## Design tokens

One source of truth, consumed by both Tailwind (for the UI chrome) and the canvas renderer (for the artwork). A single file avoids the classic drift where the website is one orange and the exported PNG is another.

```ts
// lib/brand/tokens.ts  — REAL values, extracted from hhgoa.com (see doc 13)
export const brand = {
  color: {
    primary: "#0B6839", // deep green — the ground, ~70% of every surface
    accent: "#FEE101", // bright yellow — display type, the sun
    pink: "#FF0080", // hot magenta — CTAs, spot accent
    offwhite: "#FFFBE8", // warm cream — light panels, muted text
    white: "#FFFFFF",
    black: "#000000", // offset shadows only, never a fill
  },
  font: {
    display: { family: "Imbue", weight: 400, file: "/branding/fonts/display.woff2" },
    body: { family: "Victor Mono", weight: 500, file: "/branding/fonts/body.woff2" },
  },
  // The site's signature move: a hard black offset behind yellow display type.
  shadow: { offset: { dx: 0.004, dy: 0.004, color: "#000000" } },
  radius: { photo: 0.04, ui: "0.625rem" },
  isPlaceholder: false,
} as const;
```

Both faces are Google Fonts under the **SIL Open Font License**, so self-hosting a WOFF2 subset is unambiguously permitted — [Q-3](11-open-questions.md) is resolved.

Tailwind reads the same object in `tailwind.config.ts`, so `bg-primary` in the UI and `brand.color.primary` in a template spec can never diverge. Owned by [T-002](tasks/T-002-design-tokens-and-ui.md).

**Resolution independence:** every geometric value in a template is expressed as a fraction of the canvas, never in pixels. That is how one spec renders identically at 540 px (preview) and 2160 px (export).

---

## The `TemplateSpec` contract

A template is data. The renderer is the only code.

```ts
// lib/templates/types.ts

export type Norm = number; // 0..1, fraction of canvas width/height

export type Rect = { x: Norm; y: Norm; w: Norm; h: Norm };

export type Layer =
  | { kind: "fill"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "image"; src: string; rect: Rect; opacity?: number; blend?: GlobalCompositeOperation }
  | {
      kind: "photo";
      rect: Rect;
      radius?: Norm;
      shape?: "rect" | "circle";
      ring?: { width: Norm; color: string };
    }
  | {
      kind: "text";
      box: Rect;
      token: keyof Fields | string; // literal or field ref
      font: "display" | "body";
      size: Norm; // fraction of canvas height
      minSize?: Norm;
      color: string;
      align: "left" | "center" | "right";
      transform?: "upper" | "none";
      maxLines?: number;
      letterSpacing?: Norm;
    }
  | { kind: "custom"; id: string }; // escape hatch: a named draw fn

export type TemplateSpec = {
  id: "pfp-frame" | "builder-card" | string;
  label: string;
  size: { w: number; h: number }; // native export pixels, e.g. 1080×1080
  background: string;
  layers: Layer[]; // drawn in order, back to front
  fields: Array<keyof Fields>; // which form inputs this template needs
  safeArea?: Rect; // nothing important outside this
};
```

### Why `custom` exists

Real brand designs contain one or two things a declarative spec will not anticipate — here it is the radiating sun, which is far cheaper drawn than shipped as a 3.2 MB PNG. Rather than inflate the spec into a general graphics language, we allow a named custom layer resolved from a small registry:

```ts
// lib/templates/custom/index.ts
export const customLayers: Record<string, (ctx: Ctx, spec: TemplateSpec) => void> = {
  "sun-rays": drawSunRays, // yellow half-disc + rays, the signature mark
  "title-divider": drawDivider,
};
```

Rule: reach for `custom` only after trying to express it declaratively. Every `custom` layer is a small piece of brand logic living in code, and that is exactly what ADR-003 is trying to minimise.

---

## Format A — `pfp-frame`

```ts
// lib/templates/pfp-frame.ts
export const pfpFrame: TemplateSpec = {
  id: "pfp-frame",
  label: "PFP Frame",
  size: { w: 1080, h: 1080 },
  background: brand.color.primary,
  fields: [],
  layers: [
    { kind: "fill", color: brand.color.primary }, // flat — the site has no gradients
    {
      kind: "photo",
      rect: { x: 0.1, y: 0.16, w: 0.8, h: 0.62 },
      radius: 0.04,
      ring: { width: 0.01, color: brand.color.accent },
    },
    { kind: "image", src: "/branding/palms.png", rect: { x: 0, y: 0, w: 1, h: 1 } },
    { kind: "custom", id: "sun-rays" }, // yellow half-disc + rays
    {
      kind: "image",
      src: "/branding/wordmark.png",
      rect: { x: 0.18, y: 0.045, w: 0.64, h: 0.075 },
    },
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

Notes:

- The photo slot is drawn **before** the palm overlay, so the palms cross its edge — that overlap is what stops it looking pasted on.
- `fill`, not `gradient`. hhgoa.com is flat vector throughout; a gradient would read as a different brand.
- **No grain layer.** The site has no texture anywhere. This reverses the earlier draft, which was written before the real kit was known.
- `palms.png` and `flowers.png` are crops of the event's `footer trees.png` ([13](13-brand-identity.md#asset-inventory)), which already contains exactly this composition.
- 1080 × 1080 is the platform sweet spot for avatars and square posts.

Task: [T-015](tasks/T-015-format-a-pfp-frame.md)

## Format B — `builder-card`

```ts
// lib/templates/builder-card.ts
export const builderCard: TemplateSpec = {
  id: "builder-card",
  label: "Builder ID",
  size: { w: 1080, h: 1350 }, // 4:5 — the tallest X shows uncropped
  background: brand.color.primary,
  fields: ["name", "role", "stack", "builderTitle"],
  safeArea: { x: 0.08, y: 0.05, w: 0.84, h: 0.9 },
  layers: [
    { kind: "fill", color: brand.color.primary },
    { kind: "custom", id: "sun-rays" }, // top-right
    { kind: "image", src: "/branding/wordmark.png", rect: { x: 0.08, y: 0.05, w: 0.5, h: 0.055 } },
    {
      kind: "photo",
      rect: { x: 0.16, y: 0.155, w: 0.68, h: 0.51 },
      radius: 0.04,
      ring: { width: 0.008, color: brand.color.accent },
    },
    {
      kind: "text",
      box: { x: 0.08, y: 0.715, w: 0.84, h: 0.075 },
      token: "name",
      font: "display",
      size: 0.058,
      minSize: 0.036,
      color: brand.color.accent,
      align: "center",
      transform: "upper",
      maxLines: 1,
    }, // + offset shadow
    {
      kind: "text",
      box: { x: 0.08, y: 0.8, w: 0.84, h: 0.045 },
      token: "role",
      font: "body",
      size: 0.028,
      minSize: 0.02,
      color: brand.color.offwhite,
      align: "center",
      maxLines: 1,
    },
    {
      kind: "text",
      box: { x: 0.08, y: 0.85, w: 0.84, h: 0.04 },
      token: "stack",
      font: "body",
      size: 0.023,
      minSize: 0.017,
      color: brand.color.pink,
      align: "center",
      transform: "upper",
      maxLines: 1,
    },
    {
      kind: "text",
      box: { x: 0.08, y: 0.9, w: 0.84, h: 0.05 },
      token: "builderTitle",
      font: "display",
      size: 0.036,
      minSize: 0.025,
      color: brand.color.pink,
      align: "center",
      transform: "upper",
      maxLines: 1,
      letterSpacing: 0.004,
    },
    { kind: "image", src: "/branding/flowers.png", rect: { x: 0, y: 0.945, w: 1, h: 0.055 } },
    {
      kind: "text",
      box: { x: 0.08, y: 0.955, w: 0.84, h: 0.03 },
      token: "#FrameInGoa",
      font: "body",
      size: 0.02,
      color: brand.color.offwhite,
      align: "center",
    },
  ],
};
```

Notes:

- **Green ground with light type**, not a cream card. hhgoa.com is overwhelmingly green-ground; inverting it would read as a different brand. Cream stays as the muted body-text colour, matching site usage.
- Because both formats share the green ground, they are differentiated by **composition** — square/frame-led vs. portrait/type-led — not by flipping the palette.
- `token` is either a `Fields` key (resolved from user input) or a literal string (`'#FrameInGoa'`).
- Every text layer declares `minSize`, which is what makes overflow impossible ([T-014](tasks/T-014-text-layout-engine.md)).
- The `name` layer should carry the black offset shadow from `brand.shadow.offset` — that treatment is the site's most recognisable typographic move.
- **Imbue is very high-contrast.** Check the export at thumbnail size; its hairlines can vanish when downsampled.

Task: [T-016](tasks/T-016-format-b-builder-card.md)

---

## Template registry

```ts
// lib/templates/index.ts
import { pfpFrame } from "./pfp-frame";
import { builderCard } from "./builder-card";

export const templates = { "pfp-frame": pfpFrame, "builder-card": builderCard } as const;
export type TemplateId = keyof typeof templates;
export const defaultTemplateId: TemplateId = "pfp-frame";
```

Adding a third design — a story-format variant, a speaker badge, a "see you in Goa" card — becomes a new file plus one registry line. No engine change. That is the acceptance test for whether ADR-003 actually worked.

## Asset preparation rules

Owned by [T-003](tasks/T-003-brand-asset-intake.md).

| Asset type     | Rule                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame overlays | Export at 2× the template's native size (2160 px), PNG-24 with alpha, then run through `oxipng`/`svgo`. Target < 150 KB each.                                               |
| Logo           | Prefer SVG. Note: SVG drawn to canvas needs an `<img>` load first and Safari can be fussy about unsized SVGs — always set explicit `width`/`height` attributes in the file. |
| Patterns       | SVG if geometric; a tiling PNG if textural. Draw with `createPattern` rather than one giant bitmap.                                                                         |
| Fonts          | Subset to Latin + digits + punctuation with `glyphhanger`/`fonttools`. A display face for a card usually subsets to under 25 KB.                                            |
| Grain / noise  | Generate procedurally in a `custom` layer — cheaper than shipping a noise PNG and it never tiles visibly.                                                                   |
| Everything     | Under `public/branding/`, with a `MANIFEST.md` recording source, version, and licence.                                                                                      |

## Licensing note

Before self-hosting a typeface as WOFF2, confirm the licence permits web embedding. If the brand face is licensed desktop-only, either obtain a web licence or substitute a metric-similar open alternative and flag it. Tracked as [Q-3](11-open-questions.md).
