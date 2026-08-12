# 02 — Requirements

The brief, decoded into testable statements. Each requirement has an ID so tasks and QA can reference it.

> **Source of truth:** [14 — The Official Brief](14-official-brief.md). Every requirement below traces to it. Deadline **11:59 pm, 13 Aug 2026**; one submission per team.

Legend: **P0** = must ship · **P1** = strongly expected · **P2** = nice to have · **P3** = only if time remains

---

## Functional requirements

### FR-1 · Ingest

| ID     | Requirement                                                    | Priority | Task                                         |
| ------ | -------------------------------------------------------------- | -------- | -------------------------------------------- |
| FR-1.1 | User can select a photo via file picker                        | P0       | [T-005](tasks/T-005-photo-uploader.md)       |
| FR-1.2 | User can drag & drop a photo (desktop)                         | P1       | [T-005](tasks/T-005-photo-uploader.md)       |
| FR-1.3 | User can take a photo with the device camera                   | P2       | [T-005](tasks/T-005-photo-uploader.md)       |
| FR-1.4 | Accepts JPEG and PNG                                           | P0       | [T-006](tasks/T-006-file-validation.md)      |
| FR-1.5 | Accepts HEIC / HEIF and converts it transparently              | P0       | [T-007](tasks/T-007-heic-conversion.md)      |
| FR-1.6 | Accepts WebP                                                   | P2       | [T-006](tasks/T-006-file-validation.md)      |
| FR-1.7 | Rejects unsupported / corrupt files with a recoverable message | P0       | [T-006](tasks/T-006-file-validation.md)      |
| FR-1.8 | Honours EXIF orientation so photos are never sideways          | P0       | [T-008](tasks/T-008-exif-and-downscale.md)   |
| FR-1.9 | User can replace the photo without reloading the page          | P0       | [T-021](tasks/T-021-live-preview-surface.md) |

### FR-2 · Fit & framing

| ID     | Requirement                                                                  | Priority | Task                                              |
| ------ | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------- |
| FR-2.1 | Any aspect ratio fills the photo slot with no letterboxing and no distortion | P0       | [T-010](tasks/T-010-cover-fit-geometry.md)        |
| FR-2.2 | Portrait, landscape, and square inputs all produce a sensible crop           | P0       | [T-010](tasks/T-010-cover-fit-geometry.md)        |
| FR-2.3 | Off-centre subjects are biased toward being framed, not cut off              | P1       | [T-011](tasks/T-011-smart-subject-positioning.md) |
| FR-2.4 | User can nudge the crop (pan / zoom) if the automatic result is wrong        | P1       | [T-012](tasks/T-012-manual-crop-control.md)       |
| FR-2.5 | The user is **never** asked to pre-crop or resize before uploading           | P0       | all of Phase 2                                    |

### FR-3 · Generate

| ID     | Requirement                                                             | Priority | Task                                            |
| ------ | ----------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| FR-3.1 | Output is a genuine raster image file, not a DOM screenshot             | P0       | [T-013](tasks/T-013-canvas-renderer-core.md)    |
| FR-3.2 | Format A (PFP frame) renders correctly                                  | P0       | [T-015](tasks/T-015-format-a-pfp-frame.md)      |
| FR-3.3 | Format B (Builder ID card) renders correctly                            | P1       | [T-016](tasks/T-016-format-b-builder-card.md)   |
| FR-3.4 | Text fields (name / role / stack) render without overflow at any length | P1       | [T-014](tasks/T-014-text-layout-engine.md)      |
| FR-3.5 | A "builder title" is derived from the user's role                       | P1       | [T-017](tasks/T-017-builder-title-generator.md) |
| FR-3.6 | Live preview matches the exported file pixel-for-pixel (proportionally) | P0       | [T-021](tasks/T-021-live-preview-surface.md)    |
| FR-3.7 | Output resolution is at least 1080 px on the short edge                 | P0       | [T-019](tasks/T-019-export-and-variants.md)     |
| FR-3.8 | 2–4 photos can be combined into one team frame                          | P1       | [T-033](tasks/T-033-team-combined-frame.md)     |

### FR-4 · Output

| ID     | Requirement                                                       | Priority | Task                                        |
| ------ | ----------------------------------------------------------------- | -------- | ------------------------------------------- |
| FR-4.1 | User can download the result as PNG                               | P0       | [T-020](tasks/T-020-download-action.md)     |
| FR-4.2 | Filename is meaningful (e.g. `hh-goa-2026-hitesh.png`)            | P1       | [T-020](tasks/T-020-download-action.md)     |
| FR-4.3 | Saving works on iOS Safari (where `download` behaves differently) | P0       | [T-020](tasks/T-020-download-action.md)     |
| FR-4.4 | JPEG variant available for smaller share payloads                 | P2       | [T-019](tasks/T-019-export-and-variants.md) |
| FR-4.5 | Story / 9:16 variant available                                    | P3       | [T-019](tasks/T-019-export-and-variants.md) |

### FR-5 · Share to X

| ID     | Requirement                                                                   | Priority      | Task                                             |
| ------ | ----------------------------------------------------------------------------- | ------------- | ------------------------------------------------ |
| FR-5.0 | The submitted X post contains a literal `#FrameInGoa`                         | **P0 — gate** | [T-032](tasks/T-032-deploy-and-release.md)       |
| FR-5.1 | "Share on X" opens X with the caption pre-filled                              | P0            | [T-022](tasks/T-022-x-intent-share.md)           |
| FR-5.2 | Caption includes the campaign hashtag (`#FrameInGoa`)                         | P0            | [T-022](tasks/T-022-x-intent-share.md)           |
| FR-5.3 | On mobile, the native share sheet can hand the actual image file to the X app | P1            | [T-025](tasks/T-025-native-share-sheet.md)       |
| FR-5.4 | If sharing a link, the link's preview shows the generated graphic             | P1            | [T-024](tasks/T-024-share-page-og.md)            |
| FR-5.5 | Generated images can be persisted to storage to support FR-5.4                | P1            | [T-023](tasks/T-023-storage-presigned-upload.md) |
| FR-5.6 | Uploading to our storage is explicit and disclosed, never silent              | P0            | [T-031](tasks/T-031-privacy-and-abuse.md)        |

### FR-6 · Shell & UX

| ID     | Requirement                                                | Priority | Task                                                |
| ------ | ---------------------------------------------------------- | -------- | --------------------------------------------------- |
| FR-6.1 | No login, signup, email capture, or onboarding anywhere    | P0       | — (architectural)                                   |
| FR-6.2 | Landing page communicates the value and CTA above the fold | P0       | [T-026](tasks/T-026-landing-and-format-selector.md) |
| FR-6.3 | User can choose between Format A and Format B              | P1       | [T-026](tasks/T-026-landing-and-format-selector.md) |
| FR-6.4 | Every failure state is recoverable in-place                | P0       | [T-027](tasks/T-027-states-loading-error.md)        |
| FR-6.5 | Works keyboard-only and with a screen reader               | P1       | [T-030](tasks/T-030-accessibility-pass.md)          |

---

## Non-functional requirements

### NFR-1 · Performance ("near-instant")

The brief's real requirement is _perceived_ speed. Budgets, measured on a mid-tier Android (throttled 4× CPU) with a 12 MP photo:

| Stage                                | Budget              | Notes                                      |
| ------------------------------------ | ------------------- | ------------------------------------------ |
| Largest Contentful Paint on landing  | ≤ 1.5 s on 4G       | Static page, no blocking JS                |
| File selected → decoded bitmap ready | ≤ 600 ms (JPEG/PNG) | `createImageBitmap`, off main thread       |
| File selected → decoded bitmap ready | ≤ 2.5 s (HEIC)      | WASM decode; show a real determinate state |
| Bitmap ready → first preview painted | ≤ 300 ms            | Renderer in a worker                       |
| Any control change → preview repaint | ≤ 100 ms            | Feels live, not "regenerating"             |
| Export blob produced                 | ≤ 500 ms            | 1080–2160 px PNG                           |
| Total JS shipped on first load       | ≤ 200 KB gzip       | HEIC + face detector are lazy chunks       |

Explicit anti-requirement: **no fake progress, no multi-step "AI thinking" copy.** Owned by [T-028](tasks/T-028-performance-budget.md).

### NFR-2 · Brand fidelity

| ID      | Requirement                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| NFR-2.1 | Uses the official HH Goa 2026 logo, palette, and typefaces                    |
| NFR-2.2 | Design reads as an event asset, not a photo with a logo pasted on it          |
| NFR-2.3 | Templates are data, so a designer's change does not require an engine rewrite |
| NFR-2.4 | Renders identically across browsers (fonts embedded, not system-dependent)    |

Owned by [T-003](tasks/T-003-brand-asset-intake.md), [T-004](tasks/T-004-template-spec-and-registry.md), [T-014](tasks/T-014-text-layout-engine.md).

### NFR-3 · Privacy

| ID      | Requirement                                                   |
| ------- | ------------------------------------------------------------- |
| NFR-3.1 | Default path: the photo never leaves the device               |
| NFR-3.2 | Nothing is uploaded without an explicit user action           |
| NFR-3.3 | Stated in plain language in the UI, not only in a policy page |
| NFR-3.4 | Stored share images expire automatically (lifecycle rule)     |
| NFR-3.5 | No analytics event ever carries image data or personal text   |

### NFR-4 · Compatibility

Support matrix and pass criteria live in [QA & Testing](12-qa-and-testing.md). Summary: iOS Safari 16+, Android Chrome 110+, desktop Chrome / Safari / Firefox / Edge current, plus the in-app browsers of X, Instagram, and WhatsApp.

### NFR-5 · Operability

| ID      | Requirement                                                                   |
| ------- | ----------------------------------------------------------------------------- |
| NFR-5.1 | Deployable to Vercel from `main` with zero manual steps                       |
| NFR-5.2 | No database required for v1                                                   |
| NFR-5.3 | Storage credentials server-side only; browser uses short-lived presigned URLs |
| NFR-5.4 | Share-upload endpoint is rate-limited                                         |

---

## Out of scope for v1

Recorded so they do not creep in. Any of these becomes a change request, not a bug.

| Item                                          | Reason                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| User accounts, saved history                  | Requirement says no login                                               |
| Database                                      | Nothing needs to persist beyond a share image blob                      |
| AI face swap / restyling / background removal | Adds latency and uncanny risk; not asked for                            |
| Video or animated output                      | Not in the brief                                                        |
| Admin dashboard, moderation queue             | No public gallery exists to moderate                                    |
| i18n                                          | Single-language event audience                                          |
| Instagram / LinkedIn direct posting           | Neither offers a web post-composer intent; native share sheet covers it |
| Print-resolution (300 DPI) export             | Digital-only use case                                                   |

## Traceability

Every P0 has at least one task, and every task in [TASKLIST.md](TASKLIST.md) names the requirements it satisfies. If a task satisfies nothing, it is scope creep; if a P0 has no task, the plan is incomplete.
