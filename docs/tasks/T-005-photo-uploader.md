# T-005 — PhotoUploader: picker, drag & drop, camera

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 1 — Ingest                             |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 3 h                                    |
| **Depends on** | [T-002](T-002-design-tokens-and-ui.md) |
| **Blocks**     | T-006, T-026                           |
| **Satisfies**  | FR-1.1, FR-1.2, FR-1.3                 |

## Why this exists

This is the only mandatory interaction in the product. Everything downstream is automatic. It has to work on the first tap, in an in-app browser, one-handed, with no instructions.

## Scope

**In:** the drop zone component, `<input type="file">` wiring, drag & drop, camera capture on mobile, accessible labelling, paste-from-clipboard.

**Out:** validation ([T-006](T-006-file-validation.md)), decoding ([T-007](T-007-heic-conversion.md)/[T-008](T-008-exif-and-downscale.md)), layout of the surrounding page ([T-026](T-026-landing-and-format-selector.md)).

The component's whole job is: produce a `File` and hand it to `onFile`.

## Implementation notes

```tsx
// components/uploader/PhotoUploader.tsx
"use client";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,image/*";

export function PhotoUploader({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = () => inputRef.current?.click();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload your photo. JPG, PNG, or HEIC."
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      data-dragging={dragging}
      className="rounded-ui data-[dragging=true]:border-primary border-2 border-dashed …"
    >
      <UploadIcon />
      <p className="font-display">Upload your photo</p>
      <p className="text-muted text-sm">JPG · PNG · HEIC · up to 25 MB</p>
      <p className="text-muted text-xs">Your photo stays on your device.</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // ← allows re-picking the same file
        }}
      />
    </div>
  );
}
```

### The `accept` attribute is genuinely tricky

```
   accept="image/*"                  → broad, but on some Android builds shows
                                       a picker that also offers video
   accept="image/heic"               → several Android pickers show *nothing*
                                       because they don't know the MIME type
   accept=".heic,.heif"              → extension hints; helps where MIME fails
   accept="image/jpeg,image/png,…"   → hides HEIC on iOS in some versions,
                                       which is the worst possible outcome
```

Belt and braces: list specific MIME types, then the extensions, then `image/*` as a catch-all. Over-permissive `accept` is fine because [T-006](T-006-file-validation.md) sniffs magic bytes anyway — under-permissive `accept` means a user literally cannot select their photo, which is unrecoverable.

### Camera capture

```tsx
// A separate input — a single input cannot both browse and force the camera.
<input type="file" accept="image/*" capture="user" className="sr-only" ref={cameraRef} />
```

Show the camera button only on touch devices (`matchMedia('(hover: none) and (pointer: coarse)')`). `capture="user"` requests the front camera, which is right for a profile picture. Note that on desktop `capture` is ignored, which is why it must be a separate, conditionally-rendered control rather than an attribute on the main input.

### Paste support (cheap, desktop users love it)

```ts
useEffect(() => {
  const onPaste = (e: ClipboardEvent) => {
    const f = Array.from(e.clipboardData?.files ?? [])[0];
    if (f?.type.startsWith("image/")) onFile(f);
  };
  window.addEventListener("paste", onPaste);
  return () => window.removeEventListener("paste", onPaste);
}, [onFile]);
```

### In-app browser escape hatch

X, Instagram, and WhatsApp in-app browsers occasionally cannot open a file picker at all. Detect the dead end and offer a way out rather than leaving the user tapping a button that does nothing:

```ts
// lib/capabilities.ts
export const isInAppBrowser = () =>
  /FBAN|FBAV|Instagram|Twitter|Line|MicroMessenger/i.test(navigator.userAgent);
```

If `isInAppBrowser()` and no file arrives within a few seconds of the first tap, surface "Trouble uploading? Open in Safari" with a copy-link button. Owned jointly with [T-027](T-027-states-loading-error.md).

## Acceptance criteria

- [ ] Tapping the zone opens the OS file picker on iOS and Android
- [ ] HEIC photos are selectable from the iOS camera roll
- [ ] HEIC photos are selectable on Android
- [ ] Drag & drop works on desktop, with a visible hover state
- [ ] Dropping a non-file (text, a URL) does not throw
- [ ] Selecting the **same file twice in a row** fires `onFile` both times
- [ ] Camera button appears only on touch devices and opens the camera
- [ ] Paste from clipboard works on desktop
- [ ] Keyboard: focusable, activates on Enter and Space, visible focus ring
- [ ] Screen reader announces the purpose and accepted formats
- [ ] Only the first file is used when several are dropped
- [ ] The privacy line is visible without scrolling

## Files touched

```
components/uploader/PhotoUploader.tsx
components/uploader/UploadHint.tsx
lib/capabilities.ts
```

## How to test

On a real iPhone and a real Android phone: tap, pick a HEIC from the camera roll, confirm `onFile` fires with a non-zero-byte `File`. Then repeat with the same photo to catch the `input.value` reset bug. Emulators will not reproduce the picker differences that matter here.

## Gotchas

- **`e.target.value = ''` is mandatory.** Without it, selecting the same file twice fires no `change` event, and the user concludes the app is broken. This is the single most common bug in file-upload components.
- **`file.type` is frequently `""`** for HEIC on Android and in some WebViews. Never gate the upload on it — that is [T-006](T-006-file-validation.md)'s job, using magic bytes.
- **iOS may transcode on the way out.** A HEIC in the camera roll often arrives as JPEG. Sometimes it does not. Handle both; do not assume either.
- **`capture` needs its own input.** One input cannot serve both "browse" and "take a photo".
- **Live Photos** may arrive as a still plus a movie, or occasionally as the movie. Take only `files[0]` and let validation reject a video.
- **Do not use `<label>` wrapping a hidden input** _and_ a click handler — you will get double-fires on some browsers. Pick one mechanism (the `ref.click()` above).
- **`onDragOver` must call `preventDefault()`** or the browser navigates away to the dropped file. Easy to forget, dramatic failure.

## References

- [03 — User Flows, Step 2](../03-user-flows.md#step-2--upload)
- [MDN: File input accept](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#accept)
