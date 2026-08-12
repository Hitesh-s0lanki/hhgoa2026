# 04 — Architecture

## Guiding principle

> **The browser is the product. The server is an accessory for link previews.**

Every consequential decision below follows from that. It gives us speed (no round trip), privacy (photo never leaves the device by default), and cost (no compute per user).

---

## System view

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                              BROWSER                                    │
 │                                                                         │
 │  ┌────────────────┐   ┌────────────────┐   ┌─────────────────────────┐  │
 │  │  UI (React)    │   │  App state     │   │  Render worker          │  │
 │  │                │   │  (zustand)     │   │  (OffscreenCanvas)      │  │
 │  │  Uploader      │──►│                │──►│                         │  │
 │  │  Crop control  │   │  file          │   │  1 draw background      │  │
 │  │  Builder form  │   │  bitmap        │   │  2 clip + draw photo    │  │
 │  │  Preview       │◄──│  transform     │◄──│  3 draw frame / pattern │  │
 │  │  Actions       │   │  fields        │   │  4 draw text            │  │
 │  └────────────────┘   │  templateId    │   │  5 draw logo            │  │
 │         │             └────────────────┘   │  ──► ImageBitmap/Blob   │  │
 │         │                     ▲            └─────────────────────────┘  │
 │         │             ┌───────┴────────┐              ▲                 │
 │         │             │ Ingest pipeline│              │                 │
 │         │             │ validate       │      ┌───────┴───────┐         │
 │         │             │ HEIC decode ⟨L⟩│      │ Template spec │         │
 │         │             │ EXIF + scale   │      │  (data, JSON) │         │
 │         │             │ smart fit  ⟨L⟩ │      │ + brand assets│         │
 │         │             └────────────────┘      └───────────────┘         │
 │         │                                                              │
 │         ▼                    ⟨L⟩ = lazily loaded chunk                 │
 │   Download (local)                                                     │
 │         │                                                              │
 │         └──── Share ────┐                                              │
 └────────────────────────┬┴──────────────────────────────────────────────┘
                          │  only on explicit "share via link"
                          ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                         NEXT.JS SERVER (Vercel)                         │
 │                                                                         │
 │   proxy.ts             POST /api/pass        GET /share/[id]            │
 │   └ mint session id    ├ rate limit          ├ SELECT row by id         │
 │     → cookie + header  ├ validate + allowlist├ emit og:image +          │
 │                        ├ mint id (nanoid)    │   twitter:summary_large  │
 │                        └ INSERT passes ──┐   └ render a human page too  │
 │   POST /api/uploadthing                  │              ▲               │
 │   └ authorise + presign ──┐              │              │               │
 └───────────────────────────┼──────────────┼──────────────┼───────────────┘
                             ▼              ▼              │
                 ┌──────────────────┐  ┌───────────────────┴──┐
                 │  UploadThing     │  │  Neon Postgres       │
                 │  photo + card    │  │  passes (Drizzle)    │
                 │  PNGs, + CDN     │  │  id → card + og URL  │
                 └──────────────────┘  └──────────────────────┘
                             ▲
                             │ crawls og:image
                 ┌──────────────────────┐
                 │  X / WhatsApp / etc. │
                 └──────────────────────┘
```

---

## Layers and their contracts

Keeping these boundaries clean is what allows the render engine to be tested without a browser UI, and the templates to change without touching code.

| Layer             | Responsibility                                                       | Must not                           |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------- |
| **UI components** | Present state, capture intent                                        | Contain image math or drawing code |
| **App state**     | Hold `file`, `bitmap`, `transform`, `fields`, `templateId`, `status` | Touch canvas or the network        |
| **Ingest**        | `File → NormalizedImage` (decoded, upright, size-capped)             | Know anything about templates      |
| **Fit**           | `(imageSize, slotRect, hint?) → Transform` — pure math               | Draw                               |
| **Renderer**      | `(TemplateSpec, NormalizedImage, Transform, Fields) → Blob`          | Know about React or the DOM        |
| **Template spec** | Declarative layout data + asset refs                                 | Contain logic                      |
| **Share**         | Upload blob, build intent URL                                        | Own any UI copy                    |

The renderer's input is a pure data structure. That is the single most important design choice here — see ADR-003.

### Core types

```ts
// lib/types.ts

export type NormalizedImage = {
  bitmap: ImageBitmap; // upright, size-capped
  width: number;
  height: number;
  source: "jpeg" | "png" | "webp" | "heic";
};

export type Transform = {
  scale: number; // 1 = exactly covers the slot
  offsetX: number; // normalized −1…1, 0 = centred
  offsetY: number;
};

export type Fields = {
  name?: string;
  role?: string;
  stack?: string;
  builderTitle?: string;
};

export type RenderRequest = {
  template: TemplateSpec;
  image: NormalizedImage;
  transform: Transform;
  fields: Fields;
  outputScale: number; // 1 = template's native px size
};
```

---

## Data flow, end to end

```
 File
  │  T-006 validate
  ▼
 File (trusted)
  │  T-007 HEIC? → JPEG blob
  │  T-008 createImageBitmap({imageOrientation:'from-image'}) + downscale
  ▼
 NormalizedImage ─────────────────────────┐
  │  T-010 coverFit(image, slot)          │
  │  T-011 optional face hint → offsetY   │
  ▼                                       │
 Transform ───────────────────────────────┤
                                          │
 Fields (T-018 form) ─────────────────────┤
 TemplateSpec (T-004 registry) ───────────┤
                                          ▼
                              T-013 renderer (worker)
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
              preview ImageBitmap                    export Blob (T-019)
              → <canvas> on screen                    │
                                                      ├─► T-020 download
                                                      └─► T-023 upload → T-024 share page
```

The same renderer produces the preview and the export; only `outputScale` differs. This is how FR-3.6 (preview == output) is guaranteed structurally rather than by discipline.

---

## Decision log

### ADR-001 · Generate in the browser, not on the server

**Decision:** Composite with Canvas in the client. No server-side image processing on the happy path.
**Why:** Removes an upload + round trip from the critical path (hits NFR-1). Nothing to scale. The photo never leaves the device, which makes the privacy claim true rather than a policy promise.
**Trade-off:** Rendering fidelity depends on the client's canvas + font stack. Mitigated by embedding fonts ([T-014](tasks/T-014-text-layout-engine.md)) and a cross-browser render diff in QA ([T-029](tasks/T-029-cross-device-qa.md)).
**Rejected:** Sharp/`node-canvas` on the server, or `@vercel/og`. Both add 300–1500 ms and an upload of the user's face to us for every single generation.

### ADR-002 · Render in a Web Worker with OffscreenCanvas

**Decision:** All decode + draw work happens off the main thread.
**Why:** A 12 MP decode plus a 2160 px composite will jank the main thread for hundreds of milliseconds. Off-thread keeps the slider at 60 fps.
**Trade-off:** Fonts must be registered in worker scope; slightly more plumbing.
**Fallback:** If `OffscreenCanvas` is unavailable, run the identical render function against a main-thread canvas. The renderer is written to be agnostic about which context it received.

### ADR-003 · Templates are declarative data, not code

**Decision:** Each design is a `TemplateSpec` object (slots, text boxes, asset layers, colours) interpreted by one generic renderer.
**Why:** NFR-2.3 — a designer changing the frame must not require a code change. It also makes Format B nearly free once Format A works, and makes templates snapshot-testable.
**Trade-off:** The spec must be expressive enough for the real design. Risk is real; mitigation is to write the spec _after_ seeing the actual brand kit ([T-004](tasks/T-004-template-spec-and-registry.md) depends on [T-003](tasks/T-003-brand-asset-intake.md)) and to allow an escape-hatch `custom` layer for anything the spec cannot express.

### ADR-004 · ~~No database in v1~~ — superseded by ADR-010

**Original decision:** Share IDs encode their own storage key. No table, no ORM, no migration.
**Why it held:** There was nothing to query. `id → /g/{id}.png` was a pure function, and a DB would have been infrastructure with no reader.
**Why it stopped holding:** see ADR-010. The premise — that the storage key is derivable from the id — is false once the object store assigns its own opaque keys.

### ADR-010 · Neon Postgres + Drizzle for the share record

**Decision:** One table, `passes`, written when someone shares. Drizzle ORM over Neon's HTTP driver.
**Why:** ADR-004 rested on `id → key` being a pure function. UploadThing (ADR-011) mints its own file keys, so `/share/[id]` has no way to find the image without somewhere to look it up — the DB now has the reader ADR-004 said it lacked. Having a row also makes "whoever filled in the form" a real record rather than a filename, which is what the organizers asked for.
**Why Neon over the alternatives:** the write is one statement with no transaction, so `neon-http` sends exactly one request — no pool, no handshake, nothing to keep warm across a cold start. A pooled TCP driver would spend more time connecting than inserting.
**Trade-off:** a service that can be down, and a migration to run before deploy. Contained: `POST /api/pass` answers 503 when `DATABASE_URL` is unset and the client degrades to download-only, so the primary path never depends on it.
**Scope:** display text the user typed, plus URLs to images they chose to publish. No contact details, no account. Deleting a row is the whole deletion story.

### ADR-011 · UploadThing instead of R2/S3 presigning

**Decision:** UploadThing holds the source photo and the rendered card PNGs.
**Why:** it is the same shape as ADR-006 — the browser still uploads directly to storage with a presigned URL and no bytes pass through this app — but the presign, the CDN, the file keys and the dashboard come with it instead of being four more things to configure and rotate. For a tool with two upload endpoints, the S3 client and the presigner were most of the storage code.
**Trade-off:** a vendor on the share path, and opaque file keys (which is what forced ADR-010). Storage URLs are validated against UploadThing's own hosts before being stored, so a forged `og:image` cannot be smuggled into a share page.

### ADR-012 · Rasterise the real card, do not re-draw it

**Decision:** the exported PNG is the on-page card, cloned into an SVG `foreignObject` with computed styles and assets inlined, painted to a canvas (`modern-screenshot`). Not a canvas renderer that redraws the pass from a `TemplateSpec`.
**Why:** the alternative is a second implementation of a layout that already exists and already renders correctly in `PassCard.tsx`. Two implementations of one design drift the first time a designer moves a rule, and the drift is invisible until someone downloads a card that does not match what they were shown. Rasterising the real DOM makes "the preview is the output" (FR-3.6) true by construction rather than by discipline.
**Why not `html2canvas`** (rejected in [05](05-tech-stack.md)): that objection was to *reimplementing CSS*, which is where html2canvas's fidelity goes wrong. `foreignObject` hands the layout back to the browser — there is no CSS approximation to get wrong.
**Cost:** measured at 0.8–1.4 s for the both-faces sheet at 2112×1668, across Chromium, WebKit and mobile Safari (`tests/e2e/export.spec.ts` asserts the budget). The first capture is the expensive one because it inlines both `next/font` faces, so it is spent early, in the background, as soon as the user shows any intent — and the whole set is rendered when the pass dialog opens, so by the time a button is pressed the files already exist.
**Trade-off:** the export surface must be laid out off-screen and untransformed (`CaptureSurface.tsx`) rather than photographing the interactive preview, which lives under a live `rotateY`.

### ADR-013 · WebP on the wire, PNG on disk and in `og:image`

**Decision:** the uploaded card sheet is WebP where the browser can encode it; the downloaded file and the OG crop stay PNG. JPEG is not used anywhere.

**Why, measured** — the same 2112×1668 sheet, one photo on flat brand colour:

| Format          | Chromium | WebKit                     |
| --------------- | -------- | -------------------------- |
| PNG             | 377 KB   | 337 KB                     |
| JPEG q0.92      | 384 KB   | 549 KB                     |
| WebP q0.9       | 161 KB   | _falls back to PNG_ 337 KB |

JPEG is the intuitive choice and is **worse than lossless** here — flat fills and hard type edges are exactly what it handles badly. WebP is 2.3× smaller than PNG, which is most of a second off the share tap.

**The WebKit caveat:** WebKit's canvas decodes WebP but does not encode it, and `toBlob` reports that by silently returning PNG rather than failing. So support is measured once (`canEncodeWebp`), `blob.type` is treated as authoritative, the file extension follows the actual bytes, and the file router accepts both types. On WebKit the "WebP" sheet is literally the same `File` as the download, so no second capture is spent producing identical bytes.

**Why the OG crop stays PNG:** it is read by crawlers, not browsers. X handles WebP; LinkedIn and several chat unfurlers do not, and the failure mode is a posted link with a blank preview — the one thing the file exists to prevent. Worth ~170 KB.

**Why the download stays PNG:** it is a file people keep and re-upload elsewhere, and `.webp` is what gets rejected by the one form that only takes PNG or JPEG.

### ADR-005 · Storage is optional and explicitly triggered

**Decision:** The bucket is only written to when the user chooses the link-share path.
**Why:** Keeps NFR-3.1 honest for the majority of users who just download.
**Trade-off:** Two share paths to build and test ([T-022](tasks/T-022-x-intent-share.md) / [T-025](tasks/T-025-native-share-sheet.md) vs [T-023](tasks/T-023-storage-presigned-upload.md) / [T-024](tasks/T-024-share-page-og.md)).

### ADR-006 · Presigned direct-to-storage upload

**Decision:** Browser PUTs the blob straight to R2/S3 using a short-lived presigned URL minted by `/api/share`.
**Why:** Avoids streaming a multi-megabyte body through a serverless function (body size limits, duration, cost).
**Trade-off:** The endpoint must be rate-limited and the presign scoped tightly — content-type pinned, content-length capped, single key, short TTL ([T-031](tasks/T-031-privacy-and-abuse.md)).

### ADR-007 · No generative AI anywhere in the pipeline

**Decision:** Deterministic 2D compositing. The builder title is a lookup + rules table, not an LLM call.
**Why:** The brief asks for near-instant. An inference call is 300 ms–several seconds, needs a key, can fail, can produce something embarrassing on someone's face card, and buys nothing the user can perceive.
**Trade-off:** Titles are less "creative". Mitigated by a curated table and a reroll button ([T-017](tasks/T-017-builder-title-generator.md)).
**Revisit if:** the organizers explicitly want AI-written titles — then add it as an optional enhancement _behind_ the deterministic default, never blocking the render.

### ADR-008 · Face detection is a progressive enhancement

**Decision:** Default framing is a geometric heuristic (centre-x, ~38 % from top). A lazy-loaded lightweight detector refines it when available, and a manual pan/zoom control is always present.
**Why:** Never let a model be on the critical path to first paint. Heuristic covers most photos; the manual control covers the rest with certainty.
**Trade-off:** Slightly worse automatic framing than an always-on detector. Worth it for the latency guarantee.

### ADR-009 · Single Next.js app, App Router

**Decision:** One repo, one deployable. Static landing + client bundle + two server routes.
**Why:** The only server needs are an OG-emitting page and a presign endpoint. Splitting into separate services would be ceremony.

---

## What we deliberately are not building

```
   ✗ Kafka / queues              nothing is async
   ✗ microservices               one deployable, three routes
   ✗ an ORM with a runtime       Drizzle compiles to SQL; no engine, no codegen step
   ✗ Redis                       rate limiting via edge KV or in-memory is enough
   ✗ Stable Diffusion / ComfyUI  we composite, we don't generate (ADR-007)
   ✗ GPU / Lambda pipeline       the client is the compute
   ✗ auth provider               requirement is: no login — the session cookie
                                 (proxy.ts) identifies a browser, not a person
```

## Failure posture

| If this breaks              | Consequence              | Designed behaviour                                                                      |
| --------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Storage / `/api/share` down | Link sharing unavailable | Download + native share still work; button shows the reason                             |
| Fonts fail to load          | Text metrics shift       | Metric-matched fallback; render never blocks on `document.fonts.ready` beyond a timeout |
| HEIC WASM chunk fails       | HEIC users blocked       | Explicit message with the iOS "save as JPEG" workaround                                 |
| `OffscreenCanvas` missing   | —                        | Main-thread canvas path, same code                                                      |
| Face detector chunk fails   | Slightly worse auto-crop | Silent fallback to heuristic                                                            |
| Photo is enormous (50 MP)   | Memory pressure          | Hard downscale before decode-to-bitmap; size cap at validation                          |

Nothing in this table takes the core "make a graphic and save it" flow down. That property is the point of putting the pipeline in the client.
