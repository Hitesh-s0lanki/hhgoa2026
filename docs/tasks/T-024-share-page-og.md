# T-024 — `/share/[id]` page with OG + Twitter cards

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Phase**      | 5 — Share                                            |
| **Status**     | ☐ Not started                                        |
| **Estimate**   | 3 h                                                  |
| **Depends on** | [T-023](T-023-storage-presigned-upload.md)           |
| **Blocks**     | —                                                    |
| **Satisfies**  | FR-5.4                                               |
| **Droppable**  | Yes, with [T-023](T-023-storage-presigned-upload.md) |

## Why this exists

The brief is specific: _"if you share via link rather than direct image attach, make sure the link preview (OG image) actually shows the generated graphic."_

This is that. A page whose only real job is to carry the right meta tags so X, WhatsApp, Slack, and iMessage render the user's graphic as the link preview.

## Scope

**In:** the dynamic route, `generateMetadata`, the human-facing page, the expired/invalid state, cross-platform unfurl verification.

**Out:** upload ([T-023](T-023-storage-presigned-upload.md)), the intent URL ([T-022](T-022-x-intent-share.md)).

## Implementation notes

### Metadata

```tsx
// app/share/[id]/page.tsx
const SITE = process.env.NEXT_PUBLIC_SITE_URL!;
const CDN = process.env.NEXT_PUBLIC_CDN_BASE!;
const ID_RE = /^[A-Za-z0-9_-]{8,24}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!ID_RE.test(id)) return { title: "HH Goa 2026" };

  const image = `${CDN}/g/${id}.jpg`;
  const title = "Framed for HH Goa 2026";
  const description = "Make your own in seconds — no signup.";

  return {
    title,
    description,
    metadataBase: new URL(SITE),
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE}/share/${id}`,
      siteName: "HH Goa 2026",
      images: [{ url: image, width: 1080, height: 1350, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
```

The id regex is not cosmetic — without it, `/share/<script>` reflects attacker-controlled content into your meta tags. Validate before interpolating, always.

### Why not `next/og`

The obvious instinct is to generate the OG image server-side with `@vercel/og`. Wrong here, for a concrete reason: **the image already exists**. It was rendered on the user's device with their photo, their crop, and their text. Regenerating it server-side would mean reimplementing the entire template engine in a second runtime — and it would produce a _different_ picture from the one the user downloaded.

Pointing `og:image` at the stored file is simpler and guarantees the preview matches what the user saw.

### The human-facing page

The crawler reads the tags, but people click the link too. The page must be worth landing on:

```
   ┌──────────────────────────────────┐
   │        HH GOA 2026               │
   │                                  │
   │   ┌──────────────────────────┐   │
   │   │  [ the shared graphic ]  │   │  ← the actual image
   │   └──────────────────────────┘   │
   │                                  │
   │      Framed for HH Goa 2026      │
   │                                  │
   │   [ Make your own → ]            │  ← the conversion point
   │                                  │
   └──────────────────────────────────┘
```

That CTA is the whole reason the link route drives more reach than a native attach: every share becomes an entry point.

### Expired and invalid ids

Objects expire after 60 days ([T-023](T-023-storage-presigned-upload.md)), so dead links are expected, not exceptional.

```tsx
// Check reachability server-side so the page can render the right state.
const head = await fetch(image, { method: "HEAD", cache: "no-store" }).catch(() => null);
const exists = head?.ok ?? false;
```

If it does not exist, render a friendly page — "This one's expired. Make your own." — with the same CTA. Do **not** 404: a 404 from a link someone shared reads as a broken site, and it wastes the visit.

For metadata on a missing image, fall back to the site's static OG card rather than emitting an `og:image` that will 404 (which produces an ugly broken-image card on some platforms).

### Caching

```ts
export const revalidate = 3600; // the page is static per id for an hour
```

The content at an id never changes, so the page can be cached aggressively. The `HEAD` existence check is the only dynamic part, and being an hour stale about expiry is fine.

## OG requirements that actually bite

| Requirement                                      | Consequence if missed                                            |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Absolute `og:image` URL                          | No preview at all — relative URLs are ignored                    |
| Publicly fetchable, anonymous, no redirect chain | Blank card                                                       |
| Under 5 MB (X); ours ~250 KB                     | Card silently dropped                                            |
| ≥ 300 × 157; 1080 × 1350 or 1200 × 630 ideal     | Falls back to a small card                                       |
| `twitter:card = summary_large_image`             | Small thumbnail instead of the big treatment                     |
| Tags present in the **initial SSR HTML**         | Crawlers do not run JS — no preview                              |
| `og:image:width`/`height` declared               | Slower or absent first unfurl                                    |
| Immutable content per URL                        | X caches unfurls; a changed image at the same id will not update |

The last one is why ids are content-immutable by construction. If you ever need to change an image, mint a new id.

## Acceptance criteria

- [ ] `/share/{id}` renders with the correct OG and Twitter tags in the **SSR HTML**
- [ ] `og:image` is an absolute URL
- [ ] `twitter:card` is `summary_large_image`
- [ ] Width and height are declared
- [ ] The id is validated against a regex before interpolation
- [ ] An invalid id renders the generic page, never reflected input
- [ ] An expired id renders the friendly "expired" page, not a 404
- [ ] The page shows the actual graphic and a "Make your own" CTA
- [ ] **A real post on X shows the generated graphic** as a large card
- [ ] WhatsApp shows the graphic in its preview
- [ ] Slack and iMessage unfurl correctly
- [ ] The page works with JS disabled (it is content, not an app)
- [ ] Page weight under 100 KB excluding the image
- [ ] Tags fall back to the site card when the image is missing

## Files touched

```
app/share/[id]/page.tsx
app/share/[id]/not-found.tsx
app/opengraph-image.tsx        (static site-level card)
components/SharedGraphic.tsx
```

## How to test

Inspection is not enough — crawlers behave differently from browsers.

```bash
# 1 · tags are in the server HTML, not injected by JS
curl -s https://hhgoa.app/share/abc123XYZ | grep -iE 'og:|twitter:'

# 2 · the image is anonymously reachable, correct type, no redirect
curl -I https://cdn.hhgoa.app/g/abc123XYZ.jpg
```

Then the authoritative test: paste the URL into X's composer on a throwaway account and look at the unfurl. Repeat in WhatsApp, Slack, and iMessage — WhatsApp especially, since it is how most attendees will actually pass this around.

Finally, verify the cache behaviour deliberately: overwrite the object at an existing id and confirm the old card persists. That is not a bug to fix; it is the reason ids must be immutable, and seeing it once makes the rule stick.

## Gotchas

- **Relative `og:image` URLs are ignored.** `metadataBase` plus an absolute URL. This is the single most common OG mistake.
- **Crawlers do not execute JavaScript.** Tags injected client-side do not exist as far as X is concerned. `generateMetadata` (server-side) is the only correct place.
- **X caches unfurls for a long time.** During development, every test needs a fresh id, or you will be looking at a stale card and debugging code that is already correct.
- **A redirect chain on the image URL breaks some crawlers.** Serve it directly from the CDN domain.
- **Do not 404 an expired share.** A broken link from someone's post reflects on the event, and a friendly page converts the visit instead of wasting it.
- **Never interpolate an unvalidated path param into meta tags.** It is a reflected-content hole with a very short path to something embarrassing.
- **`fetch` with `HEAD` needs `cache: 'no-store'`** in Next's data cache, or an expired image will keep reporting as present.
- **Both `og:` and `twitter:` tags are needed.** X reads `twitter:` first and falls back to `og:`; other platforms only read `og:`. Emit both.

## References

- [08 — Sharing & OG](../08-sharing-and-og.md#the-share-page)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
