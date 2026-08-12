# T-002 — Design tokens, Tailwind theme & UI primitives

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 0 — Foundation                        |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 2.5 h                                 |
| **Depends on** | [T-001](T-001-scaffold-nextjs-app.md) |
| **Blocks**     | T-004, T-005, T-026                   |
| **Satisfies**  | NFR-2.3, NFR-2.4                      |

## Why this exists

Two consumers need the same brand values: the HTML/Tailwind UI chrome, and the canvas renderer that draws the artwork. If they read from different places, the website's orange and the exported PNG's orange will drift apart — and nobody notices until a designer puts them side by side.

One TypeScript object, consumed by both. This is also what makes the real brand kit a values swap rather than a refactor when [T-003](T-003-brand-asset-intake.md) resolves.

## Scope

**In:** `lib/brand/tokens.ts`, Tailwind theme wired to it, CSS variables for runtime use, font registration (`next/font/local` for the DOM + `FontFace` for canvas), the handful of shadcn primitives we actually need.

**Out:** the actual brand values ([T-003](T-003-brand-asset-intake.md)), template specs ([T-004](T-004-template-spec-and-registry.md)), page layout ([T-026](T-026-landing-and-format-selector.md)).

## Implementation notes

### Tokens

```ts
// lib/brand/tokens.ts  — REAL values from hhgoa.com (doc 13)
export const brand = {
  color: {
    primary: "#0B6839",
    accent: "#FEE101",
    pink: "#FF0080",
    offwhite: "#FFFBE8",
    white: "#FFFFFF",
    black: "#000000",
  },
  font: {
    display: { family: "Imbue", weight: 400, file: "/branding/fonts/display.woff2" },
    body: { family: "Victor Mono", weight: 500, file: "/branding/fonts/body.woff2" },
  },
  shadow: { offset: { dx: 0.004, dy: 0.004, color: "#000000" } },
  radius: { photo: 0.04, ui: "0.625rem" },
  isPlaceholder: false,
} as const;
```

Both faces are Google Fonts under SIL OFL — self-hosting a subset is permitted.

### Tailwind reads the same object

```ts
// tailwind.config.ts
import { brand } from "./lib/brand/tokens";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: brand.color,
      borderRadius: { ui: brand.radius.ui },
      fontFamily: {
        display: [brand.font.display.family, "system-ui", "sans-serif"],
        body: [brand.font.body.family, "system-ui", "sans-serif"],
      },
    },
  },
} satisfies import("tailwindcss").Config;
```

Now `bg-primary` in JSX and `brand.color.primary` in a template spec are provably the same value. Divergence becomes impossible rather than merely discouraged.

### Fonts — two registrations, one source

The DOM and the canvas load fonts through different mechanisms. Both are required.

```ts
// lib/render/fonts.ts
import { brand } from "@/lib/brand/tokens";

let loaded: Promise<void> | null = null;

/** Registers brand faces for canvas use. Idempotent; safe to await repeatedly. */
export function ensureFonts(scope: { fonts: FontFaceSet } = self as never): Promise<void> {
  loaded ??= (async () => {
    const faces = Object.values(brand.font).map((f) => {
      const face = new FontFace(f.family, `url(${f.file}) format('woff2')`, {
        weight: String(f.weight),
      });
      scope.fonts.add(face);
      return face.load();
    });
    await Promise.all(faces);
  })();
  return loaded;
}
```

Works in both window and worker scope, because `FontFaceSet` exists on `self` in both. Every text draw awaits this — see [T-014](T-014-text-layout-engine.md), where forgetting it is the single most common canvas-text bug.

For the DOM side, use `next/font/local` pointed at the same WOFF2 files so there is exactly one copy of each font on disk.

### CSS variables

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --ink: #0b0b0f;
  --surface: #fffdf7;
  --primary: #ff5a1f;
  --accent: #00a98f;
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The reduced-motion block goes in now rather than in [T-030](T-030-accessibility-pass.md) — it is one rule, and retrofitting motion preferences is far more work than starting with them.

### UI primitives — take only these

```bash
npx shadcn@latest add button slider input label tabs toast
```

Six components. Resist adding more; every unused primitive is bundle weight and a styling surface to keep on-brand. Check each one's colours against the tokens after adding — shadcn ships with its own palette that must be replaced, not layered over.

## Acceptance criteria

- [ ] `lib/brand/tokens.ts` is the only place brand values are literal
- [ ] Tailwind classes `bg-primary`, `text-ink`, `font-display` all work
- [ ] `ensureFonts()` resolves in the browser and inside a worker
- [ ] Canvas text drawn after `await ensureFonts()` uses the brand face, not a fallback — verified visually, not assumed
- [ ] The six shadcn primitives render with brand colours, not shadcn defaults
- [ ] `prefers-reduced-motion` is honoured globally
- [ ] Buttons are full-radius pills in `#FF0080`, matching the site's CTA treatment
- [ ] No hardcoded hex values anywhere outside `tokens.ts` and `globals.css`

## Files touched

```
lib/brand/tokens.ts
lib/render/fonts.ts
tailwind.config.ts
app/globals.css
app/layout.tsx
components/ui/{button,slider,input,label,tabs,toast}.tsx
```

## How to test

Render a scratch page with a swatch for every token and a paragraph in each face, plus a small canvas drawing the same two strings. Screenshot it. Any mismatch between the DOM text and the canvas text means the font registration is wrong — which is exactly the failure this task exists to prevent, and it is invisible until you look.

## Gotchas

- **Canvas does not wait for fonts.** Drawing text before the face has loaded silently uses a fallback. No error, no warning — just subtly wrong output. Always `await ensureFonts()`.
- **`document.fonts.ready` is not enough.** It resolves when _currently pending_ loads settle. A font never referenced by any DOM node was never pending. You must explicitly `add()` and `load()` the face, as above.
- **Two font copies is a real trap.** If `next/font/local` and the `FontFace` URL point at different files, the DOM and canvas will use different builds of the same face and the metrics will differ slightly.
- **shadcn colours are not your colours.** The generated components carry their own palette; overwrite it or your buttons will be off-brand in a way that is hard to see and easy to ship.
- **Keep `radius.photo` unitless.** It is a fraction of the canvas, per [06](../06-brand-and-templates.md). A `rem` value there breaks resolution independence.

## References

- [13 — Brand Identity](../13-brand-identity.md)
- [06 — Brand & Templates](../06-brand-and-templates.md#design-tokens)
- [MDN: FontFace](https://developer.mozilla.org/en-US/docs/Web/API/FontFace)
