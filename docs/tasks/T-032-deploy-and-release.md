# T-032 — Deploy + release checklist

|                |               |
| -------------- | ------------- |
| **Phase**      | 6 — Ship      |
| **Status**     | ☐ Not started |
| **Estimate**   | 1.5 h         |
| **Depends on** | all           |
| **Blocks**     | —             |
| **Satisfies**  | NFR-5.1       |

## Why this exists

The last mile. Also the place to be honest in writing about what was built, what was cut, and what is assumed — which for a take-home or a handover is a substantial part of what is actually being assessed.

## Scope

**In:** Vercel configuration, environment variables per environment, domain, the release gate, the project README, handover notes.

**Out:** the QA run itself ([T-029](T-029-cross-device-qa.md)).

## Deployment

Vercel needs no configuration for a Next.js app beyond environment variables. The parts worth getting right:

| Setting               | Value                           |
| --------------------- | ------------------------------- |
| Production branch     | `main`                          |
| Preview deployments   | on for every branch             |
| Node version          | pinned to match local           |
| Build command         | `next build` (default)          |
| Environment variables | set per environment — see below |

### Environment variables

| Variable                    | Preview           | Production      | Notes                                               |
| --------------------------- | ----------------- | --------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | the preview URL   | the real domain | **Must be absolute** — OG tags break otherwise      |
| `NEXT_PUBLIC_CDN_BASE`      | dev bucket domain | prod CDN domain |                                                     |
| `NEXT_PUBLIC_SHARE_HASHTAG` | `FrameInGoa`      | as approved     | [Q-5](../11-open-questions.md)                      |
| `S3_*`                      | dev bucket creds  | prod creds      | **Server-only.** Never `NEXT_PUBLIC_`.              |
| `UPSTASH_*`                 | optional          | required        | rate limiting ([T-031](T-031-privacy-and-abuse.md)) |

Use separate buckets for preview and production. Test uploads landing in the production bucket alongside real users' images is avoidable mess.

`NEXT_PUBLIC_SITE_URL` on preview deployments is the awkward one — Vercel's URL changes per deployment. Use `VERCEL_URL` as a fallback:

```ts
// lib/env.ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
```

### Headers

```ts
// next.config.ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=()' },
    ],
  }];
}
```

`camera=(self)` because the camera capture input ([T-005](T-005-photo-uploader.md)) needs it; everything else off.

A CSP would be a good addition, but note the app uses a worker and WASM — `worker-src 'self' blob:` and `script-src 'wasm-unsafe-eval'` are required, so a naive strict CSP will break HEIC decoding. Test it properly or leave it out rather than shipping one that half-works.

## Release gate

Do not ship until every line is true.

### Functionality

- [ ] Every **P0** requirement in [02](../02-requirements.md) is met
- [ ] The full manual script passes on all four **must** environments ([T-029](T-029-cross-device-qa.md))
- [ ] All eight EXIF orientation fixtures render upright on a real device
- [ ] HEIC from an iPhone camera roll works on both iOS and Android
- [ ] The download reaches the iOS Photos library
- [ ] Share to X works via at least one route, verified with a real post

### Brand

- [ ] `brand.isPlaceholder === false`, or the placeholder is explicitly acknowledged in the README
- [ ] Canvas text uses the brand fonts, verified by screenshot
- [ ] Font licensing confirmed, or the substitution documented ([Q-3](../11-open-questions.md))
- [ ] The share caption is the approved wording ([Q-5](../11-open-questions.md))
- [ ] `MANIFEST.md` lists every asset with source and licence

### Quality

- [ ] `npm run check` clean (typecheck + lint + unit)
- [ ] Visual snapshots committed and green in Chromium and WebKit
- [ ] Lighthouse mobile: performance ≥ 90, accessibility ≥ 95
- [ ] Initial JS ≤ 200 KB gzip; HEIC and face chunks excluded ([T-028](T-028-performance-budget.md))
- [ ] Every performance budget row measured on a real device and recorded

### Privacy & security

- [ ] Privacy copy is visible and **accurate** ([T-031](T-031-privacy-and-abuse.md))
- [ ] The default flow sends nothing — verified in the network panel
- [ ] Bucket listing disabled; lifecycle expiry configured and verified
- [ ] Rate limiting active, returns 429
- [ ] No secret is present in the client bundle: `grep -r "S3_SECRET" .next/static`
- [ ] Takedown procedure documented with a contact address

### Submission (hard gates — see [14](../14-official-brief.md))

- [ ] Deployed URL is public and opens on a phone from a fresh browser
- [ ] Team/combined frame produced and used in the post ([T-033](T-033-team-combined-frame.md))
- [ ] X post published containing a **literal `#FrameInGoa`** — verified on the live tweet, not the composer
- [ ] Post includes the quick how-to
- [ ] Form submitted at <https://forms.gle/jM5hTaGvsrfEfixPA>
- [ ] **One submission per team** — confirmed with the team before sending
- [ ] Submitted before **11:59 pm, 13 Aug 2026**

### Housekeeping

- [ ] `.env.example` current; no `.env.local` committed
- [ ] README written (below)
- [ ] Cut scope stated explicitly
- [ ] Open assumptions listed ([11](../11-open-questions.md))
- [ ] Deployed URL recorded and shared

## The project README

This is the document that gets read first. Structure:

```markdown
# HH Goa 2026 — Photo Framer

Upload a photo → get an on-brand HH Goa 2026 graphic → download or post it. No login.

**Live:** https://… **Docs:** [docs/](docs/)

## What it does

[2–3 sentences + one screenshot of each format]

## How it works

Everything runs in the browser: HEIC decode, EXIF correction, cover-fit
framing, canvas compositing, PNG export. The server exists only so a shared
link can carry the generated image as its OG preview.
[the diagram from docs/README.md]

## Run it

    npm install && npm run dev

Storage vars are optional — without them, share-via-link is hidden and
everything else works.

## Decisions worth knowing

- Client-side rendering, not server-side — no upload on the happy path, so
  the privacy claim is structural (docs/04, ADR-001)
- Templates are data, not code — a design change is a values edit (ADR-003)
- No AI, no database — neither earns its latency or its complexity (ADR-004, ADR-007)
- The X image-attach limitation is real; both legitimate routes are
  implemented (docs/08)

## What's not built

[be specific and unapologetic — e.g.:]

- Face-aware auto-crop (T-011): heuristic + manual control instead
- OG link-share route (T-023/24): native share + download-then-post instead
- Story/9:16 variant

## Known limitations

- HEIC on Chrome/Android needs a ~1 MB WASM decoder (lazy-loaded, ~1–2 s)
- A web page cannot force-attach an image to an X post; see docs/08
- Text layout does not shape RTL or complex scripts

## Tests

    npm test          # unit: geometry, text layout, titles, validation
    npm run test:e2e  # Playwright: happy path + visual regression
```

Being direct about what was cut and why reads as judgement. A README that implies everything is finished, when it is not, reads as something else.

## Handover notes

If someone else takes this over, add:

| Item                            | Where                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| How to change the design        | [06](../06-brand-and-templates.md) + [T-004](T-004-template-spec-and-registry.md)              |
| How to add a new format         | [09](../09-project-structure.md#where-to-add-a-new-design) — new spec file + one registry line |
| How to change the caption       | `lib/share/caption.ts`, one function                                                           |
| How to take down a shared image | [T-031](T-031-privacy-and-abuse.md)                                                            |
| Open questions                  | [11](../11-open-questions.md)                                                                  |
| Where the bodies are buried     | the Gotchas section of each task file                                                          |

## Acceptance criteria

- [ ] Production deploy from `main` succeeds with no manual steps
- [ ] Preview deploys work with their own bucket
- [ ] All env vars set per environment; no secret is `NEXT_PUBLIC_`
- [ ] `NEXT_PUBLIC_SITE_URL` is absolute in every environment
- [ ] Security headers present, verified with `curl -I`
- [ ] Custom domain configured with HTTPS (or the Vercel URL recorded)
- [ ] Every release-gate box above is ticked
- [ ] README complete, including cut scope and known limitations
- [ ] Handover table complete
- [ ] A final end-to-end run on a real phone against **production**

## Files touched

```
README.md
next.config.ts
lib/env.ts
.env.example
vercel.json          (only if needed)
```

## How to test

Do the final run against production, on a phone, from a link — not against localhost, not on a laptop. Open the production URL from a message on a real phone, upload a HEIC from the camera roll, save it, and post it. That is the user's path, and it is the only run that proves the release.

Then verify the headers and the absence of secrets:

```bash
curl -I https://hhgoa.app | grep -iE 'x-content-type|referrer|frame-options'
grep -r "S3_SECRET" .next/static && echo "LEAK" || echo "clean"
```

## Gotchas

- **A relative `NEXT_PUBLIC_SITE_URL` breaks every OG tag** ([T-024](T-024-share-page-og.md)). It must be an absolute origin, in every environment.
- **Separate buckets for preview and production.** Otherwise test images accumulate next to real ones and the lifecycle rule cleans up both, or neither, in ways nobody predicted.
- **A naive CSP breaks the worker and WASM.** `worker-src 'self' blob:` and `wasm-unsafe-eval` are needed. A CSP that silently disables HEIC decoding is worse than none.
- **Verify the lifecycle rule in the console.** Configuration that was "set up" and never checked is the classic source of an unbounded bucket.
- **Do not ship placeholder brand assets silently.** Either the real kit is in, or the README says plainly that it is not.
- **Run the final test on the production URL.** Preview and production differ in env vars, domain, and CDN — which is exactly where OG and CORS problems live.
- **State the cuts.** A clearly-scoped complete thing is a better outcome than an ambitious partial thing, and the difference is largely in whether it was described honestly.

## References

- [12 — QA & Testing, release gate](../12-qa-and-testing.md#release-gate)
- [10 — Roadmap](../10-roadmap-phases.md)
