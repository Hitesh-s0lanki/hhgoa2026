# T-031 — Privacy notice, rate limiting & abuse

|                |                                            |
| -------------- | ------------------------------------------ |
| **Phase**      | 6 — Ship                                   |
| **Status**     | ☐ Not started                              |
| **Estimate**   | 2 h                                        |
| **Depends on** | [T-023](T-023-storage-presigned-upload.md) |
| **Blocks**     | T-032                                      |
| **Satisfies**  | FR-5.6, NFR-3                              |

## Why this exists

The app handles photographs of people's faces. Two obligations follow.

**Truthfulness.** The architecture gives us a genuinely strong privacy story — the photo never leaves the device by default. That claim is only worth making if it is exactly true, including the one exception, stated plainly.

**Not becoming a liability.** A public bucket with an open presign endpoint is an anonymous image host. Cheap to prevent now; unpleasant to deal with later.

## Scope

**In:** the privacy copy, the consent point, rate limiting, id entropy, lifecycle expiry, the takedown path, telemetry hygiene.

**Out:** the presign endpoint itself ([T-023](T-023-storage-presigned-upload.md)).

## What is actually true

Worth writing down precisely, because the copy must match it:

```
   Default path (download / native share)
     photo → browser memory → canvas → file on the device
     Nothing is sent anywhere. Not to us, not to anyone.

   Link-share path (opt-in, explicit)
     generated image → our storage → public URL (unguessable) → auto-deleted
     The ORIGINAL photo is still never uploaded — only the composited output.

   Always
     No account, no email, no cookies for identity.
     Telemetry is span names and durations. No image data. No typed text.
     Face detection, if it runs, runs on-device and produces a box, not an identity.
```

That last distinction is worth stating: detection finds where a face is; it does not recognise who it is, store an embedding, or transmit anything.

## The copy

Short, in the UI, not buried in a policy page.

**On the landing page, under the CTA:**

> Your photo stays on your device. We don't upload it.

**Next to the link-share button:**

> Creates a public link. Your finished image is uploaded and auto-deletes in 60 days.

**On a `/privacy` page** (one screen, plain language):

> **What we do with your photo.** Your photo is processed entirely in your browser. It is never uploaded to us.
>
> **The one exception.** If you choose "Share on X" via a link, your _finished_ image is uploaded so the link preview can show it. Your original photo is still never uploaded. Shared images sit at an unguessable URL and are deleted automatically after 60 days.
>
> **What we measure.** How long steps take, and how many people finish. No photos, no names, no cookies that identify you.
>
> **Removing a shared image.** Email [contact] with the link and we'll delete it.

Write it in the voice of the event, not a legal department. Long policies are how honest products end up looking evasive.

## Consent

```
   ┌──────────────────────────────────────────┐
   │  [ Share on X ]                          │
   │  Creates a public link — your image is   │
   │  uploaded and auto-deletes in 60 days.   │
   └──────────────────────────────────────────┘
```

The disclosure is on screen **before** the tap, attached to the button that causes the upload. Not in a tooltip, not after the fact, not on another page.

If the user picks native share ([T-025](T-025-native-share-sheet.md)), nothing is uploaded and no disclosure is needed, because nothing happened.

## Rate limiting

One endpoint needs it:

```ts
// lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 m"), // 10 shares / 10 min / IP
  prefix: "share",
});

export async function rateLimit(req: Request): Promise<boolean> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await limiter.limit(ip);
  return !success; // true = blocked
}
```

10 per 10 minutes per IP is generous for a human (who will share once or twice) and useless for a script. If Upstash is not available, an in-memory counter per serverless instance is imperfect but far better than nothing — the goal is raising cost, not perfect enforcement.

Do not rate-limit the rest of the app. Rendering happens on the user's device; there is nothing to protect.

## Defence in depth on the endpoint

Each of these already appears in [T-023](T-023-storage-presigned-upload.md); this task is where they get verified as a set.

| Control                             | Why it matters                                             |
| ----------------------------------- | ---------------------------------------------------------- |
| `ContentType` pinned in the presign | The URL cannot upload arbitrary content types              |
| `ContentLength` pinned, max 2 MB    | Cannot be used to upload a huge file                       |
| 60 s presign TTL                    | Cannot be saved and reused                                 |
| Server mints the key                | Client cannot choose where to write                        |
| `nanoid(12)` — ~71 bits             | Not enumerable                                             |
| Bucket listing **disabled**         | An unguessable key in a listable bucket is not unguessable |
| 60-day lifecycle                    | Bounds exposure and cost                                   |
| CORS: PUT from our origin only      | Not a general-purpose upload endpoint                      |

The listing point deserves emphasis: it is the difference between "unguessable" and "browsable", and it is a checkbox in a console that is easy to leave at its default.

## Takedown

There are no accounts, so there is no user to authorize a delete. Takedown is an operator action, and it needs to be written down before it is needed:

```
   1. Receive a report with the /share/{id} link.
   2. Delete the object:  aws s3 rm s3://$BUCKET/g/{id}.jpg --endpoint-url $S3_ENDPOINT
   3. The share page then renders the "expired" state automatically (T-024).
   4. X's cached unfurl may persist for a while. Nothing can be done about that;
      say so honestly if asked.
```

Put this in the project README along with the contact address. A takedown path that exists only in someone's head is not a takedown path.

## Telemetry hygiene

```ts
// ✓ allowed
track("timing", { name: "ingest.decode", ms: 812 });
track("funnel", { step: "download" });

// ✗ never
track("upload", { filename: file.name }); // filenames contain names
track("render", { name: fields.name }); // user-typed text
track("error", { dataUrl: canvas.toDataURL() }); // image data
```

Add a review note to the analytics module itself so the rule survives the person who wrote it.

## Acceptance criteria

- [ ] The privacy line is visible on the landing page without scrolling
- [ ] The link-share disclosure is visible **before** the upload happens
- [ ] A `/privacy` page exists, is one screen, and is accurate
- [ ] The copy matches the implementation exactly — no overclaiming
- [ ] Rate limiting is active on `/api/share` and returns 429
- [ ] Presign pins content type and length, TTL 60 s
- [ ] Ids are `nanoid(12)` and are not derived from user input
- [ ] Bucket public **listing** is disabled — verified by attempting a list
- [ ] Lifecycle expiry configured and verified in the provider console
- [ ] Takedown procedure documented in the README with a contact address
- [ ] No telemetry event carries image data, filenames, or typed text
- [ ] No identity cookies are set
- [ ] Face detection, if present, is documented as on-device and non-identifying
- [ ] The default path is verified to send nothing — check the network panel through a full download flow

## Files touched

```
lib/ratelimit.ts
app/api/share/route.ts
app/privacy/page.tsx
components/uploader/UploadHint.tsx
components/actions/ShareButton.tsx
lib/analytics.ts
README.md
```

## How to test

The most important test is a negative one, and it takes a minute: open the network panel, complete a full upload → adjust → download flow, and confirm **no request carries image data**. That single check is what makes the privacy claim verifiable rather than asserted.

Then:

```bash
# rate limit trips
for i in $(seq 1 15); do
  curl -so /dev/null -w "%{http_code} " -X POST https://hhgoa.app/api/share \
    -H 'content-type: application/json' -d '{"contentType":"image/jpeg","size":1000}'
done
# expect 200s then 429s

# bucket is not listable
curl -s "https://cdn.hhgoa.app/" | head       # expect no listing

# presign expiry
# request a presign, wait 61s, attempt the PUT — expect failure
```

Read the privacy copy against the code with someone else. Every sentence should map to something you can point at.

## Gotchas

- **Do not overclaim.** "We never see your photo" is false once the link route exists. "Your photo stays on your device — unless you create a share link, which uploads the finished image" is true and still a strong claim. The precise version builds more trust than the absolute one.
- **Public listing is the quiet exposure.** Unguessable keys in a listable bucket are browsable. Check it explicitly.
- **`x-forwarded-for` can be spoofed** where it is not set by a trusted proxy. On Vercel the leftmost value is set by the platform; elsewhere, verify before trusting it.
- **Set the lifecycle rule at setup.** "Before launch" becomes "never", and then the bucket of faces is indefinite.
- **Filenames leak names.** `hitesh-solanki.jpg` in a log or an analytics event is personal data.
- **Face detection needs explaining even though it is benign.** Users hear "face detection" and think recognition. One sentence prevents a reasonable worry.
- **A takedown request will arrive eventually.** Having the command written down turns a stressful hour into two minutes.
- **If [Q-6](../11-open-questions.md) resolves to "no uploads"**, all of this simplifies dramatically: drop [T-023](T-023-storage-presigned-upload.md)/[T-024](T-024-share-page-og.md), and the privacy statement becomes one unqualified sentence. That is a legitimate and arguably better product.

## References

- [02 — Requirements, NFR-3](../02-requirements.md#nfr-3--privacy)
- [08 — Sharing & OG, storage lifecycle](../08-sharing-and-og.md#storage-lifecycle)
- [11 — Open Questions Q-6, Q-17](../11-open-questions.md)
