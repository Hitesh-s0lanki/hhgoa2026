# T-023 — Presigned upload API + storage

|                |                                                                                |
| -------------- | ------------------------------------------------------------------------------ |
| **Phase**      | 5 — Share                                                                      |
| **Status**     | ☐ Not started                                                                  |
| **Estimate**   | 3.5 h                                                                          |
| **Depends on** | [T-019](T-019-export-and-variants.md)                                          |
| **Blocks**     | T-024, T-031                                                                   |
| **Satisfies**  | FR-5.5                                                                         |
| **Droppable**  | Yes, with [T-024](T-024-share-page-og.md) — see [Q-6](../11-open-questions.md) |

## Why this exists

The OG-preview share route ([T-024](T-024-share-page-og.md)) needs the generated image at a public URL so X's crawler can fetch it. That means a copy leaves the device — the one exception to the privacy default, and therefore something that must be explicitly triggered, clearly disclosed, and time-limited.

This is the only server-side compute in the project.

## Scope

**In:** the presign endpoint, the direct-to-storage PUT, bucket configuration, lifecycle expiry, graceful degradation when storage is absent.

**Out:** the share page ([T-024](T-024-share-page-og.md)), rate limiting and abuse handling ([T-031](T-031-privacy-and-abuse.md)) — though the hooks belong here.

## Why presigned rather than proxying

```
   ✗ browser → POST /api/upload (multipart) → serverless fn → S3
     · serverless body size limits (4.5 MB on Vercel) — a PNG can exceed this
     · doubles the bytes transferred and the function duration
     · pays for compute to move bytes

   ✓ browser → POST /api/share (tiny JSON) → { id, uploadUrl }
     browser → PUT uploadUrl (the blob) → storage directly
     · function handles kilobytes, not megabytes
     · storage does what storage is for
```

ADR-006. The cost is that the presign must be tightly scoped, since it is a capability handed to a browser.

## Implementation notes

### The endpoint

```ts
// app/api/share/route.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { z } from "zod";

const body = z.object({
  contentType: z.enum(["image/jpeg", "image/png"]),
  size: z.number().int().positive().max(2_000_000), // 2 MB ceiling
});

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  if (!process.env.S3_BUCKET) {
    return Response.json({ error: "sharing_unavailable" }, { status: 503 });
  }

  const limited = await rateLimit(req); // T-031
  if (limited) return Response.json({ error: "rate_limited" }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });

  const { contentType, size } = parsed.data;
  const id = nanoid(12);
  const ext = contentType === "image/png" ? "png" : "jpg";
  const key = `g/${id}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType, // pinned — the PUT must match
      ContentLength: size, // pinned — bounds the upload
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 60 },
  ); // 60 s is plenty for one upload

  return Response.json({
    id,
    uploadUrl,
    shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/share/${id}`,
    imageUrl: `${process.env.NEXT_PUBLIC_CDN_BASE}/${key}`,
  });
}
```

Every constraint above closes a hole. Pinning `ContentType` stops the URL being used to upload arbitrary content types; pinning `ContentLength` stops it being used to upload a 5 GB file; the 60 s TTL stops it being saved and reused; and the server minting the key means the client cannot choose where to write.

### The client side

```ts
// lib/share/upload.ts
export async function uploadForShare(blob: Blob) {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: blob.type, size: blob.size }),
  });
  if (!res.ok) throw new ShareUnavailableError(res.status);

  const { shareUrl, uploadUrl, imageUrl } = await res.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": blob.type }, // must match the pinned type exactly
    body: blob,
  });
  if (!put.ok) throw new ShareUnavailableError(put.status);

  return { shareUrl, imageUrl };
}
```

The `content-type` header on the PUT must match what was signed, byte for byte, or the storage returns 403 with a signature mismatch — an error that looks like a credentials problem and is not.

### Bucket configuration

| Setting         | Value                         | Why                                         |
| --------------- | ----------------------------- | ------------------------------------------- |
| Public read     | on, via a CDN custom domain   | X's crawler must fetch anonymously          |
| Public **list** | **off**                       | Otherwise every uploaded face is enumerable |
| CORS            | `PUT` from our origin only    | The browser PUT is cross-origin             |
| Lifecycle       | delete `g/*` after 60 days    | NFR-3.4, and it bounds storage cost         |
| Cache-Control   | `max-age=31536000, immutable` | Content at an id never changes              |

CORS on R2/S3:

```json
[
  {
    "AllowedOrigins": ["https://hhgoa.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Add the Vercel preview domain during development, and remember to keep production's list tight.

### IDs

```ts
nanoid(12); // ~71 bits of entropy from a 64-char alphabet
```

The id is the **only** access control on a photo of someone's face. Twelve characters is not guessable at any practical rate. Do not shorten it for prettier URLs, and do not derive it from anything user-supplied (a name-derived id would be enumerable, which defeats the entire protection).

Disabling public listing matters just as much: an unguessable key in a listable bucket is not unguessable.

### Degrading gracefully

The app must build and run with no storage configured:

```ts
export const shareLinkEnabled =
  !!process.env.NEXT_PUBLIC_CDN_BASE && !!process.env.NEXT_PUBLIC_SITE_URL;
```

When false, the link-share route is hidden and the button falls back to [T-022](T-022-x-intent-share.md)'s download-then-post path. Local development with no cloud account must be a first-class experience — otherwise every contributor needs credentials to work on the UI.

### Consent

```
   ┌────────────────────────────────────────┐
   │  [ Share on X ]                        │
   │  Creates a public link. Your image is  │
   │  uploaded and auto-deletes in 60 days. │
   └────────────────────────────────────────┘
```

The upload happens _after_ this is on screen and the user has pressed the button that says so. Silently uploading a face from a button labelled "Share" would violate NFR-3.2, and the fix costs one line of copy.

## Acceptance criteria

- [ ] `POST /api/share` returns `{ id, uploadUrl, shareUrl, imageUrl }`
- [ ] The presigned PUT succeeds from the browser
- [ ] The uploaded object is publicly readable at `imageUrl` **anonymously**
- [ ] The presign expires after 60 s (verify: a delayed PUT fails)
- [ ] A PUT with a mismatched content-type is rejected
- [ ] A PUT larger than the declared size is rejected
- [ ] `nanoid(12)` ids; keys are `g/{id}.{ext}`
- [ ] Public listing is **disabled** on the bucket — verify by attempting a list
- [ ] Lifecycle expiry is configured and verified in the provider console
- [ ] `Cache-Control: immutable` is set on stored objects
- [ ] CORS allows PUT from our origin only
- [ ] With storage env vars absent: the app builds, runs, and hides the link route
- [ ] The endpoint returns 503 (not 500) when unconfigured
- [ ] S3 credentials never reach the client bundle — verify by grepping the build output
- [ ] The consent line is visible before the upload occurs
- [ ] Rate limiting hook is wired ([T-031](T-031-privacy-and-abuse.md))

## Files touched

```
app/api/share/route.ts
lib/share/upload.ts
lib/env.ts                 (validated server env)
.env.example
```

## How to test

```bash
# 1 · presign
curl -sX POST localhost:3000/api/share \
  -H 'content-type: application/json' \
  -d '{"contentType":"image/jpeg","size":123456}' | tee /tmp/p.json

# 2 · upload
curl -X PUT "$(jq -r .uploadUrl /tmp/p.json)" \
  -H 'content-type: image/jpeg' --data-binary @test.jpg

# 3 · anonymous read — must be 200, correct type, no redirect
curl -I "$(jq -r .imageUrl /tmp/p.json)"

# 4 · expiry — wait 61 s, repeat step 2, expect failure
```

Then verify the client bundle is clean:

```bash
grep -r "S3_SECRET" .next/static && echo "LEAK" || echo "clean"
```

## Gotchas

- **Content-type mismatch → 403.** The signed request pins it; the PUT must send exactly the same value. The error message points at signatures, not at the header, which sends people down the wrong path.
- **Public listing is a real exposure.** An unguessable key in a listable bucket is browsable. Check this explicitly rather than assuming the default.
- **R2 needs a public bucket or a custom domain** to serve reads. The `*.r2.cloudflarestorage.com` endpoint is for the S3 API, not for public reads, and pointing `og:image` at it will fail.
- **Never `NEXT_PUBLIC_` the credentials.** The prefix inlines the value into the client bundle. Grep the build to be sure.
- **Vercel body size limits** are why this is presigned. If you find yourself proxying the blob, you will hit the limit on a PNG.
- **Set the lifecycle rule at setup, not later.** "We'll add expiry before launch" is how a bucket of faces accumulates indefinitely.
- **Do not add a DELETE endpoint** without thinking about who is authorized to call it. There are no users, so there is nobody to authorize — takedown is a manual operator action ([T-031](T-031-privacy-and-abuse.md)).
- **Idempotency.** A retried upload mints a new id, leaving an orphan object. Harmless with lifecycle expiry, worth knowing.

## References

- [08 — Sharing & OG, Route 2](../08-sharing-and-og.md#route-2--link-with-an-og-image)
- [04 — Architecture, ADR-005 & ADR-006](../04-architecture.md#adr-006--presigned-direct-to-storage-upload)
- [11 — Open Questions Q-6, Q-13](../11-open-questions.md)
