# 08 — Sharing & OG Previews

The most misunderstood part of the brief. This document states plainly what is and is not possible, then describes the two mechanisms we build.

---

## The hard constraint

> **A web page cannot force an image from the user's device to be attached to their X post.**

There is no URL parameter, no intent field, and no API that does this from a plain website. `twitter.com/intent/tweet` accepts `text`, `url`, `hashtags`, `via`, and `related` — no media. Attaching media requires either the X API v2 with an authenticated user token (which means OAuth, which means login — forbidden by FR-6.1), or the user's own OS/app doing it.

So there are exactly two legitimate routes:

```
   ROUTE 1 — the OS does it                ROUTE 2 — the link carries the image
   ────────────────────────                ───────────────────────────────────
   navigator.share({ files: [png] })       Upload png → /share/{id} page with
        │                                  og:image → X unfurls it as a card
        ▼                                       │
   OS share sheet                                ▼
        │                                  Post shows a large image card
        ▼                                  (visually similar, technically a link)
   User taps X
        │
   X composer opens with the
   image genuinely attached

   ✓ real native attachment                ✓ works on desktop, no permissions
   ✓ mobile, one tap                       ✓ image is clickable, drives traffic
   ✗ mobile only (desktop support is       ✗ it is a link card, not native media
     effectively nil)                      ✗ requires uploading the photo to us
   ✗ caption doesn't reliably ride along    ✗ X caches the unfurl aggressively
```

We implement both and pick by capability. Neither is a workaround for the other — they are different products from the user's point of view, and both are legitimate readings of the brief.

---

## Route 1 · Native share sheet (mobile primary)

```ts
// lib/share/native.ts
export function canShareFiles(blob: Blob, name: string): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  return navigator.canShare({ files: [new File([blob], name, { type: blob.type })] });
}

export async function shareNative(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: blob.type });
  // Copy the caption too — several targets drop `text` when `files` is present.
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* non-fatal */
  }
  await navigator.share({ files: [file], text, title: "HH Goa 2026" });
}
```

Non-obvious rules, all of which cause silent failures if broken:

| Rule                                                                                | Consequence if ignored                             |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Must be called from a **user gesture** (the click handler itself)                   | `NotAllowedError`                                  |
| Requires a **secure context** (HTTPS or localhost)                                  | `navigator.share` is undefined                     |
| Must `await` inside the same task — no `await` before it that yields to the network | Gesture is consumed, share is blocked              |
| Check `canShare({files})`, not just `!!navigator.share`                             | Some browsers have `share` but not file support    |
| `AbortError` means the user dismissed the sheet                                     | Treat as success/no-op, never as an error toast    |
| Some targets ignore `text` when `files` is present                                  | Hence the clipboard copy + a "caption copied" note |

Because the blob must exist _before_ the gesture, we generate the export eagerly as soon as the preview settles, so the share handler has a ready blob and never has to await a render. That is a small but important sequencing detail owned by [T-025](tasks/T-025-native-share-sheet.md).

---

## Route 2 · Link with an OG image

```
   [ Share on X ]  (desktop, or no file-share support)
          │
    1. POST /api/share  { contentType, size }
          │     ├─ rate limit by IP
          │     ├─ id = nanoid(12)
          │     └─ presigned PUT for  g/{id}.jpg   (TTL 60 s, content-type pinned)
          ▼
    2. PUT the blob straight to R2/S3   (browser → storage, no server hop)
          ▼
    3. open  https://x.com/intent/post
               ?text=I%27m%20framed%20for%20HH%20Goa%202026%20%F0%9F%8C%B4%20%23FrameInGoa
               &url=https%3A%2F%2Fhhgoa.app%2Fshare%2Fabc123XYZ
          ▼
    4. X's crawler fetches /share/abc123XYZ
          ├─ reads twitter:card = summary_large_image
          ├─ reads og:image = https://cdn.hhgoa.app/g/abc123XYZ.jpg
          └─ renders the generated graphic in the composer and the posted tweet
```

### The share page

```tsx
// app/share/[id]/page.tsx
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL!; // absolute, required
const CDN = process.env.NEXT_PUBLIC_CDN_BASE!;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,24}$/.test(id)) return { title: "HH Goa 2026" };

  const image = `${CDN}/g/${id}.jpg`;
  const title = "Framed for HH Goa 2026";
  const description = "Make your own in seconds — no signup.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE}/share/${id}`,
      siteName: "HH Goa 2026",
      images: [{ url: image, width: 1080, height: 1350, alt: title }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Human-facing page: show the graphic and a CTA to make one.
  return <SharedGraphic id={id} />;
}
```

### OG requirements that actually bite

| Requirement         | Detail                                                                 | Failure symptom                                                                      |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Absolute URL        | `og:image` must be `https://…`, never `/g/x.jpg`                       | No preview at all                                                                    |
| Publicly fetchable  | No auth, no `robots.txt` block on the image path, no redirect chain    | Blank card                                                                           |
| Format              | JPEG, PNG, WebP, or static GIF                                         | Ignored                                                                              |
| Size                | Under 5 MB (X); keep ours under 1 MB                                   | Card silently dropped                                                                |
| Dimensions          | ≥ 300 × 157 for a large card; 1200 × 630 or 1080 × 1350 both work well | Falls back to a small card                                                           |
| `twitter:card`      | `summary_large_image` for the big treatment                            | Small thumbnail card                                                                 |
| SSR'd tags          | Must be in the initial HTML — crawlers do not run our JS               | No preview                                                                           |
| Caching             | X caches unfurls for a long time                                       | Never reuse an id for different content — ours are content-immutable by construction |
| Dimensions declared | Providing `width`/`height` speeds first-render of the card             | Slower/absent first unfurl                                                           |

**Why we do not use `@vercel/og` / `next/og` here:** those generate an image at request time from JSX. Our image already exists as a rendered blob in storage — regenerating it server-side would mean re-implementing the whole template engine in a second runtime and would produce a _different_ picture than the user downloaded. Pointing `og:image` at the stored file is both simpler and guarantees the preview matches what the user saw.

Tasks: [T-023](tasks/T-023-storage-presigned-upload.md), [T-024](tasks/T-024-share-page-og.md)

---

## Caption

```ts
// lib/share/caption.ts
const TAG = process.env.NEXT_PUBLIC_SHARE_HASHTAG ?? "FrameInGoa";

export function caption(fields?: Fields) {
  const who = fields?.builderTitle ? ` as a ${fields.builderTitle.toLowerCase()}` : "";
  return `I'm framed for HH Goa 2026 🌴${who}\n\n#${TAG}`;
}
```

Rules:

- Keep the whole thing (caption + the 23-char t.co link allowance) comfortably under 280.
- Use `encodeURIComponent` on the assembled text — newlines and `#` must be escaped, and a raw `#` in a query string silently truncates everything after it.
- The final wording must be signed off by the organizers ([Q-5](11-open-questions.md)). Ship it as one exported constant so changing it is a one-line edit.

## Intent URL

```ts
// x.com and twitter.com both work; x.com/intent/post is the current canonical form.
const url = new URL("https://x.com/intent/post");
url.searchParams.set("text", caption(fields));
if (shareUrl) url.searchParams.set("url", shareUrl);
window.open(url.toString(), "_blank", "noopener,noreferrer");
```

Note: `URL.searchParams.set` handles the encoding for us — do not hand-build the query string. On mobile, opening this URL will deep-link into the installed X app, which is fine and desirable.

Task: [T-022](tasks/T-022-x-intent-share.md)

---

## Which route runs, and what the button says

```
                 user taps the share button
                            │
                 canShareFiles(blob)?
                    ┌───────┴───────┐
                  yes               no
                    │                │
        ┌───────────▼──────────┐  ┌──▼─────────────────────────────┐
        │ Route 1              │  │ storage configured & online?   │
        │ label: "Share"       │  │      ┌────────┴────────┐       │
        │ nothing uploaded     │  │    yes                no       │
        │ image truly attached │  │      │                 │       │
        └──────────────────────┘  │  Route 2          Route 3      │
                                  │  label:           label:       │
                                  │  "Share on X      "Download,   │
                                  │   (creates a       then post"  │
                                  │   public link)"    + copy      │
                                  │                    caption     │
                                  └────────────────────────────────┘
```

Route 3 is the honest floor: download the file, open X with the caption pre-filled, and tell the user in one short line to attach the image they just saved. It always works, requires nothing from us, and is what most "share to X" tools actually do.

**Consent is explicit in Route 2.** The label says a public link will be created, and a one-line note under the button explains that the image is uploaded and auto-deletes. Silently uploading someone's face when they pressed a button labelled "Share" would violate NFR-3.2.

---

## Verifying it works

You cannot trust this by inspection — crawlers behave differently from browsers.

| Check                       | How                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tags present in SSR HTML    | `curl -s https://hhgoa.app/share/abc123 \| grep -i 'og:\|twitter:'`                                                     |
| X's own renderer            | Post to a throwaway account, or paste the URL into the composer and watch the unfurl                                    |
| Card validator              | X's Card Validator (when reachable); otherwise the composer preview is authoritative                                    |
| Other platforms             | WhatsApp, Slack, iMessage, Discord all unfurl OG — test at least WhatsApp, it is how most attendees will actually share |
| Image reachable anonymously | `curl -I https://cdn.hhgoa.app/g/abc123.jpg` in a private context — expect `200`, correct `content-type`, no redirect   |
| Cache behaviour             | Change the image at the same id and confirm the stale card persists — this is _why_ ids are immutable                   |

Covered in [T-024](tasks/T-024-share-page-og.md) and the QA matrix in [12](12-qa-and-testing.md).

---

## Storage lifecycle

| Aspect        | Decision                                                                         |
| ------------- | -------------------------------------------------------------------------------- |
| Key layout    | `g/{nanoid12}.jpg` — flat, no user prefix (there are no users)                   |
| Visibility    | Public read via a CDN custom domain. Unguessable id is the only access control.  |
| Retention     | Lifecycle rule deletes objects after 60 days. Stated in the UI.                  |
| Expired links | `/share/[id]` renders a friendly "this one's expired" page with a CTA, not a 404 |
| Cache headers | `public, max-age=31536000, immutable` — content at an id never changes           |
| Cost          | Text-free JPEG at ~600 KB × expected volume is negligible; R2 has no egress fee  |

Because the id is the only protection, do not shorten it below 12 characters, and do not derive it from anything user-supplied. Enumeration resistance is a real requirement here — the objects are photos of people's faces. Owned by [T-031](tasks/T-031-privacy-and-abuse.md).
