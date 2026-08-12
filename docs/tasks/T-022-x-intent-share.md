# T-022 — X intent share: caption prefill

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 5 — Share                             |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 1.5 h                                 |
| **Depends on** | [T-019](T-019-export-and-variants.md) |
| **Blocks**     | —                                     |
| **Satisfies**  | FR-5.1, FR-5.2                        |

## Why this exists

The brief asks that "Share to X" open X with the caption already written, not just open X. This is the small, reliable half of the sharing story — it works everywhere, needs no upload, and cannot fail.

Read [08 — Sharing & OG](../08-sharing-and-og.md) first for the constraint that shapes this task: **a web page cannot force-attach an image to someone's X post.** This task prefills text; the image arrives via [T-025](T-025-native-share-sheet.md) (native attach) or [T-024](T-024-share-page-og.md) (link card).

## Scope

**In:** the caption module, the intent URL builder, the download-then-post flow, clipboard fallback.

**Out:** file attachment ([T-025](T-025-native-share-sheet.md)), the hosted link route ([T-023](T-023-storage-presigned-upload.md)/[T-024](T-024-share-page-og.md)).

## Implementation notes

### The caption, in one place

```ts
// lib/share/caption.ts
const TAG = process.env.NEXT_PUBLIC_SHARE_HASHTAG ?? "FrameInGoa";

export function caption(fields?: Fields): string {
  const who = fields?.builderTitle ? ` as a ${fields.builderTitle.toLowerCase()}` : "";
  return `Framed for HH Goa 2026 🌴 Less noise, more signal.${who}\n\n#${TAG}`;
}
```

One exported function, so the final approved wording ([Q-5](../11-open-questions.md)) is a one-line change. Do not inline caption strings into components — event copy always changes late.

Length budget:

```
   280 characters total
   − 24 for the t.co link (X counts every URL as 23 chars + a space)
   ─────
   256 available for text — the caption above uses ~60. Comfortable.
```

### The intent URL

```ts
// lib/share/intent.ts
export function intentUrl(text: string, url?: string): string {
  const u = new URL("https://x.com/intent/post");
  u.searchParams.set("text", text);
  if (url) u.searchParams.set("url", url);
  return u.toString();
}

export function openIntent(text: string, url?: string) {
  window.open(intentUrl(text, url), "_blank", "noopener,noreferrer");
}
```

Use `URL.searchParams.set` rather than building the string by hand. It encodes correctly, and a raw `#` in a query string silently truncates everything after it — which means the hashtag would eat the rest of your URL and you would spend twenty minutes wondering why.

`x.com/intent/post` is the current canonical form; `twitter.com/intent/tweet` still redirects. On mobile this URL deep-links into the installed X app, which is the desired behaviour.

Supported parameters, for reference: `text`, `url`, `hashtags`, `via`, `related`. **No media parameter exists.** If [Q-5](../11-open-questions.md) yields an official handle, add `via`.

### The download-then-post flow (Route 3)

When file sharing is unavailable and the link route is not configured, this is the honest floor — and it is what most "share to X" buttons on the web actually do:

```ts
// components/actions/ShareButton.tsx
async function shareViaDownload() {
  const text = caption(fields);
  await saveImage(exportBlob!, filename(...));      // T-020
  try { await navigator.clipboard.writeText(text); } catch { /* non-fatal */ }
  openIntent(text);
  toast('Image saved and caption copied — attach it in the composer.');
}
```

Sequence matters: save the file _first_, so it exists by the time the composer opens. And say plainly what happened. Users are entirely comfortable attaching an image themselves when they know that is the step — what frustrates them is a button that seems to promise an attachment and silently delivers a link.

### Popup blocking

`window.open` outside a gesture is blocked. If the flow needs an await first (as above), the popup may be blocked on some browsers. Mitigation:

```ts
// Open the window synchronously in the gesture, then navigate it.
const w = window.open('', '_blank');
await saveImage(...);
if (w) w.location = intentUrl(text);
else toast('Popup blocked — caption copied, open X to post.');
```

Slightly awkward, but it turns a dead button into a working one on the browsers that are strict about this.

### Button copy

The label must match what will happen. Vagueness here is what makes users feel misled:

| Route available   | Label                                              |
| ----------------- | -------------------------------------------------- |
| Native file share | **Share**                                          |
| Link + OG         | **Share on X** · sub-line: "creates a public link" |
| Download + intent | **Download & post on X**                           |

Route selection is in [08](../08-sharing-and-og.md#which-route-runs-and-what-the-button-says).

## Acceptance criteria

- [ ] Clicking share opens X with the caption pre-filled
- [ ] The hashtag appears correctly (not truncated, not URL-mangled)
- [ ] Newlines in the caption survive encoding
- [ ] Emoji survive encoding
- [ ] Caption + link allowance stays under 280 characters
- [ ] On mobile, the URL deep-links into the X app when installed
- [ ] The caption is copied to the clipboard on the download-then-post route
- [ ] The user is told what happened, in one short line
- [ ] Popup blocking is handled with a working fallback
- [ ] `noopener,noreferrer` is set on the opened window
- [ ] The caption lives in exactly one module
- [ ] Button copy accurately describes the route taken

## Files touched

```
lib/share/caption.ts
lib/share/intent.ts
components/actions/ShareButton.tsx
tests/unit/caption.test.ts
```

## How to test

Click share on desktop and read the composer: the caption should be exactly what `caption()` returns, hashtag intact, line break intact. Then do it on a phone with the X app installed and confirm it opens the app rather than a browser tab.

Unit-test the length and encoding:

```ts
it("fits in a tweet with a link", () => {
  expect(caption(fields).length + 24).toBeLessThan(280);
});
it("survives URL encoding", () => {
  const parsed = new URL(intentUrl(caption(fields)));
  expect(parsed.searchParams.get("text")).toBe(caption(fields));
});
```

The round-trip assertion is the valuable one — it catches every encoding mistake in one line.

## Gotchas

- **A raw `#` truncates a query string.** This is the classic intent-URL bug. `URL.searchParams.set` handles it; hand-built strings do not.
- **There is no `media` parameter.** No amount of searching will produce one. Attachment requires either the OS ([T-025](T-025-native-share-sheet.md)) or an authenticated API call, which would need a login we are forbidden from adding.
- **X counts every URL as 23 characters** regardless of actual length, plus a separator. Budget accordingly.
- **`window.open` after an await may be blocked.** Use the open-then-navigate pattern.
- **Do not over-promise in the label.** "Share on X" implying an attachment when the user will get a link card is the kind of small dishonesty users notice immediately.
- **Test with the X app installed and not installed.** The deep-link and the web fallback behave differently, and the web composer in a mobile browser sometimes drops prefilled text if the user is not logged in.
- **The caption is event copy.** Expect it to change the day before launch. That is why it is one function in one file.

## References

- [08 — Sharing & OG](../08-sharing-and-og.md)
- [14 — Official Brief](../14-official-brief.md)
