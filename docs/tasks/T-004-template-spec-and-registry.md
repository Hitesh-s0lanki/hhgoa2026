# T-004 — `TemplateSpec` type + registry skeleton

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Phase**      | 0 — Foundation                                                               |
| **Status**     | ☐ Not started                                                                |
| **Estimate**   | 2 h                                                                          |
| **Depends on** | [T-002](T-002-design-tokens-and-ui.md), [T-003](T-003-brand-asset-intake.md) |
| **Blocks**     | T-013, T-015, T-016                                                          |
| **Satisfies**  | NFR-2.3                                                                      |

## Why this exists

ADR-003: templates are data, one renderer is the code. This task defines that data contract. Getting it right makes Format B nearly free and lets a designer's change be a values edit; getting it wrong means the renderer grows a special case per template and the whole abstraction stops earning its keep.

Deliberately sequenced _after_ [T-003](T-003-brand-asset-intake.md) — designing a layout language before seeing the actual design is how you end up with a spec that cannot express it.

## Scope

**In:** `lib/templates/types.ts` (the full `Layer` union), the registry, the `custom` layer registry, and a zod schema that validates specs at dev time.

**Out:** the actual template compositions ([T-015](T-015-format-a-pfp-frame.md), [T-016](T-016-format-b-builder-card.md)) and the renderer that interprets them ([T-013](T-013-canvas-renderer-core.md)).

## Implementation notes

Full type listing is in [06 — Brand & Templates](../06-brand-and-templates.md#the-templatespec-contract). The design rules behind it:

### 1 · Every geometric value is normalized

```ts
export type Norm = number; // 0..1, fraction of canvas width (x/w) or height (y/h)
```

No pixels in a template, ever. This is what allows one spec to render identically at 540 px (preview) and 2160 px (export) — which is how FR-3.6 becomes structural rather than aspirational.

The one exception is `size: { w, h }`, the native export dimensions, which is by definition in pixels.

### 2 · Layers are ordered back to front

```ts
layers: Layer[]   // drawn in array order
```

An explicit array beats a z-index field: the order is visible by reading, and reordering is a cut-and-paste.

Critically, the `photo` layer sits _before_ the frame `image` layer, so the frame's inner edge overlaps the photo. That overlap is precisely what makes the result look integrated rather than pasted on ([06](../06-brand-and-templates.md#format-a--pfp-frame)).

### 3 · Text layers reference fields or literals

```ts
{ kind: 'text', token: 'name', ... }            // resolved from Fields
{ kind: 'text', token: '#FrameInGoa', ... }     // literal
```

Resolution rule: if `token` is a key of `Fields`, look it up; otherwise treat it as a literal string. Simple, and it means static copy needs no separate layer kind.

### 4 · Every text layer declares `minSize`

```ts
{ size: 0.052, minSize: 0.034 }   // fractions of canvas height
```

This is what makes overflow impossible. The layout engine shrinks within `[minSize, size]`, then wraps up to `maxLines`, then ellipsizes ([T-014](T-014-text-layout-engine.md)). A text layer without `minSize` is a card that will eventually break on somebody's long name.

### 5 · `custom` is the escape hatch, used sparingly

```ts
// lib/templates/custom/index.ts
type CustomDraw = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  spec: TemplateSpec,
  size: { w: number; h: number },
) => void;

export const customLayers: Record<string, CustomDraw> = {
  "sun-rays": drawSunRays, // the event's radiating sun — drawn, not shipped
};
```

Real brand designs contain one or two things a declarative spec will not anticipate — for HH Goa it is the radiating sun ([13](../13-brand-identity.md)). Rather than inflate the spec into a general graphics language, allow a named function.

Rule: try declaratively first. Each `custom` layer is brand logic living in code, and minimising that is the entire point of ADR-003.

### 6 · Validate specs at dev time

```ts
// lib/templates/validate.ts
const rect = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const templateSpecSchema = z.object({
  id: z.string(),
  label: z.string(),
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  layers: z.array(layerSchema).min(1),
  fields: z.array(z.enum(["name", "role", "stack", "builderTitle"])),
  safeArea: rect.optional(),
});

if (process.env.NODE_ENV !== "production") {
  for (const t of Object.values(templates)) {
    const r = templateSpecSchema.safeParse(t);
    if (!r.success) console.error(`[template:${t.id}]`, r.error.format());
  }
}
```

Catches the two mistakes you will actually make: a rect that runs off the canvas, and a text layer missing `minSize`. Dev-only, so it costs nothing in production.

### Registry

```ts
// lib/templates/index.ts
import { pfpFrame } from "./pfp-frame";
import { builderCard } from "./builder-card";

export const templates = { "pfp-frame": pfpFrame, "builder-card": builderCard } as const;
export type TemplateId = keyof typeof templates;
export const defaultTemplateId: TemplateId = "pfp-frame";

export const templateList = Object.values(templates); // for the format selector UI
```

`as const` gives you a `TemplateId` union derived from the registry, so an unknown id is a compile error rather than a blank canvas.

## Acceptance criteria

- [ ] `Layer` union covers fill, gradient, image, photo, text, custom
- [ ] Every geometric field is `Norm` (0..1); no pixel values outside `size`
- [ ] `TemplateId` is derived from the registry, not hand-maintained
- [ ] Both templates are registered (stubs are fine at this stage)
- [ ] `templateSpecSchema` validates all registered specs in dev and logs actionable errors
- [ ] A rect extending past the canvas edge is reported by the validator
- [ ] A text layer missing `minSize` is reported by the validator
- [ ] The `custom` registry resolves by id and no-ops safely on an unknown id
- [ ] `npm run typecheck` clean

## Files touched

```
lib/templates/types.ts
lib/templates/index.ts
lib/templates/validate.ts
lib/templates/custom/index.ts
lib/templates/pfp-frame.ts      (stub)
lib/templates/builder-card.ts   (stub)
lib/types.ts                    (Fields, Transform, RenderRequest)
```

## How to test

Unit test the validator against deliberately broken specs: a rect at `x: 1.2`, a `size` of zero, an empty layer array, a text layer without `minSize`. Each should fail with a message naming the template and the offending layer.

The real test of this task is [T-016](T-016-format-b-builder-card.md): if Format B can be expressed without touching `types.ts` or the renderer, the contract worked.

## Gotchas

- **Resist over-generalising.** This is not a design tool. Six layer kinds plus an escape hatch is the right size; a full expression language for computed positions is not.
- **Normalize against the right axis.** `w` and `x` are fractions of width; `h` and `y` of height. Text `size` is a fraction of **height** (so type scales with the card's vertical extent, which is what looks right). Document it at the type, because mixing them produces subtly wrong layouts that look almost fine.
- **Do not put colours in templates as literals.** Reference `brand.color.*`, or a palette change becomes a hunt through every spec.
- **`custom` layers cannot be validated.** They are opaque to the schema and to snapshot reasoning. Keep them few and small.
- **Don't add a `visible` or `enabled` flag.** Delete the layer instead. Conditional layers are the first step toward logic in templates.

## References

- [06 — Brand & Templates](../06-brand-and-templates.md#the-templatespec-contract)
- [04 — Architecture, ADR-003](../04-architecture.md#adr-003--templates-are-declarative-data-not-code)
