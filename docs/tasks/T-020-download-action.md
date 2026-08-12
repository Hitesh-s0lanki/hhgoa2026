# T-020 — Download action: desktop + iOS-safe

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 4 — Output                            |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 2.5 h                                 |
| **Depends on** | [T-019](T-019-export-and-variants.md) |
| **Blocks**     | T-029                                 |
| **Satisfies**  | FR-4.1, FR-4.2, FR-4.3                |

## Why this exists

This is the moment the product delivers. If the file does not reach the user's device, nothing else matters — and it is genuinely harder on iOS than the one-line `<a download>` snippet suggests.

FR-4.3 is a P0 for a reason: most of our traffic is iPhone Safari, where `download` behaviour has historically varied and where "saved to Files" is not the same as "in my camera roll".

## Scope

**In:** the desktop anchor path, the iOS share-sheet path, the new-tab fallback, the capability routing, post-download UI.

**Out:** blob generation ([T-019](T-019-export-and-variants.md)), the X share flow ([T-022](T-022-x-intent-share.md)/[T-025](T-025-native-share-sheet.md)).

## The platform reality

```
   Desktop (Chrome/Safari/FF/Edge)
     <a href=blobUrl download="name.png"> → lands in ~/Downloads. Reliable.

   Android Chrome
     Same anchor → lands in Downloads, with a notification. Reliable.

   iOS Safari 13+
     Anchor with `download` → downloads to Files, showing a confirm sheet.
     Works, BUT: the file goes to Files, not Photos. A user who wants to set
     it as an avatar or post it has extra steps.
     → navigator.share({files}) → share sheet with "Save Image" → Photos.
       This is what the user actually wants.

   In-app browsers (X, Instagram, WhatsApp)
     Wildly inconsistent. `download` may be ignored entirely. The share
     sheet may or may not be available.
     → fallback: open the blob in a new tab, tell the user to long-press.
```

Conclusion: **on touch devices, prefer the share sheet over the anchor.** "Save Image" puts it in Photos, which is where a profile picture needs to be.

## Implementation notes

```ts
// lib/share/download.ts
export type SaveResult = "downloaded" | "shared" | "opened" | "cancelled" | "failed";

export async function saveImage(blob: Blob, name: string): Promise<SaveResult> {
  // 1 · Touch devices: the share sheet reaches Photos.
  if (caps.touch && canShareFiles(blob, name)) {
    try {
      await navigator.share({ files: [new File([blob], name, { type: blob.type })] });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled"; // user dismissed
      // fall through
    }
  }

  // 2 · Anchor download — desktop, Android, and iOS fallback.
  if (caps.downloadAttr) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Generous delay — revoking too early silently kills the download.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "downloaded";
  }

  // 3 · Last resort: open the blob so the user can long-press to save.
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    return "failed";
  }
  return "opened";
}
```

### Gesture discipline

`navigator.share` must be invoked from within the user's gesture. Because [T-019](T-019-export-and-variants.md) exports eagerly, `saveImage` receives a ready blob and the only `await` before `share()` is the (synchronous) capability check. If you ever need to render first, the gesture is already gone — which is precisely why the eager export exists.

```ts
// ✗ breaks the gesture
onClick={async () => { const b = await renderAndExport(); await navigator.share({files:[b]}); }}

// ✓ blob is already in state
onClick={() => saveImage(exportBlob!, filename)}
```

### Post-action feedback

Each outcome needs different copy, because each leaves the user in a different place:

| Result       | Message                                                    |
| ------------ | ---------------------------------------------------------- |
| `downloaded` | "Saved to your downloads."                                 |
| `shared`     | — (the OS sheet was the feedback; saying more is noise)    |
| `opened`     | "Press and hold the image to save it."                     |
| `cancelled`  | — (silence; they chose to dismiss)                         |
| `failed`     | "Couldn't save it. Try long-pressing the preview instead." |

`cancelled` producing no message is important. An "error" toast after someone deliberately dismissed a sheet is the kind of small wrongness that makes an app feel careless.

### The button

```tsx
// components/actions/DownloadButton.tsx
export function DownloadButton() {
  const { exportBlob, templateId, fields } = useStore();
  const [busy, setBusy] = useState(false);
  const label = caps.touch ? "Save photo" : "Download";

  return (
    <Button
      disabled={!exportBlob || busy}
      onClick={() => {
        setBusy(true);
        saveImage(exportBlob!, filename(templateId, fields, exportBlob!.type))
          .then(reportResult)
          .finally(() => setBusy(false));
      }}
    >
      {label}
    </Button>
  );
}
```

"Save photo" on touch, "Download" on desktop. The words match what actually happens, which is worth more than consistency across platforms.

### Offering the smaller file

If the PNG exceeds ~4 MB ([T-019](T-019-export-and-variants.md) sets `suggestJpeg`), show a secondary link: "Download a smaller version (JPG)". Do not silently substitute — offer.

## Acceptance criteria

- [ ] Desktop Chrome, Safari, Firefox, Edge: file lands in the downloads folder with the correct name
- [ ] Android Chrome: file lands in Downloads
- [ ] **iOS Safari: the image reaches the Photos library** via the share sheet
- [ ] iOS Safari without file-share support: the anchor path still saves to Files
- [ ] In-app browser: at minimum, the blob opens so the user can long-press
- [ ] Dismissing the iOS share sheet shows **no** error
- [ ] `navigator.share` is called inside the gesture, with no intervening await
- [ ] Filename is meaningful and correct in every path
- [ ] Blob URLs are revoked, but not before the browser has read them
- [ ] The button is disabled until a blob exists, and shows a busy state
- [ ] The downloaded file matches the on-screen preview exactly
- [ ] A PNG over 4 MB offers a JPEG alternative
- [ ] Repeated downloads do not leak memory

## Files touched

```
lib/share/download.ts
components/actions/DownloadButton.tsx
lib/capabilities.ts
```

## How to test

Real devices, no substitutes. On an iPhone: tap Save, choose "Save Image", then open Photos and confirm it is there and correct. Repeat inside the X in-app browser (open the site from a tweet) — this is the path most attendees will actually take, and it is the one most likely to be broken.

On desktop: check all four browsers, and verify the filename. Firefox and Safari occasionally differ on how `download` interacts with blob URLs.

Then verify the preview-matches-file criterion by opening the downloaded file next to the browser at the same zoom. Any difference points at two render paths, which [T-013](T-013-canvas-renderer-core.md) exists to prevent.

## Gotchas

- **`download` on iOS does not reach Photos.** It goes to Files. For a profile picture that is the wrong destination, and users will not think to look there. The share sheet is the fix, not a nicety.
- **Revoking too early kills the download silently.** No error, no file. Use a long timeout or revoke on the next state change.
- **`AbortError` is not a failure.** It means the user dismissed the sheet. Treat it as a no-op.
- **`window.open` is blocked** unless it is in a user gesture, and some in-app browsers block it regardless. Hence it is the last resort, and its failure must be handled.
- **`a.click()` needs the anchor in the document** in some browsers. Append, click, remove.
- **Do not `await` anything between the click and `navigator.share`.** Even a resolved promise's `await` yields the microtask queue in a way that some browsers count as leaving the gesture.
- **The busy state matters.** Encoding plus the OS sheet can take a moment, and a second tap during it produces two share sheets.
- **In-app browsers are the real test.** A link from a tweet opens in X's WKWebView, not Safari. If saving is broken there, it is broken for most of your users regardless of how well it works in Safari.

## References

- [03 — User Flows, Step 4](../03-user-flows.md#step-4--get-the-file)
- [MDN: Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
