# 10 — Roadmap & Phases

> ⏰ **The real deadline is 11:59 pm, 13 Aug 2026** ([14](14-official-brief.md)) — five days, not ten. The ~10-day plan below is the unconstrained shape; the **five-day plan in [14 — Revised plan](14-official-brief.md#revised-plan)** is what to actually follow. "[If you have only two days](#if-you-have-only-two-days)" below remains the right instinct.

## Shape of the build

```
 P0 FOUNDATION      ██                    4 tasks   ~1 day
 P1 INGEST          ████                  5 tasks   ~1.5 days   ← HEIC lives here
 P2 FRAMING         ███                   3 tasks   ~1 day      ← the interesting math
 P3 RENDER ENGINE   █████                 5 tasks   ~2 days     ← the core
 P4 OUTPUT          ████                  4 tasks   ~1 day
 P5 SHARE           ████                  4 tasks   ~1.5 days
 P6 SHIP            ███████               7 tasks   ~2 days
                                          ──────    ─────────
                                          32        ~10 days (1 dev, focused)
```

Full task detail in [TASKLIST.md](TASKLIST.md).

## Dependency graph

```
   T-001 scaffold
     ├──► T-002 tokens/UI ──────────────────────────────┐
     └──► T-003 brand intake ──► T-004 template spec ───┤
                                                        │
   T-005 uploader ──► T-006 validate ──► T-007 heic ─┐  │
                                                     ├──► T-009 ingest
                                      T-008 exif ────┘        │
                                                              ▼
                                       T-010 coverFit ──► T-013 renderer core
                                          │  │                  │
                              T-011 face ──┘  └── T-012 crop     ├──► T-014 text
                                                                 │      │
                                                                 │      ├──► T-015 Format A
                                                                 │      └──► T-016 Format B
                                                                 │             ▲
                                                     T-017 titles ─────────────┤
                                                     T-018 form ───────────────┘
                                                                 │
                                                    T-021 preview┤
                                                                 ▼
                                                     T-019 export ──► T-020 download
                                                                 │
                                                     T-022 intent│
                                                     T-023 storage├──► T-024 share page
                                                     T-025 native ┘
                                                                 │
                        T-026 landing · T-027 states · T-028 perf ┤
                        T-029 QA · T-030 a11y · T-031 privacy ────┤
                                                                 ▼
                                                          T-032 deploy
```

**Critical path:** T-001 → T-003 → T-004 → T-013 → T-014 → T-015 → T-019 → T-020 → T-032.

T-003 is no longer a blocker: the kit was extracted from hhgoa.com on 8 Aug 2026 ([13](13-brand-identity.md)). What remains is cropping and re-exporting the event's own illustrations to frame sizes.

---

## Phase 0 — Foundation

**Goal:** a deployed empty app and a decision-free environment.

| Task                                               | Title                                        |
| -------------------------------------------------- | -------------------------------------------- |
| [T-001](tasks/T-001-scaffold-nextjs-app.md)        | Scaffold Next.js + TypeScript app            |
| [T-002](tasks/T-002-design-tokens-and-ui.md)       | Design tokens, Tailwind theme, UI primitives |
| [T-003](tasks/T-003-brand-asset-intake.md)         | Brand asset intake & optimization            |
| [T-004](tasks/T-004-template-spec-and-registry.md) | `TemplateSpec` type + registry skeleton      |

**Exit:** `npm run dev` renders a themed shell; `npm run build` passes; the harvested brand kit sits in `public/branding/` with a manifest ([13](13-brand-identity.md)).

## Phase 1 — Ingest

**Goal:** any photo a phone can produce becomes a normalized, upright `ImageBitmap`.

| Task                                         | Title                                       |
| -------------------------------------------- | ------------------------------------------- |
| [T-005](tasks/T-005-photo-uploader.md)       | PhotoUploader (picker, drag-drop, camera)   |
| [T-006](tasks/T-006-file-validation.md)      | Validation & guardrails                     |
| [T-007](tasks/T-007-heic-conversion.md)      | HEIC/HEIF decode                            |
| [T-008](tasks/T-008-exif-and-downscale.md)   | EXIF orientation + downscale                |
| [T-009](tasks/T-009-ingest-orchestration.md) | Ingest orchestration + capability detection |

**Exit:** all 8 orientation fixtures and all format fixtures load upright and correctly sized, verified on a real iPhone. This is the phase where the project most often quietly fails, so the fixture suite is a hard deliverable, not a nice-to-have.

## Phase 2 — Framing

**Goal:** every aspect ratio lands in the slot looking composed.

| Task                                              | Title                                  |
| ------------------------------------------------- | -------------------------------------- |
| [T-010](tasks/T-010-cover-fit-geometry.md)        | Cover-fit geometry + portrait bias     |
| [T-011](tasks/T-011-smart-subject-positioning.md) | Face-aware refinement (optional, lazy) |
| [T-012](tasks/T-012-manual-crop-control.md)       | Manual pan/zoom control                |

**Exit:** the aspect fixture set (portrait, landscape, square, 10000×100 panorama, 100×10000 strip) produces undistorted, in-bounds crops. Invariant tests green.

**MVP cut line:** T-011 is droppable. T-010 + T-012 together satisfy FR-2 acceptably.

## Phase 3 — Render engine

**Goal:** `TemplateSpec` in, real pixels out.

| Task                                            | Title                                    |
| ----------------------------------------------- | ---------------------------------------- |
| [T-013](tasks/T-013-canvas-renderer-core.md)    | Renderer core (worker + OffscreenCanvas) |
| [T-014](tasks/T-014-text-layout-engine.md)      | Font loading + text layout               |
| [T-015](tasks/T-015-format-a-pfp-frame.md)      | Format A — PFP frame                     |
| [T-016](tasks/T-016-format-b-builder-card.md)   | Format B — Builder ID card               |
| [T-017](tasks/T-017-builder-title-generator.md) | Builder title generator                  |

**Exit:** both templates render at 1× and 2× and match their design reference. Fonts are the real faces in the canvas output, verified by screenshot, not by inspection.

## Phase 4 — Output

**Goal:** the user holds a file.

| Task                                         | Title                                |
| -------------------------------------------- | ------------------------------------ |
| [T-018](tasks/T-018-builder-form.md)         | Builder form + validation            |
| [T-019](tasks/T-019-export-and-variants.md)  | Export to PNG/JPEG + size variants   |
| [T-020](tasks/T-020-download-action.md)      | Download action (desktop + iOS-safe) |
| [T-021](tasks/T-021-live-preview-surface.md) | Live preview surface & regeneration  |

**Exit:** a photo saved to the iOS camera roll from Safari, and to `~/Downloads` from desktop Chrome. **This is the demoable milestone** — the product is genuinely useful here even with nothing from Phase 5.

## Phase 5 — Share

**Goal:** one tap to a post.

| Task                                             | Title                                 |
| ------------------------------------------------ | ------------------------------------- |
| [T-022](tasks/T-022-x-intent-share.md)           | X intent share (caption prefill)      |
| [T-023](tasks/T-023-storage-presigned-upload.md) | Presigned upload API + storage        |
| [T-024](tasks/T-024-share-page-og.md)            | `/share/[id]` with OG + Twitter cards |
| [T-025](tasks/T-025-native-share-sheet.md)       | Native share sheet (files)            |

**Exit:** a real post on a test X account showing the graphic, via both routes described in [08](08-sharing-and-og.md).

**MVP cut line:** T-023 + T-024 are droppable together. T-022 + T-025 alone satisfy FR-5.1–5.3, which is most of the requirement.

## Phase 6 — Ship

**Goal:** it survives contact with real phones.

| Task                                                | Title                                    |
| --------------------------------------------------- | ---------------------------------------- |
| [T-026](tasks/T-026-landing-and-format-selector.md) | Landing page & format selector           |
| [T-027](tasks/T-027-states-loading-error.md)        | Loading / empty / error / offline states |
| [T-028](tasks/T-028-performance-budget.md)          | Performance budget & instrumentation     |
| [T-029](tasks/T-029-cross-device-qa.md)             | Cross-device QA matrix                   |
| [T-030](tasks/T-030-accessibility-pass.md)          | Accessibility pass                       |
| [T-031](tasks/T-031-privacy-and-abuse.md)           | Privacy notice, rate limiting, abuse     |
| [T-032](tasks/T-032-deploy-and-release.md)          | Deploy + release checklist               |

**Exit:** the [QA matrix](12-qa-and-testing.md) is green and the release checklist in T-032 is signed off.

---

## Milestones

| M      | Name             | Contains                            | You can demo…                          |
| ------ | ---------------- | ----------------------------------- | -------------------------------------- |
| **M1** | Pixels on screen | P0 + P1 + T-010 + T-013             | "any photo lands correctly in a frame" |
| **M2** | Downloadable     | + T-015, T-014, T-019, T-020, T-021 | the complete Format A product          |
| **M3** | Shareable        | + T-022, T-025, T-026, T-027        | land → post, on a phone                |
| **M4** | Both formats     | + T-016, T-017, T-018               | the Builder ID card                    |
| **M5** | Shipped          | + T-023, T-024, T-028…T-032         | public URL with working link previews  |

**M2 is the one that matters.** A polished Format A that reliably produces a beautiful file is a better outcome than two half-finished formats. If time compresses, protect M2 and push M4 out.

## If you have only two days

```
   Day 1   T-001 T-002 T-003(harvest assets) T-004
           T-005 T-006 T-007 T-008 T-009
           T-010 T-013

   Day 2   T-014 T-015 T-021 T-019 T-020
           T-012 T-022 T-025
           T-026 T-027 T-032
```

Result: a polished, fully working Format A with download and share, deployed. Deliberately dropped: T-011 (face detection), T-016–T-018 (Format B), T-023/T-024 (OG link route), T-028–T-031 (formal perf/a11y/privacy passes — do the obvious parts inline instead).

State the cuts explicitly in the README rather than leaving them to be discovered. A clearly-scoped complete thing reads far better than an ambitious partial thing.

## Risk register

| Risk                                           | Likelihood | Impact                         | Mitigation                                                                                           |
| ---------------------------------------------- | ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| ~~Brand assets arrive late~~                   | —          | —                              | **Resolved** — kit extracted from hhgoa.com ([13](13-brand-identity.md))                             |
| Five-day deadline, one submission              | High       | Critical                       | Protect M2; cut Format B, face detection, and the OG route ([14](14-official-brief.md#revised-plan)) |
| X post missing `#FrameInGoa`                   | Low        | **Total** — invalid submission | Hashtag in the default caption + verify the live tweet ([T-032](tasks/T-032-deploy-and-release.md))  |
| HEIC decode is slow on old phones              | Medium     | Medium — hurts "near-instant"  | Lazy chunk, honest determinate state, hard 25 MB cap                                                 |
| Auto-crop cuts faces badly                     | Medium     | High — visibly bad output      | Portrait bias by default + manual control always visible                                             |
| Canvas text renders in the wrong font          | Medium     | High — silently off-brand      | Await font load before any text draw; screenshot test ([T-014](tasks/T-014-text-layout-engine.md))   |
| iOS blocks or mangles the download             | Medium     | High — dead end for most users | Native share-sheet primary, blob-tab fallback ([T-020](tasks/T-020-download-action.md))              |
| X unfurl does not show the image               | Medium     | Medium — degrades the share    | Verify with a real post, not the validator alone; native route unaffected                            |
| Memory crash on multi-megapixel photos         | Low        | High                           | `MAX_EDGE` cap + `bitmap.close()` discipline                                                         |
| Template spec cannot express the real design   | Medium     | Medium — engine rework         | `custom` layer escape hatch (ADR-003)                                                                |
| Scope creep (gallery, accounts, AI)            | Medium     | Medium                         | The out-of-scope table in [02](02-requirements.md#out-of-scope-for-v1)                               |
| In-app browser (X/Instagram) blocks the picker | Low        | Medium                         | Detect and offer "open in Safari/Chrome" ([T-027](tasks/T-027-states-loading-error.md))              |
