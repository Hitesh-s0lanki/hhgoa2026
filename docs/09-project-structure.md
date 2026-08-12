# 09 — Project Structure

## Layout

```
hhgoa2026/
├── app/
│   ├── layout.tsx                  root layout, font registration, metadata defaults
│   ├── page.tsx                    landing + the whole tool (single-page flow)
│   ├── globals.css                 tailwind entry + brand CSS vars
│   ├── opengraph-image.tsx         static OG card for the site itself
│   ├── share/
│   │   └── [id]/
│   │       ├── page.tsx            human-facing shared graphic + CTA
│   │       └── not-found.tsx       "this one expired" page
│   └── api/
│       └── share/
│           └── route.ts            POST → { id, uploadUrl, shareUrl }
│
├── components/
│   ├── uploader/
│   │   ├── PhotoUploader.tsx       drop zone + file input + camera capture
│   │   └── UploadHint.tsx          accepted formats, privacy line
│   ├── editor/
│   │   ├── EditorShell.tsx         orchestrates preview + controls per format
│   │   ├── PreviewCanvas.tsx       the visible <canvas>, DPR-aware sizing
│   │   ├── CropControl.tsx         pinch/drag surface + zoom slider
│   │   ├── BuilderForm.tsx         name / role / stack inputs (Format B)
│   │   └── BuilderTitleField.tsx   derived title + reroll + manual edit
│   ├── actions/
│   │   ├── DownloadButton.tsx      desktop <a download> / mobile share-save
│   │   └── ShareButton.tsx         route selection (native / link / download+intent)
│   ├── FormatSelector.tsx          PFP Frame ↔ Builder ID
│   ├── states/
│   │   ├── ErrorNotice.tsx         recoverable inline errors
│   │   └── Converting.tsx          the only legitimate progress state (HEIC)
│   └── ui/                         shadcn primitives (button, slider, input, …)
│
├── lib/
│   ├── types.ts                    NormalizedImage, Transform, Fields, RenderRequest
│   ├── capabilities.ts             one place for every feature-detect
│   ├── store.ts                    zustand store = the state machine from doc 03
│   │
│   ├── image/
│   │   ├── validate.ts             size cap, magic-byte sniff, dimension checks
│   │   ├── decode.ts               createImageBitmap + HEIC fallback
│   │   ├── heic.ts                 lazy wrapper around the wasm decoder
│   │   ├── normalize.ts            EXIF orientation + downscale to MAX_EDGE
│   │   ├── fit.ts                  coverFit(), portrait bias — pure, tested
│   │   └── face.ts                 lazy detector, time-boxed, optional
│   │
│   ├── render/
│   │   ├── render.ts               the one renderer, template-driven
│   │   ├── layers.ts               fill / gradient / image / photo draw fns
│   │   ├── text.ts                 shrink → wrap → ellipsis layout engine
│   │   ├── shapes.ts               rounded-rect and circle clip/stroke paths
│   │   ├── assets.ts               preload + module-level cache
│   │   ├── fonts.ts                FontFace registration (main + worker scope)
│   │   ├── export.ts               blob encode, scale variants, filename
│   │   └── worker.ts               OffscreenCanvas host + message protocol
│   │
│   ├── templates/
│   │   ├── types.ts                TemplateSpec, Layer, Norm, Rect
│   │   ├── index.ts                registry + defaultTemplateId
│   │   ├── pfp-frame.ts            Format A
│   │   ├── builder-card.ts         Format B
│   │   ├── team-2.ts  team-3.ts  team-4.ts      combined team frames (T-033)
│   │   └── custom/
│   │       ├── index.ts            named custom-layer registry
│   │       └── sun.ts              procedural radiating sun
│   │
│   ├── brand/
│   │   ├── tokens.ts               colours, fonts, radii — single source of truth
│   │   └── titles.ts               role → builder-title rules + curated pool
│   │                               (tokens = the real hhgoa.com palette, doc 13)
│   │
│   └── share/
│       ├── caption.ts              the one caption string
│       ├── intent.ts               x.com/intent/post URL builder
│       ├── native.ts               navigator.share wrapper + canShareFiles
│       └── upload.ts               presign request + direct PUT
│
├── public/
│   └── branding/
│       ├── MANIFEST.md             source, retrieval date, licence per asset
│       ├── wordmark.png            yellow Imbue caps + black offset
│       ├── palms.png               2160 px, alpha — frame columns
│       ├── flowers.png             bottom band
│       ├── goa-devanagari.svg      "गोवा"
│       └── fonts/
│           ├── display.woff2       Imbue, subset
│           └── body.woff2          Victor Mono, subset
│
├── tests/
│   ├── unit/
│   │   ├── fit.test.ts             the aspect-ratio invariants
│   │   ├── text.test.ts            shrink/wrap/ellipsis
│   │   ├── titles.test.ts          determinism + coverage of role inputs
│   │   └── validate.test.ts        magic bytes incl. HEIC brands
│   ├── fixtures/
│   │   ├── orientation/            8 EXIF orientation JPEGs
│   │   ├── aspect/                 portrait, landscape, square, panorama, strip
│   │   └── formats/                jpeg, png, webp, heic, corrupt, zero-byte
│   └── e2e/
│       ├── happy-path.spec.ts      upload → preview → download
│       └── visual.spec.ts          template screenshot comparison
│
├── docs/                           ← you are here
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Ownership rules

The value of this layout is the boundaries, not the folder names. Four rules keep it honest:

### 1 · `lib/render/**` never imports React

The renderer takes a 2D context and a data structure. It must be callable from a worker, from a Node test, and from a main-thread canvas without change. If a file under `lib/render/` imports from `react` or `next`, the layering has broken.

### 2 · `components/**` contains no image math

No `drawImage`, no aspect-ratio arithmetic, no `Math.min(slotW/imgW, …)` inside a component. Components read state and dispatch intent. All geometry lives in `lib/image/fit.ts`. This is what makes the crop logic unit-testable without a DOM.

### 3 · `lib/templates/**` is data

Template files export objects. The only executable code they may reference is a named entry in the `custom/` registry. A template that needs an `if` statement is a signal that the spec needs one more declarative field — extend `Layer`, not the template.

### 4 · Server-only modules stay server-only

Anything reading `DATABASE_URL` or `UPLOADTHING_TOKEN` is reachable only from a route handler. `lib/db/*` and `lib/session-server.ts` carry `import "server-only"`, which turns "someone imported this into a client component" from a leaked secret into a build error.

The client half (`lib/upload/client.ts`) only ever talks to our own endpoint and then to a presigned URL. It imports the file router **as a type only** — `import type { PassFileRouter }` — so the endpoint names stay compile-checked while the server module it lives in is erased from the bundle.

Two client modules are additionally required to be dynamic (`docs/05` bundle rule, >50 KB): `uploadthing/client`, which drags `effect` behind it, and `modern-screenshot`. Both are behind `import()` and pre-warmed on first user intent, never imported at module scope.

## Import aliases

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./*"],
      "@/lib/*": ["./lib/*"],
      "@/components/*": ["./components/*"],
    },
  },
}
```

`noUncheckedIndexedAccess` is worth the friction here: the template layer arrays and the title tables are indexed constantly, and it catches the exact class of bug that renders a blank layer.

## The store

The whole app state, mirroring the machine in [doc 03](03-user-flows.md#state-machine):

```ts
// lib/store.ts
type Status = "idle" | "validating" | "decoding" | "ready" | "rendering" | "uploading" | "error";

type State = {
  status: Status;
  error: { code: string; message: string; recoverable: true } | null;

  templateId: TemplateId;
  image: NormalizedImage | null;
  transform: Transform;
  fields: Fields;

  previewBlobUrl: string | null;
  exportBlob: Blob | null; // generated eagerly, so share has it ready
  shareUrl: string | null;
};
```

Keeping `status` as one union rather than several booleans is what makes the twelve unhappy paths in [doc 03](03-user-flows.md#unhappy-paths) enumerable instead of emergent.

## Naming conventions

| Thing          | Convention                                    | Example                                       |
| -------------- | --------------------------------------------- | --------------------------------------------- |
| Components     | `PascalCase.tsx`, default export              | `PreviewCanvas.tsx`                           |
| Modules        | `kebab-case.ts` or single word, named exports | `fit.ts`, `builder-card.ts`                   |
| Pure functions | verb-first                                    | `coverFit`, `deriveTitle`, `layoutText`       |
| Types          | `PascalCase`, no `I` prefix                   | `TemplateSpec`, `NormalizedImage`             |
| Constants      | `SCREAMING_SNAKE` at module top               | `MAX_EDGE`, `PORTRAIT_BIAS`                   |
| Test files     | mirror source path                            | `lib/image/fit.ts` → `tests/unit/fit.test.ts` |
| Commits        | `type(scope): summary (T-0xx)`                | `feat(render): text layout engine (T-014)`    |

## Where to add a new design

The five-minute test for whether the architecture held:

1. Add `lib/templates/speaker-badge.ts`.
2. Add one line to the registry in `lib/templates/index.ts`.
3. Drop any new artwork into `public/branding/` and record it in `MANIFEST.md`.
4. Add a screenshot case to `tests/e2e/visual.spec.ts`.

If step 5 is "also change the renderer", something in [06](06-brand-and-templates.md) needs another declarative field.
