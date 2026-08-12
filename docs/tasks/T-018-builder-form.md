# T-018 — Builder form + validation

|                |                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| **Phase**      | 4 — Output                                                                         |
| **Status**     | ☐ Not started                                                                      |
| **Estimate**   | 2.5 h                                                                              |
| **Depends on** | [T-016](T-016-format-b-builder-card.md), [T-017](T-017-builder-title-generator.md) |
| **Blocks**     | —                                                                                  |
| **Satisfies**  | FR-3.4                                                                             |
| **Droppable**  | Yes, with [T-016](T-016-format-b-builder-card.md)                                  |

## Why this exists

Format B needs three short text inputs plus a derived title. The form is small, but it is the only place in the product where the user types, and it is where the preview must feel genuinely live — a card that updates as you type is delightful; one that updates on blur feels broken.

## Scope

**In:** the three inputs, the title field with reroll, length limits, debounced live preview, the download gate.

**Out:** the title rules ([T-017](T-017-builder-title-generator.md)), the card template ([T-016](T-016-format-b-builder-card.md)), the preview canvas ([T-021](T-021-live-preview-surface.md)).

## Implementation notes

### Schema

```ts
// lib/schema.ts
import { z } from "zod";

export const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Add your name").max(28, "Keep it under 28 characters"),
  role: z.string().trim().max(32).default(""),
  stack: z.string().trim().max(40).default(""),
  builderTitle: z.string().trim().max(24).default(""),
});

export type FieldsInput = z.input<typeof fieldsSchema>;
```

Limits are derived from the card, not invented: at each layer's `minSize`, these are the lengths that fit on one line without shrinking. Longer input still renders correctly thanks to [T-014](T-014-text-layout-engine.md) — the limit exists so the _typical_ card looks its best, not to prevent breakage.

| Field        | Max | Required     | Why that number                        |
| ------------ | --- | ------------ | -------------------------------------- |
| name         | 28  | yes          | Fits at display size without shrinking |
| role         | 32  | no           | One body line                          |
| stack        | 40  | no           | One body line at the smaller size      |
| builderTitle | 24  | no (derived) | Fits tracked caps on one line          |

Only `name` is required. Someone should be able to make a card with just a photo and a name.

### The form

```tsx
// components/editor/BuilderForm.tsx
export function BuilderForm() {
  const { fields, setField } = useStore();
  return (
    <div className="space-y-4">
      <Field
        id="name"
        label="Name"
        required
        value={fields.name ?? ""}
        maxLength={28}
        placeholder="Hitesh Solanki"
        onChange={(v) => setField("name", v)}
      />
      <Field
        id="role"
        label="Role"
        value={fields.role ?? ""}
        maxLength={32}
        placeholder="Software Engineer"
        onChange={(v) => setField("role", v)}
      />
      <Field
        id="stack"
        label="Stack"
        value={fields.stack ?? ""}
        maxLength={40}
        placeholder="Next.js · TypeScript · AWS"
        hint="Optional"
        onChange={(v) => setField("stack", v)}
      />
      <BuilderTitleField />
    </div>
  );
}
```

Every input needs a real `<label htmlFor>`. A placeholder is not a label — it disappears the moment someone types, and screen readers treat it inconsistently. This is the most common accessibility failure in small forms.

### The title field

```tsx
// components/editor/BuilderTitleField.tsx
export function BuilderTitleField() {
  const { fields, rerollIndex, rerollTitle, setField } = useStore();
  const derived = deriveTitle(fields.role ?? "", rerollIndex);
  const value = fields.titleIsManual ? (fields.builderTitle ?? "") : derived;

  return (
    <div>
      <Label htmlFor="title">Builder title</Label>
      <div className="flex gap-2">
        <Input
          id="title"
          value={value}
          maxLength={24}
          onChange={(e) => setField("builderTitle", e.target.value, { manual: true })}
        />
        <Button variant="ghost" onClick={rerollTitle} aria-label="Suggest another title">
          <RefreshIcon aria-hidden />
        </Button>
      </div>
      <p className="text-muted text-xs">
        {fields.titleIsManual ? "Your own title" : "Suggested from your role"}
      </p>
    </div>
  );
}
```

Editing sets `titleIsManual`, which stops derivation — otherwise typing a custom title would be overwritten the moment the user edits their role. The caption line tells them which mode they are in, which is worth the one line of copy.

Reroll should stay available after a manual edit (it clears `titleIsManual`), so an experiment is reversible.

### Live preview, debounced

```ts
const DEBOUNCE_MS = 80; // below perceptual threshold, above per-keystroke waste
```

80 ms is the sweet spot: it feels instantaneous, and it collapses a burst of typing into one render. Combined with the frame coalescing in [T-013](T-013-canvas-renderer-core.md), a fast typist produces a handful of renders instead of forty.

Do **not** debounce the store update — only the render. The input must stay perfectly responsive; it is the canvas that can lag by 80 ms.

### The download gate

```ts
const canExport = !!fields.name?.trim();
```

Disable download and share while `name` is empty, with a reason attached (`aria-describedby` pointing at "Add your name to download"). Exporting a card with `YOUR NAME` in placeholder grey is a UX failure that users will not notice until it is posted.

A disabled button with no explanation is its own failure — always pair the two.

### Sanitization

```ts
const clean = (s: string) =>
  s
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width space / joiner / BOM
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
```

Applied on change, not on submit, so the preview reflects what will actually render. Zero-width characters pasted from social profiles are surprisingly common and they break `measureText` in confusing ways — the string looks short and measures long.

## Acceptance criteria

- [ ] All four fields update the preview as the user types
- [ ] Preview updates feel instant (≤ 100 ms perceived)
- [ ] The input itself is never laggy, even while the canvas re-renders
- [ ] `maxLength` is enforced natively on each input
- [ ] Only `name` is required; the rest are genuinely optional
- [ ] Download and share are disabled with a stated reason while `name` is empty
- [ ] The title derives from `role` and updates as `role` changes
- [ ] Reroll cycles suggestions
- [ ] Editing the title stops derivation; reroll re-enables it
- [ ] Zero-width characters and repeated whitespace are stripped
- [ ] Pasting a 500-character string is truncated at the input, not rescued downstream
- [ ] Every input has a real `<label htmlFor>`
- [ ] Errors are associated via `aria-describedby` and announced
- [ ] Keyboard: tab order is logical, reroll is reachable and labelled
- [ ] Fields survive a format switch (A ↔ B) without being cleared

## Files touched

```
components/editor/BuilderForm.tsx
components/editor/BuilderTitleField.tsx
components/editor/Field.tsx
lib/schema.ts
lib/store.ts
```

## How to test

Type a full card on a phone with the on-screen keyboard up — that is the real test. Check that the preview stays visible above the keyboard (or that the layout scrolls sensibly), that the preview updates while typing, and that the keyboard's "next" button moves through the fields in order.

Then paste hostile input: 500 characters, a zero-width-joined string copied from a social bio, an emoji-only name, and a name in a non-Latin script. Nothing should break the layout; some may render in a fallback face, which is expected and documented in [T-014](T-014-text-layout-engine.md).

## Gotchas

- **Debounce the render, not the state.** Debouncing `setField` makes the input feel broken — characters appear late, and cursor position can jump.
- **Placeholders are not labels.** Both are needed. This is the single most common a11y miss in a form this small.
- **`maxLength` on the input is not validation.** Paste can exceed it in some browsers and programmatic sets bypass it entirely. Keep the zod cap too.
- **The manual-title flag is easy to get wrong.** Without it, editing the role wipes a custom title; with it set too eagerly, reroll stops working. Test the sequence: type role → reroll → edit title → edit role → reroll.
- **Do not clear fields on format switch.** A user who fills in the card and then looks at the PFP frame should find their text intact when they switch back.
- **iOS zooms on focus** if an input's font size is under 16 px. Set at least `text-base` on inputs or the whole page jumps on every focus.
- **Autocomplete/autocorrect** may capitalize or "fix" a name. Consider `autoCapitalize="words"` on name and `autoCorrect="off"` on stack, where "Next.js" is otherwise liable to be corrected.

## References

- [03 — User Flows, Format B](../03-user-flows.md#format-b--one-extra-step)
- [T-014 — text layout](T-014-text-layout-engine.md)
