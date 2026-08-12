# T-027 — States: loading, empty, error, offline

|                |                                                                                |
| -------------- | ------------------------------------------------------------------------------ |
| **Phase**      | 6 — Ship                                                                       |
| **Status**     | ☐ Not started                                                                  |
| **Estimate**   | 2.5 h                                                                          |
| **Depends on** | [T-009](T-009-ingest-orchestration.md), [T-021](T-021-live-preview-surface.md) |
| **Blocks**     | T-030                                                                          |
| **Satisfies**  | FR-6.4                                                                         |

## Why this exists

Twelve things can go wrong ([03](../03-user-flows.md#unhappy-paths)) and **every one must be recoverable in place**. This is the task that separates a demo from a tool: a demo works on the happy path, a tool survives a PDF, a dead network, and an in-app browser.

It is also where the "no progress theatre" requirement gets enforced, by deciding deliberately what is _not_ shown.

## Scope

**In:** the state → UI mapping, error components, the loading policy, offline handling, the in-app browser escape hatch, live-region announcements.

**Out:** the error data and codes ([T-006](T-006-file-validation.md)/[T-009](T-009-ingest-orchestration.md)), the a11y audit ([T-030](T-030-accessibility-pass.md)).

## The loading policy

This is a policy decision, not a component decision, and it is the point of the task:

```
   Duration          What we show
   ────────────      ──────────────────────────────────────────
   < 150 ms          nothing. A flash reads as instability.
   150–400 ms        skeleton shimmer inside the reserved box
   > 400 ms          a named, specific state ("Converting your photo…")
   unknown/long      the same, plus a cancel affordance
```

And explicitly **not**:

```
   ✗ "Processing…"          says nothing
   ✗ "AI thinking…"         false, and slow-sounding
   ✗ "Almost there…"        we don't know that
   ✗ fake progress bars     the brief calls this out directly
   ✗ multi-step checklists  it's one step
```

The only legitimate visible wait in this product is HEIC decode. Renders are under 100 ms; adjustments show nothing at all.

## Implementation notes

### State → UI, exhaustively

```tsx
// components/editor/EditorShell.tsx
function StateView() {
  const { status, error, slow, image, warn } = useStore();

  switch (status) {
    case "idle":
      return <UploadZone />;
    case "validating":
      return <PreviewFrame>{image ? <Canvas /> : null}</PreviewFrame>;
    case "decoding":
      return <PreviewFrame>{slow ? <Converting /> : <Skeleton />}</PreviewFrame>;
    case "ready":
    case "rendering":
      return (
        <>
          <PreviewFrame>
            <Canvas />
          </PreviewFrame>
          {warn === "LOW_RES" && <LowResNotice />}
        </>
      );
    case "uploading":
      return (
        <>
          <PreviewFrame>
            <Canvas />
          </PreviewFrame>
          <UploadingNotice />
        </>
      );
    case "error":
      return (
        <>
          <ErrorNotice error={error!} onRetry={openPicker} />
          {image && (
            <PreviewFrame>
              <Canvas />
            </PreviewFrame>
          )}
        </>
      );
  }
}
```

Two things to notice:

- **`error` still shows the preview** if one exists. Losing your working result because you mis-tapped a file is a punishment, not an error message.
- **`rendering` looks identical to `ready`.** That is intentional — the render is fast enough that acknowledging it would only add flicker.

### Error component

```tsx
// components/states/ErrorNotice.tsx
export function ErrorNotice({ error, onRetry }: Props) {
  return (
    <div role="alert" className="rounded-ui border-primary/30 bg-primary/5 border p-4">
      <p className="font-medium">{error.message}</p>
      {error.hint && <p className="text-muted mt-1 text-sm">{error.hint}</p>}
      <Button variant="ghost" onClick={onRetry} className="mt-3">
        Choose another photo
      </Button>
    </div>
  );
}
```

`role="alert"` so it is announced. Every error has a message, an optional hint, and a button that does something. An error without an action is a dead end.

Note the styling: bordered and tinted, not a red alarm. A user picking the wrong file is not an emergency, and treating it like one makes the tool feel brittle.

### Offline

```ts
// Only the link-share route needs the network.
const online = useOnline(); // navigator.onLine + online/offline events
```

| Feature                          | Offline                   |
| -------------------------------- | ------------------------- |
| Upload, render, adjust, download | ✔ all local, unaffected   |
| Native share                     | ✔ no network needed       |
| Link share                       | ✖ disabled, with a reason |

Copy: _"Share links need a connection. You can still download and post it."_ — this is a genuine strength of the client-side architecture and worth stating plainly rather than showing a generic offline screen.

`navigator.onLine` is unreliable (it reports true on a captive portal), so treat a failed `/api/share` call as equally authoritative and fall back to the download route.

### In-app browser escape hatch

```tsx
{
  caps.inAppBrowser && showUploadTrouble && (
    <div className="text-sm">
      Trouble uploading? Open this page in Safari or Chrome.
      <Button variant="link" onClick={copyLink}>
        Copy link
      </Button>
    </div>
  );
}
```

Show it only after a first tap has failed to produce a file, so it does not clutter the page for the majority whose in-app browser works fine.

### Low-resolution warning

Non-blocking, per [T-006](T-006-file-validation.md):

```
   ⓘ  That photo's a bit small, so the result may look soft.
      Continue anyway or pick a sharper one.
```

Warn, do not block. Someone whose only photo is 500 px still deserves a card.

### Announcements

```tsx
// A single polite live region for status changes.
<div aria-live="polite" className="sr-only">
  {status === "decoding" && slow && "Converting your photo"}
  {status === "ready" && "Your image is ready"}
</div>
```

Errors use `role="alert"` (assertive); progress uses `aria-live="polite"`. Getting this backwards means either interrupting people constantly or never telling them anything.

## Acceptance criteria

- [ ] Every one of U-1…U-12 in [03](../03-user-flows.md#unhappy-paths) is handled and recoverable without a reload
- [ ] No loading indicator appears for anything under 150 ms
- [ ] Skeleton appears between 150–400 ms
- [ ] "Converting your photo…" appears only past 400 ms, only on the HEIC path
- [ ] No fake progress bars and no vague "Processing…" copy anywhere
- [ ] Adjustment re-renders show no loading state
- [ ] Every error has a message, and where useful a hint, and an action
- [ ] A failed upload keeps the existing preview
- [ ] Errors use `role="alert"`; progress uses `aria-live="polite"`
- [ ] Offline: download and native share still work; link share is disabled with a reason
- [ ] A failed `/api/share` degrades to the download route without a dead end
- [ ] In-app browser hint appears only after a failed first attempt
- [ ] Low-res warning is non-blocking
- [ ] The `status` switch is exhaustive — a new status is a compile error
- [ ] No state leaves the user without a next action

## Files touched

```
components/editor/EditorShell.tsx
components/states/ErrorNotice.tsx
components/states/Converting.tsx
components/states/Skeleton.tsx
components/states/LowResNotice.tsx
lib/hooks/useOnline.ts
```

## How to test

Walk every unhappy path by hand — it is faster than it sounds and it is the only way to find the dead ends:

1. Upload a PDF → error → upload a photo → works.
2. Upload a photo, then a 0-byte file → error, **preview survives**.
3. Throttle to Slow 3G, upload a HEIC → skeleton, then "Converting…", then result.
4. Go offline → download works, link share disabled with a reason.
5. Block `/api/share` in DevTools → share falls back to download.
6. Open the site from a tweet, tap upload, cancel → the in-app hint appears.
7. Upload a 400 px photo → warning, but it still renders.

Then use `sr-only` inspection or a screen reader to confirm announcements fire once each, not on every render.

## Gotchas

- **A 200 ms spinner is worse than no spinner.** It flashes, and a flash reads as a glitch. The 150 ms threshold exists for this reason.
- **Do not clear the preview on error.** The most common instance of gratuitous cruelty in upload UIs.
- **`navigator.onLine` lies.** True on a captive portal, and sometimes stale. Treat request failure as the real signal.
- **`aria-live` regions must exist before the content changes.** Mounting the region and the message at the same time means nothing is announced. Render the empty region always.
- **Do not stack toasts.** One error at a time, in place, near the thing that failed. A pile of toasts is unreadable on a phone.
- **The exhaustive switch matters.** Add a status without a case and you get a blank screen at runtime; make the switch exhaustive with a `never` check and you get a compile error instead.
- **Error copy should name the fix, not the cause.** "We couldn't read that photo — on iPhone, try Settings → Camera → Formats → Most Compatible" is useful. "DECODE_FAILED" is not.

## References

- [03 — User Flows, unhappy paths](../03-user-flows.md#unhappy-paths)
- [02 — Requirements, NFR-1](../02-requirements.md#nfr-1--performance-near-instant)
