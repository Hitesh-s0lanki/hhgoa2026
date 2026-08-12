# T-030 — Accessibility pass

|                |                                                                                       |
| -------------- | ------------------------------------------------------------------------------------- |
| **Phase**      | 6 — Ship                                                                              |
| **Status**     | ☐ Not started                                                                         |
| **Estimate**   | 2 h                                                                                   |
| **Depends on** | [T-026](T-026-landing-and-format-selector.md), [T-027](T-027-states-loading-error.md) |
| **Blocks**     | —                                                                                     |
| **Satisfies**  | FR-6.5                                                                                |

## Why this exists

An event tool should work for everyone attending the event. The app is small enough that full keyboard and screen reader support is a couple of hours of work rather than a project — which makes skipping it a choice, not a constraint.

There is also a specific dependency: the face detector in [T-011](T-011-smart-subject-positioning.md) performs unevenly across faces. The manual crop control ([T-012](T-012-manual-crop-control.md)) being fully keyboard-operable is what keeps that acceptable.

## Scope

**In:** keyboard operability, focus management, semantic markup, labels, live regions, contrast, reduced motion, the canvas alt-text problem.

**Out:** the components themselves (each task owns its own a11y; this is the audit and the fixes).

## The checklist

### Keyboard

- [ ] The entire flow — land, upload, adjust, fill in, download, share — works keyboard-only
- [ ] Tab order follows visual order
- [ ] Every interactive element has a visible focus ring (never `outline: none` without a replacement)
- [ ] The upload zone activates on Enter **and** Space
- [ ] The crop control pans with arrows and zooms with `+`/`−` ([T-012](T-012-manual-crop-control.md))
- [ ] No keyboard trap anywhere
- [ ] Focus moves to the error notice when an error appears
- [ ] Focus returns somewhere sensible after the share sheet closes

### Semantics

- [ ] One `<h1>`; heading levels do not skip
- [ ] The format selector is a radio group with arrow-key navigation
- [ ] Every form input has a `<label htmlFor>` — a placeholder is not a label
- [ ] Buttons are `<button>`; links are `<a>`; never a `<div onClick>`
- [ ] The upload zone has `role="button"` and an `aria-label` naming the accepted formats
- [ ] Decorative images have `alt=""`; the sample previews are decorative
- [ ] Icon-only buttons (reroll) have an `aria-label`

### Announcements

- [ ] Errors use `role="alert"` (assertive)
- [ ] Status changes use `aria-live="polite"`
- [ ] The live region exists in the DOM **before** its content changes
- [ ] Announcements fire once, not on every re-render
- [ ] Disabled buttons explain why via `aria-describedby`

### Contrast & visual

- [ ] Body text ≥ 4.5:1 against its background
- [ ] Large text ≥ 3:1
- [ ] Focus indicators ≥ 3:1 against adjacent colours
- [ ] Nothing depends on colour alone (the selected format shows a ring, not just a tint)
- [ ] Usable at 200% browser zoom
- [ ] Inputs are ≥ 16 px so iOS does not zoom on focus
- [ ] Touch targets ≥ 44 × 44 px

### Motion

- [ ] `prefers-reduced-motion` disables the preview fade, the crop animation ([T-011](T-011-smart-subject-positioning.md)), and the skeleton shimmer
- [ ] No auto-playing or looping animation anywhere

## The canvas problem

A `<canvas>` is opaque to assistive technology. It needs a meaningful text alternative that updates as the content does:

```tsx
<canvas
  role="img"
  aria-label={describePreview(templateId, fields, !!image)}
  className="block h-full w-full"
/>
```

```ts
// lib/a11y.ts
export function describePreview(templateId: TemplateId, fields: Fields, hasPhoto: boolean) {
  if (!hasPhoto) return "Preview. Upload a photo to see your HH Goa 2026 graphic.";
  const label = templates[templateId].label;
  const who = fields.name ? ` for ${fields.name}` : "";
  const title = fields.builderTitle ? `, titled ${fields.builderTitle}` : "";
  return `${label} preview${who}${title}, with your photo inside the HH Goa 2026 design.`;
}
```

This is a genuine limitation stated honestly: a blind user cannot evaluate whether the crop looks good. What they _can_ do is know the graphic was created, know what it contains, and download and post it — which is the actual task. Describing the structure is useful; pretending to describe the aesthetics is not.

## Focus management on error

```tsx
useEffect(() => {
  if (status === "error") errorRef.current?.focus();
}, [status]);
```

With `tabIndex={-1}` on the error container. Without this, a keyboard user tabs into a form whose state changed for reasons they were never told.

## Reduced motion

Set globally in [T-002](T-002-design-tokens-and-ui.md):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

JS-driven animation needs its own check — the CSS rule does not reach it:

```ts
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) {
  applyTransform(next);
  return;
} // jump, don't tween
```

## Tooling

```bash
npx @axe-core/cli https://hhgoa.app
npx lighthouse https://hhgoa.app --only-categories=accessibility
```

Automated tools catch roughly a third of real issues — missing labels, contrast, bad roles. They cannot tell you whether the flow is _usable_. Both matter, and only one of them can be automated.

## Manual verification

The part that actually finds problems:

| Tool          | Platform                       | Test                                            |
| ------------- | ------------------------------ | ----------------------------------------------- |
| VoiceOver     | macOS (⌘F5)                    | Navigate the whole flow with the rotor          |
| VoiceOver     | iOS (triple-click side button) | Upload and download using swipe gestures only   |
| TalkBack      | Android                        | Same                                            |
| NVDA          | Windows                        | Desktop flow                                    |
| Keyboard only | any                            | Unplug the mouse and complete a card end to end |

The keyboard-only run is the highest-value five minutes in this task. Unplug the mouse, complete the whole flow, and every gap becomes obvious immediately.

## Acceptance criteria

- [ ] Every checklist item above passes
- [ ] axe-core reports zero critical or serious violations
- [ ] Lighthouse accessibility ≥ 95
- [ ] The full flow is completable keyboard-only
- [ ] The full flow is completable with VoiceOver on iOS
- [ ] The canvas has a meaningful, updating `aria-label`
- [ ] Focus moves to errors when they appear
- [ ] `prefers-reduced-motion` is honoured in both CSS and JS animation
- [ ] Touch targets ≥ 44 px
- [ ] Contrast verified with a tool, not by eye
- [ ] Inputs ≥ 16 px (no iOS zoom-on-focus)
- [ ] Usable at 200% zoom

## Files touched

```
lib/a11y.ts
components/editor/PreviewCanvas.tsx
components/editor/CropControl.tsx
components/FormatSelector.tsx
components/states/ErrorNotice.tsx
app/globals.css
```

## How to test

Do the keyboard-only run first — it is fast and it finds the most. Then VoiceOver on iOS, which is the platform most of our users are on and where the gesture-based navigation exposes different problems than a desktop screen reader.

Verify contrast with a checker against the actual rendered colours, not the token values — an opacity modifier or an overlay can push a compliant pair below threshold.

## Gotchas

- **`outline: none` without a replacement is the most common a11y regression**, and Tailwind's `focus:outline-none` makes it a one-word mistake. Always pair it with a `focus-visible:ring`.
- **Placeholders are not labels.** Both are needed ([T-018](T-018-builder-form.md)).
- **A live region added at the same time as its content announces nothing.** Render the empty region always.
- **`aria-live="assertive"` interrupts.** Use it for errors only; polite for everything else.
- **`role="application"` on the crop control** is correct — it lets arrow keys through to the widget — but it also suppresses the screen reader's normal navigation, so the `aria-label` must fully explain the controls.
- **Disabled buttons are invisible to some screen readers' focus order.** Prefer `aria-disabled` with an explanation over a bare `disabled` when the reason matters.
- **iOS zooms on any input under 16 px.** It looks like a layout bug and it is a font-size bug.
- **Automated tools pass sites that are unusable.** A green axe report on a flow nobody can complete is the failure mode to watch for.
- **Do not overclaim in the canvas label.** Describing the structure is honest; implying the user can assess the composition is not.

## References

- [02 — Requirements, FR-6.5](../02-requirements.md#fr-6--shell--ux)
- [12 — QA, section F](../12-qa-and-testing.md#f--accessibility-t-030)
