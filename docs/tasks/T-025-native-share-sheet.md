# T-025 — Native share sheet (Web Share Level 2)

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 5 — Share                             |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 2.5 h                                 |
| **Depends on** | [T-019](T-019-export-and-variants.md) |
| **Blocks**     | T-029                                 |
| **Satisfies**  | FR-5.3                                |

## Why this exists

This is the only way a website can get a real image attachment into someone's X post. `navigator.share({ files })` hands the file to the OS, the OS hands it to X, and the composer opens with the image genuinely attached — not as a link card.

On mobile, which is our primary platform, this is the best share experience available, and it uploads nothing.

## Scope

**In:** capability detection, the share call, gesture discipline, the clipboard caption companion, `AbortError` handling, route selection.

**Out:** the intent URL ([T-022](T-022-x-intent-share.md)), the link route ([T-023](T-023-storage-presigned-upload.md)/[T-024](T-024-share-page-og.md)).

## Implementation notes

```ts
// lib/share/native.ts
export function canShareFiles(blob: Blob, name: string): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([blob], name, { type: blob.type })] });
  } catch {
    return false;
  }
}

export async function shareNative(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: blob.type });
  // Several targets drop `text` when `files` is present — copy it as insurance.
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* non-fatal */
  }
  await navigator.share({ files: [file], text, title: "HH Goa 2026" });
}
```

Note `canShare` is wrapped in try/catch: it throws rather than returning false on some older implementations when given a file type it dislikes.

### The rules — each one is a silent failure if broken

| Rule                                               | Symptom if broken                             |
| -------------------------------------------------- | --------------------------------------------- |
| Called from within the user gesture                | `NotAllowedError`, nothing happens            |
| No `await` between the click and `share()`         | Same — the gesture is consumed                |
| Secure context (HTTPS or localhost)                | `navigator.share` is undefined                |
| Check `canShare({files})`, not `!!navigator.share` | Throws on a browser with text-only share      |
| `AbortError` treated as a dismissal                | A spurious error toast after the user cancels |
| One `share()` at a time                            | Two sheets, or an `InvalidStateError`         |

### Gesture discipline in practice

The blob must already exist. This is exactly why [T-019](T-019-export-and-variants.md) exports eagerly:

```tsx
// ✗ the await consumes the gesture — share is blocked
onClick={async () => {
  const blob = await exportImage();
  await navigator.share({ files: [new File([blob], name)] });
}}

// ✓ blob is in state before the tap
onClick={() => shareNative(exportBlob!, name, caption(fields))}
```

If the blob is genuinely not ready, do not try to share — disable the button and let the eager export finish. A disabled button for 200 ms is better than a share that fails for reasons the user cannot see.

### The caption problem, honestly

`navigator.share({ files, text })` passes both, but the receiving app decides what to use. In practice several targets — including X on some versions — ignore `text` when `files` is present. There is no way to force it.

So: copy the caption to the clipboard, and say so.

```
   ┌──────────────────────────────────────┐
   │   Shared! Caption copied — paste it  │
   │   in the composer if it's empty.     │
   └──────────────────────────────────────┘
```

Users paste without complaint when they know that is the step. What frustrates them is an empty composer with no explanation.

### Route selection

```tsx
// components/actions/ShareButton.tsx
function pickRoute(blob: Blob | null, name: string) {
  if (!blob) return "disabled";
  if (caps.touch && canShareFiles(blob, name)) return "native";
  if (shareLinkEnabled && navigator.onLine) return "link";
  return "download";
}
```

| Route      | Label                                    | What happens                                    |
| ---------- | ---------------------------------------- | ----------------------------------------------- |
| `native`   | **Share**                                | OS sheet, real attachment, nothing uploaded     |
| `link`     | **Share on X** + "creates a public link" | Upload → intent with `url`                      |
| `download` | **Download & post on X**                 | Save file → intent with caption → user attaches |
| `disabled` | **Share** (disabled)                     | Reason in a tooltip / `aria-describedby`        |

Decide the route at render time so the label is correct before the user taps. A button whose behaviour is decided after the click cannot describe itself honestly.

### Desktop

Desktop support for file sharing is effectively nil, so desktop always lands on `link` or `download`. Do not show a "Share" button on desktop that silently degrades — use the accurate label.

## Acceptance criteria

- [ ] iOS Safari: the share sheet opens with the image attached
- [ ] Choosing X from the sheet opens the composer **with the image attached**
- [ ] Android Chrome: same
- [ ] The caption is copied to the clipboard and the user is told
- [ ] Dismissing the sheet produces **no** error message
- [ ] `canShare({files})` is checked, not just `navigator.share`
- [ ] `share()` is called with no intervening `await` after the click
- [ ] Non-secure contexts fall back cleanly
- [ ] Desktop falls back to link or download with an accurate label
- [ ] Rapid double-tap does not open two sheets
- [ ] Route is decided at render time so the label matches the behaviour
- [ ] Sharing the same image twice works
- [ ] A stale blob is never shared — invalidation from [T-019](T-019-export-and-variants.md) holds
- [ ] Works inside the X in-app browser, or degrades with a stated reason

## Files touched

```
lib/share/native.ts
components/actions/ShareButton.tsx
lib/capabilities.ts
```

## How to test

Only real devices prove this. On an iPhone with the X app installed: tap Share → X → confirm the image is attached in the composer, then check whether the caption came through (it may not — verify the clipboard message appears either way).

Repeat on Android. Then repeat inside the X in-app browser, reached by opening the site from a tweet, since that is the path most attendees will take.

Then test the failure modes deliberately: dismiss the sheet (expect silence), double-tap the button quickly (expect one sheet), and adjust the crop then immediately share (expect the new crop).

## Gotchas

- **`await` before `share()` is the #1 failure.** Any yield to the microtask queue after the click can invalidate the gesture. The eager export exists to make this avoidable.
- **`AbortError` is a dismissal, not an error.** Showing a toast for it makes the app feel broken when the user simply changed their mind.
- **`canShare` can throw.** Wrap it.
- **`text` is advisory when `files` is present.** Do not build the UX on the assumption that it arrives. The clipboard companion is not a fallback — it is part of the design.
- **Clipboard writes also need a gesture** in some browsers, and they need a secure context. Doing it inside the same handler is fine; doing it in a `.then()` afterwards may not be.
- **`File` needs a correct `type`.** A file with an empty type may be rejected by `canShare` or arrive at the target unrecognised.
- **iOS PWA / standalone mode** behaves differently from Safari. If a user has added the site to their home screen, retest.
- **Do not include `url` alongside `files`** unless you want the target to have both — some apps then attach the link _instead_ of the file.

## References

- [08 — Sharing & OG, Route 1](../08-sharing-and-og.md#route-1--native-share-sheet-mobile-primary)
- [MDN: navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
