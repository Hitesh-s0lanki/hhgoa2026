# T-016 — Format B: Builder ID card template

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Phase**      | 3 — Render engine                                                                      |
| **Status**     | ☐ Not started                                                                          |
| **Estimate**   | 3.5 h                                                                                  |
| **Depends on** | [T-014](T-014-text-layout-engine.md), [T-003](T-003-brand-asset-intake.md)             |
| **Blocks**     | T-018                                                                                  |
| **Satisfies**  | FR-3.3                                                                                 |
| **Droppable**  | Yes, with [T-018](T-018-builder-form.md) — a polished Format A beats two rough formats |

> **Updated 8 Aug 2026** ([13](../13-brand-identity.md)): the card is **green-ground with light type**, not cream with dark type — hhgoa.com is overwhelmingly green. Also note the brief says _pick one format_, so this is optional; see [14](../14-official-brief.md).

## Why this exists

The more impressive of the two formats: a card carrying the person's identity alongside their photo. It is also the **acceptance test for ADR-003** — if this can be built without touching the renderer or `types.ts`, the template-as-data abstraction earned its keep.

## Scope

**In:** the `builder-card` spec, the typographic hierarchy, safe-area behaviour, placeholder text for empty fields.

**Out:** the form ([T-018](T-018-builder-form.md)), the title generator ([T-017](T-017-builder-title-generator.md)), text layout ([T-014](T-014-text-layout-engine.md)).

## Composition

```
   1080 × 1350  (4:5 — the tallest ratio X displays without cropping)
   ┌─────────────────────────────────┐
   │ HH GOA 2026              ◢◤     │  y 0.05   lockup, reserved band
   │                                 │
   │      ┌───────────────────┐      │  y 0.14   photo slot 0.68 × 0.545
   │      │                   │      │           (deliberately not full width)
   │      │       PHOTO       │      │
   │      │                   │      │
   │      └───────────────────┘      │  y 0.685
   │                                 │
   │        HITESH SOLANKI           │  y 0.73   display, upper, 1 line
   │        Software Engineer        │  y 0.805  body
   │        Next.js · TS · AWS       │  y 0.855  body, accent colour
   │      ─────────────────          │
   │       AI PRODUCT BUILDER        │  y 0.905  display, accent, tracked
   │                                 │
   │          #FrameInGoa            │  y 0.955  literal
   └─────────────────────────────────┘
```

### Why 4:5

1080 × 1350 is the tallest aspect X shows uncropped in a timeline, so the card is fully visible without a tap. It is also Instagram's portrait post ratio, which is where a lot of these will actually be shared.

## Implementation notes

Full spec in [06 — Brand & Templates](../06-brand-and-templates.md#format-b--builder-card). The decisions behind it:

### Typographic hierarchy

| Element       | Face            | Size (of H) | Min   | Colour                   | Transform       |
| ------------- | --------------- | ----------- | ----- | ------------------------ | --------------- |
| Name          | **Imbue**       | 0.058       | 0.036 | `#FEE101` + black offset | upper           |
| Role          | **Victor Mono** | 0.028       | 0.020 | `#FFFBE8`                | —               |
| Stack         | Victor Mono     | 0.023       | 0.017 | `#FF0080`                | upper           |
| Builder title | Imbue           | 0.036       | 0.025 | `#FF0080`                | upper + tracked |
| Hashtag       | Victor Mono     | 0.020       | —     | `#FFFBE8`                | —               |

Four distinct sizes and two faces is enough hierarchy. A fifth level makes the card busy, and at this physical size the difference stops reading.

Note every user-supplied layer has a `minSize` — that is what makes overflow structurally impossible ([T-014](T-014-text-layout-engine.md)).

### Placeholder text

The preview must never look broken while someone is typing:

```ts
const PLACEHOLDERS: Record<string, string> = {
  name: "YOUR NAME",
  role: "Your role",
  stack: "Your stack",
  builderTitle: "BUILDER",
};

// In resolveToken: fall back to the placeholder, drawn at reduced opacity.
```

Drawn at ~35% opacity so it clearly reads as a prompt rather than as content. Without this, the card is a photo floating above empty space and the user cannot tell what the layout will be.

### Safe area

```ts
safeArea: { x: 0.08, y: 0.05, w: 0.84, h: 0.90 }
```

Nothing meaningful outside it. Two reasons: platforms occasionally apply their own crop, and a card whose content runs to the edge looks cramped when it appears as a small timeline thumbnail. The dev-time validator ([T-004](T-004-template-spec-and-registry.md)) can flag text layers that stray outside.

### The divider

```ts
{ kind: 'custom', id: 'title-divider' }
```

A short centred rule above the builder title, drawn as a `custom` layer because it is a positioned primitive rather than an asset. Small, contained, and exactly the kind of thing the escape hatch exists for.

Alternative worth considering: express it as a `fill` layer with a thin rect. If that works, prefer it — one less piece of brand logic in code.

### Green ground, light type

Both formats sit on `#0B6839`. hhgoa.com is overwhelmingly green-ground, and a cream card would read as a different brand — so differentiate the two formats by **composition** (square/frame-led vs. portrait/type-led), not by inverting the palette.

The photo therefore needs a `#FEE101` ring to separate it from the green, exactly as in Format A. Cream (`#FFFBE8`) stays as the muted body-text colour, matching site usage.

### The black offset shadow

The site's most recognisable typographic move is a hard black offset behind yellow display type (see `Hacker house.png`). Reproduce it on the name layer — two `fillText` calls:

```ts
const d = brand.shadow.offset;
ctx.fillStyle = d.color;
ctx.fillText(line, x + px(d.dx), y + px(d.dy, "y"));
ctx.fillStyle = layer.color;
ctx.fillText(line, x, y);
```

A soft `shadowBlur` would be wrong — the site's shadow is hard-edged with no blur.

## Acceptance criteria

- [ ] Renders at 1080 × 1350 and, at `outputScale: 2`, at 2160 × 2700
- [ ] Built **without changes** to `lib/render/**` or `lib/templates/types.ts` (the ADR-003 test)
- [ ] All four text layers render with correct hierarchy and colours
- [ ] Placeholder text appears for empty fields at reduced opacity
- [ ] A 90-character name shrinks, wraps, then ellipsizes — never leaves its box
- [ ] Every text layer stays inside `safeArea`
- [ ] The photo slot handles all aspect ratios without distortion
- [ ] The photo is separated from the green ground by the `#FEE101` ring
- [ ] The name layer carries the hard black offset shadow (no blur)
- [ ] The wordmark does not collide with photo content at any photo aspect
- [ ] Legible as a timeline thumbnail — check at 300 px wide
- [ ] Renders in under 400 ms at scale 1 on a mid-range phone
- [ ] Placeholders and real values both render at both scales identically in proportion

## Files touched

```
lib/templates/builder-card.ts
lib/templates/custom/divider.ts     (only if a fill layer cannot do it)
lib/templates/index.ts
public/branding/wordmark.png
public/branding/flowers.png
```

## How to test

Render a matrix: 3 photo aspects × 4 text-length ladders (short / medium / long / absurd), as one contact sheet. Every cell must be a card you would post.

Then check the thumbnail case — scale the output to 300 px wide and confirm the name is still readable. A card that only works at full size fails in the place it will most often be seen.

## Gotchas

- **If you find yourself editing the renderer for this template, stop.** Either extend the `Layer` union declaratively ([T-004](T-004-template-spec-and-registry.md)) or use a `custom` layer. A special case in `render()` for one template is the beginning of the end for the abstraction.
- **Text `size` is a fraction of canvas _height_.** On a 4:5 card, using width makes everything ~25% too small — and it will look almost right, which is worse than obviously wrong.
- **`toUpperCase()` before measuring.** Caps are wider; measure the string you will actually draw.
- **A dark photo on the green ground needs the ring.** Without it the photo's edge disappears into the design.
- **Imbue is extremely high-contrast.** At `minSize` on a thumbnail its hairlines can vanish entirely. This is the specific risk this typeface introduces — check the 300 px case.
- **Long stack strings are the common overflow case.** "Next.js · TypeScript · PostgreSQL · AWS · Docker" is a realistic input. The 40-character limit in [T-018](T-018-builder-form.md) plus shrink-and-ellipsize handles it, but test it.
- **Vertical rhythm is easy to get subtly wrong.** The gaps between name / role / stack / title should be intentional, not whatever the y-values happened to produce. Set them from the design, and if there is no design, use a consistent multiple.
- **Placeholder opacity must not be mistaken for real text.** If a user exports with placeholders still showing, that is a UX failure — [T-018](T-018-builder-form.md) should require `name` before enabling download.

## References

- [13 — Brand Identity](../13-brand-identity.md)
- [06 — Brand & Templates, Format B](../06-brand-and-templates.md#format-b--builder-card)
- [04 — Architecture, ADR-003](../04-architecture.md#adr-003--templates-are-declarative-data-not-code)
