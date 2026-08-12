# T-014 — Font loading + text layout engine

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 3 — Render engine                      |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 3.5 h                                  |
| **Depends on** | [T-013](T-013-canvas-renderer-core.md) |
| **Blocks**     | T-016, T-018                           |
| **Satisfies**  | FR-3.4, NFR-2.4                        |

## Why this exists

Two problems that both silently ruin the output.

**Fonts:** canvas does not wait for a webfont. Draw text before the face has loaded and it renders in a fallback — no error, no warning, just subtly off-brand output that you will not notice unless you compare against the design.

**Overflow:** "Hitesh Solanki" fits the card. "Dr. Venkataraghavan Subramanian" does not. Someone will paste a 90-character name, and the card must still look designed.

## Scope

**In:** deterministic font loading, `measureText`-based fitting, the shrink → wrap → ellipsize chain, letter spacing, vertical centring in the box.

**Out:** the form inputs ([T-018](T-018-builder-form.md)), template composition ([T-016](T-016-format-b-builder-card.md)).

## Implementation notes

### Font loading — the part everyone gets wrong

```ts
// lib/render/fonts.ts
let ready: Promise<void> | null = null;

export function ensureFonts(scope: { fonts: FontFaceSet } = self as never) {
  ready ??= (async () => {
    await Promise.all(
      Object.values(brand.font).map(async (f) => {
        const face = new FontFace(f.family, `url(${f.file}) format('woff2')`, {
          weight: String(f.weight),
        });
        scope.fonts.add(face);
        await face.load();
      }),
    );
  })();
  return ready;
}
```

Why not `document.fonts.ready`: it resolves when _currently pending_ loads settle. A face that no DOM node references was never pending, so `ready` resolves immediately and the font is still absent. You must explicitly `add()` and `load()`.

Belt and braces — a timeout so a font CDN hiccup cannot hang the render:

```ts
await Promise.race([ensureFonts(), new Promise((r) => setTimeout(r, 3000))]);
```

Rendering in a fallback face is bad; rendering nothing is worse.

### The layout chain

```
   text + box + {size, minSize, maxLines}
        │
   1 ── try at `size`, one line ─────────── fits? ► draw
        │
   2 ── binary-search font size down to `minSize` ── fits? ► draw
        │
   3 ── wrap into up to `maxLines` at `minSize` ─── fits? ► draw
        │
   4 ── truncate the last line with "…" ─────────► draw
```

Never skip step 4 in favour of `overflow: hidden` behaviour — a name cut mid-glyph looks like a bug, while an ellipsis looks like a decision.

```ts
// lib/render/text.ts
export function layoutText(
  ctx: Ctx,
  text: string,
  box: { w: number; h: number },
  o: {
    family: string;
    weight: number;
    maxPx: number;
    minPx: number;
    maxLines: number;
    letterSpacing?: number;
  },
): { lines: string[]; fontPx: number; lineHeight: number } {
  const setFont = (px: number) => {
    ctx.font = `${o.weight} ${px}px "${o.family}"`;
  };
  const widthOf = (s: string) => {
    const w = ctx.measureText(s).width;
    return o.letterSpacing ? w + o.letterSpacing * Math.max(0, s.length - 1) : w;
  };

  // 1 + 2: binary search the largest size that fits on one line.
  let lo = o.minPx,
    hi = o.maxPx,
    best = o.minPx;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    setFont(mid);
    if (widthOf(text) <= box.w) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  setFont(best);
  if (widthOf(text) <= box.w) {
    return { lines: [text], fontPx: best, lineHeight: best * 1.15 };
  }

  // 3: wrap at minPx.
  setFont(o.minPx);
  const lines = wrapWords(text, box.w, widthOf, o.maxLines);

  // 4: ellipsize the final line if content remains.
  const lh = o.minPx * 1.15;
  if (lines.length > o.maxLines || lines.length * lh > box.h) {
    lines.length = Math.max(1, Math.min(o.maxLines, Math.floor(box.h / lh)));
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1]!, box.w, widthOf);
  }
  return { lines, fontPx: o.minPx, lineHeight: lh };
}
```

Binary search rather than a 1 px-at-a-time loop: `measureText` is not free, and this runs on every keystroke in [T-018](T-018-builder-form.md). ~7 iterations instead of ~40.

### Word wrapping, including the unbreakable case

```ts
function wrapWords(
  text: string,
  maxW: number,
  widthOf: (s: string) => number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (widthOf(test) <= maxW) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    // A single word longer than the box must be broken by character.
    if (widthOf(word) > maxW) {
      let chunk = "";
      for (const ch of word) {
        if (widthOf(chunk + ch) > maxW) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    } else line = word;
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}
```

Iterating with `for…of` over the string (rather than by index) keeps surrogate pairs intact, so an emoji does not get split into two broken halves.

### Drawing

```ts
function drawText(ctx: Ctx, layer: TextLayer, fields: Fields, px: PxFn, W: number, H: number) {
  const raw = resolveToken(layer.token, fields);
  if (!raw) return; // empty field draws nothing
  const text = layer.transform === "upper" ? raw.toUpperCase() : raw;

  const box = { w: px(layer.box.w), h: px(layer.box.h, "y") };
  const { lines, fontPx, lineHeight } = layoutText(ctx, text, box, {
    family: brand.font[layer.font].family,
    weight: brand.font[layer.font].weight,
    maxPx: px(layer.size, "y"),
    minPx: px(layer.minSize ?? layer.size, "y"),
    maxLines: layer.maxLines ?? 1,
    letterSpacing: layer.letterSpacing ? px(layer.letterSpacing) : 0,
  });

  ctx.save();
  ctx.font = `${brand.font[layer.font].weight} ${fontPx}px "${brand.font[layer.font].family}"`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";

  const anchorX =
    layer.align === "left"
      ? px(layer.box.x)
      : layer.align === "right"
        ? px(layer.box.x) + box.w
        : px(layer.box.x) + box.w / 2;

  // Vertically centre the block within the box.
  const blockH = lines.length * lineHeight;
  let y = px(layer.box.y, "y") + (box.h - blockH) / 2 + lineHeight / 2;

  for (const line of lines) {
    if (layer.letterSpacing)
      drawSpaced(ctx, line, anchorX, y, px(layer.letterSpacing), layer.align);
    else ctx.fillText(line, anchorX, y);
    y += lineHeight;
  }
  ctx.restore();
}
```

### Letter spacing

`ctx.letterSpacing` exists in Chrome but not reliably in Safari, so draw glyph by glyph when spacing is requested. Only needed for the display-face title layer, so the cost is negligible.

## Acceptance criteria

- [ ] Canvas text renders in the **brand** face, verified against the design reference by screenshot
- [ ] A font-load failure falls back gracefully within 3 s and still renders text
- [ ] `ensureFonts()` works in worker scope
- [ ] A 12-character name renders at full `size`
- [ ] A 40-character name shrinks toward `minSize`
- [ ] A 90-character name shrinks, wraps, then ellipsizes — and **never** exits the box
- [ ] A single 60-character word breaks by character rather than overflowing
- [ ] Emoji do not split into broken halves
- [ ] An empty field draws nothing (no stray ellipsis, no placeholder artefact)
- [ ] Text is vertically centred in its box at every line count
- [ ] `align: left | center | right` all anchor correctly
- [ ] Letter spacing renders identically in Chrome and Safari
- [ ] Layout at `outputScale: 2` is proportionally identical to `1`
- [ ] Layout completes in under 5 ms for a full card (so per-keystroke re-render stays live)

## Files touched

```
lib/render/text.ts
lib/render/fonts.ts
tests/unit/text.test.ts
```

## How to test

```ts
// tests/unit/text.test.ts — with a measureText stub: width = chars × 0.5 × fontPx
const cases = [
  ["Hitesh", 1, "full size"],
  ["Dr. Venkataraghavan Subramanian", 1, "shrinks"],
  ["A".repeat(90), 2, "wraps then ellipsizes"],
  ["Supercalifragilisticexpialidocious".repeat(2), 2, "breaks a long word"],
  ["", 0, "draws nothing"],
];
```

A linear stub is enough to test the algorithm; real metrics are covered by the visual regression suite in [T-029](T-029-cross-device-qa.md).

Visually, add a dev page that renders the card with a length ladder — 5, 10, 20, 40, 60, 90 characters — as one image. That single screenshot answers "does text ever break the design" in a glance, and it is worth keeping permanently.

## Gotchas

- **`document.fonts.ready` is not sufficient.** Explained above. This is the bug that ships off-brand output silently, so it is worth re-reading the reason.
- **Set `ctx.font` _before_ `measureText`.** Measuring with the previous font and drawing with the new one produces a layout that is wrong by exactly the ratio between them.
- **`measureText` is affected by `ctx.font` only** — not by `textAlign` or `letterSpacing` in all browsers. Add spacing manually, as above.
- **`textBaseline` defaults to `'alphabetic'`**, which makes vertical centring maths surprisingly wrong. Use `'middle'` and centre the block explicitly.
- **Font sizes are fractions of canvas _height_** (see [T-004](T-004-template-spec-and-registry.md)). Using width makes type scale wrongly on the 4:5 card.
- **`toUpperCase()` changes width.** Apply the transform _before_ measuring, not after.
- **Quote the family name in `ctx.font`.** `800 42px HHGoaDisplay` fails if the name has a space; `800 42px "HHGoa Display"` works. Always quote.
- **Emoji in a subset font render as tofu.** The brand subset will not include emoji, so the platform fallback handles them — which means an emoji in a name may render in a different face. Acceptable, but do not be surprised.
- **RTL and complex scripts** are not handled by this engine. Out of scope per [Q-15](../11-open-questions.md), but if a name in Devanagari or Arabic arrives, it will render with the platform fallback and may shape incorrectly. Note it rather than pretending otherwise.

## References

- [06 — Brand & Templates](../06-brand-and-templates.md#format-b--builder-card)
- [MDN: FontFace](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
