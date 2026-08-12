# 05 — Tech Stack

## Chosen stack

| Concern              | Choice                                                          | Why this one                                                                                                  |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Framework            | **Next.js 16 (App Router)**                                     | Static landing plus three server routes in one deployable. Middleware is `proxy.ts` from 16. |
| Language             | **TypeScript** (strict)                                         | The geometry and template code is exactly where types pay for themselves.                                     |
| Styling              | **Tailwind CSS**                                                | Brand tokens map cleanly to a theme; fast to build a one-page tool.                                           |
| Components           | **shadcn/ui** (selective)                                       | Copy-in, not a dependency. Take Button, Slider, Input, Label, Tabs, Toast; skip the rest.                     |
| App state            | **Zustand**                                                     | The state is one small machine ([03](03-user-flows.md#state-machine)); Context + reducers would be noisier.   |
| Compositing          | **`modern-screenshot`** (DOM → SVG → canvas)                    | Exports the card already on screen, so preview and output cannot drift (ADR-012). |
| Off-thread work      | **Web Worker** (via `comlink` or raw `postMessage`)             | Keeps drag/slider at 60 fps (ADR-002).                                                                        |
| HEIC decode          | **`heic-to`** or **`heic2any`** (libheif-wasm), lazy            | Only real browser option. Loaded on demand, never in the initial bundle.                                      |
| EXIF                 | **native `imageOrientation:'from-image'`**, `exifr` as fallback | The platform already does this correctly; a library is the exception path.                                    |
| Face hint (optional) | **MediaPipe Face Detector (WASM)** or TFJS BlazeFace, lazy      | Small and fast; strictly a progressive enhancement (ADR-008).                                                 |
| Fonts in canvas      | **FontFace API** + self-hosted WOFF2                            | Deterministic across browsers; no FOUT-in-canvas.                                                             |
| Form handling        | **react-hook-form + zod**                                       | Format B only. Same zod schema guards the render input.                                                       |
| Storage              | **UploadThing**                                                 | Presign + CDN + dashboard in one dependency; same direct-to-storage shape as R2 (ADR-011). |
| Presigning           | **`uploadthing` route handler**                                 | The browser PUTs straight to storage; no bytes cross this app (ADR-006). |
| ID generation        | **nanoid** (12 chars, url-safe)                                 | Unguessable enough for non-secret share links; also the `passes` primary key. |
| Session id           | **`proxy.ts`** + an httpOnly cookie                             | Groups one browser's passes without an account. Not auth — there is no login (FR).                            |
| Rate limiting        | **`@upstash/ratelimit`** or Vercel Edge Config counter          | Only one endpoint needs it; an in-process ceiling stands in until then.                                       |
| Hosting              | **Vercel**                                                      | Zero-config for Next.js; edge for the share page.                                                             |
| Analytics            | **Vercel Analytics** or **Plausible**                           | Cookieless, no PII, aligns with NFR-3.5.                                                                      |
| Unit tests           | **Vitest**                                                      | Fast; the geometry and title-generator functions are pure and worth testing.                                  |
| Visual tests         | **Playwright** + screenshot compare                             | Catches template regressions across browsers ([T-029](tasks/T-029-cross-device-qa.md)).                       |
| Lint / format        | **ESLint + Prettier**                                           | Standard.                                                                                                     |
| Database             | **Neon Postgres + Drizzle ORM**                                 | `/share/[id]` needs `id → card URL` once storage owns the keys (ADR-010). |

## `package.json` shape (target)

```jsonc
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "nanoid": "^5",
    "zod": "^3",
    "react-hook-form": "^7",
    "@aws-sdk/client-s3": "^3", // server only
    "@aws-sdk/s3-request-presigner": "^3", // server only
  },
  "lazyDependencies": {
    "//": "imported via dynamic import(), never in the entry chunk",
    "heic-to": "^1",
    "@mediapipe/tasks-vision": "^0",
  },
  "devDependencies": {
    "typescript": "^5",
    "tailwindcss": "^3",
    "vitest": "^2",
    "@playwright/test": "^1",
    "eslint": "^9",
    "prettier": "^3",
  },
}
```

Pin exact versions at scaffold time ([T-001](tasks/T-001-scaffold-nextjs-app.md)) — the table above is intent, not a lockfile.

## Bundle budget

The initial JS budget is 200 KB gzip (NFR-1). That is comfortable _only_ if the heavy things stay lazy:

```
   entry chunk                         target
   ├── next + react runtime            ~90 KB
   ├── app shell + uploader + store    ~40 KB
   ├── renderer + template specs       ~20 KB
   └── ui primitives                   ~15 KB
                                       ──────
                                       ~165 KB  ✓

   lazy chunks (loaded on demand, never on landing)
   ├── heic decoder (wasm + glue)      ~600 KB–1.5 MB   ← only for HEIC files
   ├── face detector (wasm + model)    ~1–3 MB          ← only if smart-fit runs
   └── crop control                    ~10 KB           ← only when opened
```

Rule: **any dependency over 50 KB must be behind a dynamic `import()`.** Enforced in [T-028](tasks/T-028-performance-budget.md).

## Rejected alternatives

Recording these so they are not re-proposed mid-build.

| Considered                                       | Verdict               | Reason                                                                                                                                                                                           |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `html2canvas` / `dom-to-image`                   | ✗                     | Rasterizes a DOM approximation. Font and shadow fidelity is unreliable, output differs per browser, and it is slow. We need a real, predictable raster.                                          |
| `satori` / `@vercel/og`                          | ✗ for the main render | Server-side, JSX-to-SVG. Great for the _link preview_ if we ever generate one from scratch, but our share image already exists as a blob, so it is unnecessary (see [08](08-sharing-and-og.md)). |
| Server-side Sharp pipeline                       | ✗                     | Requires uploading every face to us, adds a round trip, needs scaling. Contradicts ADR-001.                                                                                                      |
| Fabric.js / Konva                                | ✗                     | Full scene-graph editors. We have a fixed template with 5 layers; raw Canvas 2D is less code and less weight.                                                                                    |
| PixiJS / WebGL                                   | ✗                     | GPU pipeline for a static composite. Overkill and adds context-loss failure modes.                                                                                                               |
| Cloudinary / imgix transformations               | ✗                     | Would work, but puts a paid third party and a network hop on the critical path, and uploads the photo.                                                                                           |
| An LLM for builder titles                        | ✗ v1                  | ADR-007. Latency + failure mode + key management for something a table does instantly.                                                                                                           |
| Background removal (`@imgly/background-removal`) | ✗                     | ~5 MB model, seconds of compute, and it changes the person's photo. Not asked for.                                                                                                               |
| SVG output                                       | ✗                     | X and phone photo libraries want raster. SVG with an embedded base64 photo is large and inconsistently rendered.                                                                                 |
| Supabase / Firebase                              | ✗                     | Brings auth + DB we explicitly do not need (ADR-004).                                                                                                                                            |
| Postgres for share metadata                      | ✗                     | `id → key` is a pure function; a table would have no reader.                                                                                                                                     |
| Redis session store                              | ✗                     | No sessions.                                                                                                                                                                                     |
| Separate Express/Fastify API                     | ✗                     | Two Next route handlers is the entire backend.                                                                                                                                                   |
| PWA / offline install                            | ⊘ P3                  | Genuinely nice (venue wifi), but not requested. Parked.                                                                                                                                          |

## Environment variables

```bash
# .env.local  — server-side only, never NEXT_PUBLIC_
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=hhgoa-shares
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# public
NEXT_PUBLIC_SITE_URL=https://hhgoa.app          # absolute URLs for OG tags
NEXT_PUBLIC_CDN_BASE=https://cdn.hhgoa.app      # public read origin for /g/*
NEXT_PUBLIC_SHARE_HASHTAG=FrameInGoa
```

Rules:

- Storage credentials are **never** exposed to the client. The browser only ever receives a presigned URL.
- `NEXT_PUBLIC_SITE_URL` must be an absolute origin — OG tags with relative URLs are ignored by crawlers ([T-024](tasks/T-024-share-page-og.md)).
- The app must build and run with the storage vars absent: share-via-link degrades, everything else works ([T-027](tasks/T-027-states-loading-error.md)).

## Browser API dependencies

Worth listing because these, not the npm packages, are the real platform risk.

| API                             | Used for                  | If missing                                            |
| ------------------------------- | ------------------------- | ----------------------------------------------------- |
| `createImageBitmap`             | decode + EXIF orientation | fall back to `<img>` + `decode()`, manual EXIF rotate |
| `OffscreenCanvas`               | off-thread render         | main-thread canvas, same code path                    |
| `canvas.toBlob`                 | export                    | `toDataURL` + base64→blob                             |
| `navigator.share` w/ `files`    | mobile share sheet        | intent-link path                                      |
| `navigator.clipboard.writeText` | caption copy              | show selectable text                                  |
| `<a download>`                  | desktop save              | open blob in new tab                                  |
| WASM                            | HEIC decode               | HEIC unsupported, explicit message                    |

Capability detection lives in one module (`lib/capabilities.ts`) rather than scattered `if` checks — see [T-009](tasks/T-009-ingest-orchestration.md).
