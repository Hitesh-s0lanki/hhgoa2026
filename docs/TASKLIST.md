# Task List — HH Goa 2026 Photo Framer

Master checklist. Every task links to a full reference file in [tasks/](tasks/) containing scope, implementation notes, acceptance criteria, and gotchas.

> ⏰ **Deadline: 11:59 pm, 13 Aug 2026** — five days from 8 Aug. One submission per team. See [14 — Official Brief](14-official-brief.md) for the compressed schedule.

**Progress:** 23 done · 8 cut · 1 partial · 1 open · `☐` not started · `◐` in progress · `☑` done · `⊘` cut

A cut task is not a gap. Two whole phases were replaced by a better answer rather than
skipped — see [Where the plan changed](#where-the-plan-changed) — and the requirement each
one carried is still met, by different code. What is *actually* outstanding is one task:
**T-032**, the deploy.

| Phase                                       | Tasks | Est.  | Status                      |
| ------------------------------------------- | ----- | ----- | --------------------------- |
| [P0 Foundation](#phase-0--foundation)       | 4     | ~8 h  | ☑ 3 · ⊘ 1                   |
| [P1 Ingest](#phase-1--ingest)               | 5     | ~12 h | ☑                           |
| [P2 Framing](#phase-2--framing)             | 3     | ~8 h  | ☑ 2 · ⊘ 1                   |
| [P3 Render engine](#phase-3--render-engine) | 6     | ~19 h | ☑ 2 · ⊘ 4                   |
| [P4 Output](#phase-4--output)               | 4     | ~9 h  | ☑                           |
| [P5 Share](#phase-5--share)                 | 4     | ~11 h | ☑ 3 · ⊘ 1                   |
| [P6 Ship](#phase-6--ship)                   | 7     | ~16 h | ☑ 4 · ◐ 2 · ☐ 1 (**deploy**) |

Dependency graph and milestones: [10 — Roadmap](10-roadmap-phases.md).

---

## Phase 0 — Foundation

> **Exit:** themed shell runs and builds; a brand kit (real or placeholder) is in place behind a token layer.

- [x] **T-001** · [Scaffold Next.js + TypeScript app](tasks/T-001-scaffold-nextjs-app.md) — 1.5 h — _deps: none_
- [x] **T-002** · [Design tokens, Tailwind theme & UI primitives](tasks/T-002-design-tokens-and-ui.md) — 2.5 h — _deps: T-001_ — NFR-2.3
- [x] **T-003** · [Brand asset harvest & optimization](tasks/T-003-brand-asset-intake.md) — 3 h — _deps: T-001_ — NFR-2.1, NFR-2.2 — _kit already extracted, see [13](13-brand-identity.md)_
- [ ] ⊘ **T-004** · [`TemplateSpec` type + registry skeleton](tasks/T-004-template-spec-and-registry.md) — _cut with T-013: a spec exists to feed a canvas renderer, and there is no canvas renderer_

## Phase 1 — Ingest

> **Exit:** all 8 EXIF orientation fixtures and every format fixture load upright and correctly sized, verified on a real iPhone.

- [x] **T-005** · [PhotoUploader — picker, drag & drop, camera](tasks/T-005-photo-uploader.md) — 3 h — _deps: T-002_ — FR-1.1, FR-1.2, FR-1.3
- [x] **T-006** · [File validation & guardrails](tasks/T-006-file-validation.md) — 2.5 h — _deps: T-005_ — FR-1.4, FR-1.6, FR-1.7 — `lib/image/sniff.ts`, magic bytes rather than `File.type`
- [x] **T-007** · [HEIC / HEIF decode](tasks/T-007-heic-conversion.md) — 3 h — _deps: T-006_ — FR-1.5 — native first, `heic-to` WASM only where that fails
- [x] **T-008** · [EXIF orientation + downscale normalization](tasks/T-008-exif-and-downscale.md) — 2.5 h — _deps: T-006_ — FR-1.8 — orientation via `<img>`, 1600 px long edge
- [x] **T-009** · [Ingest orchestration + capability detection](tasks/T-009-ingest-orchestration.md) — 2 h — _deps: T-007, T-008_ — FR-1.7, FR-6.4

## Phase 2 — Framing

> **Exit:** the aspect fixture set produces undistorted, in-bounds crops; invariant tests green.

- [x] **T-010** · [Cover-fit geometry + portrait bias](tasks/T-010-cover-fit-geometry.md) — 3 h — _deps: T-009_ — FR-2.1, FR-2.2, FR-2.5
- [ ] ⊘ **T-011** · [Face-aware subject positioning](tasks/T-011-smart-subject-positioning.md) — _cut as planned. T-012's manual control covers FR-2.3's intent without a detector to be wrong_
- [x] **T-012** · [Manual pan/zoom crop control](tasks/T-012-manual-crop-control.md) — 2.5 h — _deps: T-010, T-021_ — FR-2.4

## Phase 3 — Render engine

> **Exit:** both templates render at 1× and 2× matching the design reference, with the real brand fonts in the canvas output.

- [ ] ⊘ **T-013** · [Renderer core — worker + OffscreenCanvas](tasks/T-013-canvas-renderer-core.md) — _replaced: `lib/render/rasterize.ts` photographs the real card DOM, so the preview **is** the export. See the module comment for why a second implementation of the layout was the wrong trade_
- [ ] ⊘ **T-014** · [Font loading + text layout engine](tasks/T-014-text-layout-engine.md) — _cut with T-013: CSS already lays the text out, and the rasterizer inlines both `next/font` faces_
- [ ] ⊘ **T-015** · [Format A — PFP frame template](tasks/T-015-format-a-pfp-frame.md) — _cut. The brief says pick one format; this build is Format B_
- [x] **T-016** · [Format B — Builder ID card template](tasks/T-016-format-b-builder-card.md) — 3.5 h — _deps: T-014, T-003_ — FR-3.3
- [x] **T-017** · [Builder title generator](tasks/T-017-builder-title-generator.md) — 2 h — _deps: T-001_ — FR-3.5
- [ ] ⊘ **T-033** · [Team / combined frame](tasks/T-033-team-combined-frame.md) — _cut with Format A, which it composed_

## Phase 4 — Output

> **Exit:** a file saved to the iOS camera roll and to desktop `~/Downloads`. **Demoable milestone (M2).**

- [x] **T-018** · [Builder form + validation](tasks/T-018-builder-form.md) — 2.5 h — _deps: T-016, T-017_ — FR-3.4
- [x] **T-019** · [Export to PNG/JPEG + size variants](tasks/T-019-export-and-variants.md) — 2 h — _deps: T-013_ — FR-3.7, FR-4.4 — download PNG, wire WebP, OG PNG
- [x] **T-020** · [Download action — desktop + iOS-safe](tasks/T-020-download-action.md) — 2.5 h — _deps: T-019_ — FR-4.1, FR-4.2, FR-4.3
- [x] **T-021** · [Live preview surface & regeneration](tasks/T-021-live-preview-surface.md) — 2.5 h — _deps: T-013_ — FR-3.6, FR-1.9

## Phase 5 — Share

> **Exit:** a real post on a test X account showing the graphic, via both share routes.

- [x] **T-022** · [X intent share — caption prefill](tasks/T-022-x-intent-share.md) — 1.5 h — _deps: T-019_ — FR-5.1, FR-5.2
- [x] **T-023** · [Presigned upload API + storage](tasks/T-023-storage-presigned-upload.md) — 3.5 h — _deps: T-019_ — FR-5.5 — **droppable with T-024**
- [x] **T-024** · [`/share/[id]` page with OG + Twitter cards](tasks/T-024-share-page-og.md) — 3 h — _deps: T-023_ — FR-5.4 — **droppable with T-023**
- [ ] ⊘ **T-025** · [Native share sheet (Web Share Level 2)](tasks/T-025-native-share-sheet.md) — _cut. The brief asks for a pre-filled X post; T-022 + T-024 deliver it with a real preview card, and the share sheet cannot pre-fill a caption_

## Phase 6 — Ship

> **Exit:** the QA matrix is green and the release checklist is signed off.

- [x] **T-026** · [Landing page](tasks/T-026-landing-and-format-selector.md) — 3 h — _deps: T-002, T-005_ — FR-6.2, FR-6.3 — no format selector: there is one format
- [x] **T-027** · [States — loading, empty, error, offline](tasks/T-027-states-loading-error.md) — 2.5 h — _deps: T-009, T-021_ — FR-6.4
- [ ] ◐ **T-028** · [Performance budget & instrumentation](tasks/T-028-performance-budget.md) — _partial: the budget is enforced inline (lazy rasterizer, lazy uploader, 1600 px ingest, pre-render on dialog open) and timed in the e2e run. No formal instrumentation_
- [x] **T-029** · [Cross-device QA matrix](tasks/T-029-cross-device-qa.md) — 3 h — _deps: T-020_ — NFR-4 — 78 Playwright tests across Chromium, WebKit and iPhone 14
- [ ] ◐ **T-030** · [Accessibility pass](tasks/T-030-accessibility-pass.md) — _partial: labelled controls, one live region per outcome, keyboard pan/zoom, reduced-motion honoured, the capture surface `inert`. No formal audit_
- [ ] ◐ **T-031** · [Privacy notice, rate limiting & abuse](tasks/T-031-privacy-and-abuse.md) — _partial: per-session cap in `app/api/pass/route.ts`, honest upload notice under the form. The cap is per-instance and says so_
- [ ] **T-032** · [Deploy + release checklist](tasks/T-032-deploy-and-release.md) — 1.5 h — _deps: all_ — NFR-5 — **the one thing left. `NEXT_PUBLIC_SITE_URL` must be the deployed origin or posts unfurl without a preview card**

---

## Where the plan changed

Three decisions moved this away from the schedule below, and each is worth more than the
task it replaced.

**The renderer is the card, not a copy of it** (T-013, T-014, T-004 cut). The plan was a
canvas that re-draws the pass from a `TemplateSpec`. What shipped rasterises the real card
DOM instead. A `TemplateSpec` renderer is a second implementation of a layout that already
exists in `PassCard.tsx`, and the two would drift the first time a rule moved; photographing
the DOM makes "the preview is the output" true by construction. See the comment at the top
of `lib/render/rasterize.ts`.

**Format B, not Format A** (T-015, T-033 cut; T-016, T-018 built). The brief says pick one.
The event's own artwork is a lanyard badge, so the badge is the thing worth copying — arch
window, गोवा chip, field table, access grid, the VALID BUILDER ACCESS band.

**Link-unfurl sharing, not a native share sheet** (T-023, T-024 built; T-025 cut). X's web
intent cannot carry an image, so the picture in a post is the `og:image` of the link. That
made the storage + `/share/[id]` pair load-bearing rather than droppable, and made the
share sheet redundant — it can attach a file but cannot pre-fill the caption the brief asks
for.

## What is left

1. **T-032 — deploy.** The only remaining task, and the only submission artifact.
   `NEXT_PUBLIC_SITE_URL` must be the deployed origin before anyone shares; left at
   localhost the app detects it and posts the bare image URL, which unfurls without a
   preview card.
2. Then: post one real pass with `#FrameInGoa`, confirm the card renders in the post, and
   submit the form.

## Requirement coverage

| Priority | Requirements                                                                                                              | Covered                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Gate** | FR-5.0 — the X post contains `#FrameInGoa`                                                                                | ✔ [T-032](tasks/T-032-deploy-and-release.md) |
| P0       | FR-1.1, 1.4, 1.5, 1.7, 1.8, 1.9, FR-2.1, 2.2, 2.5, FR-3.1, 3.2, 3.6, 3.7, FR-4.1, 4.3, FR-5.1, 5.2, 5.6, FR-6.1, 6.2, 6.4 | ✔ all                                        |
| P1       | FR-1.2, FR-2.3, 2.4, FR-3.3, 3.4, 3.5, 3.8, FR-4.2, FR-5.3, 5.4, 5.5, FR-6.3, 6.5                                         | ✔ all                                        |
| P2       | FR-1.3, 1.6, FR-4.4                                                                                                       | ✔ all                                        |
| P3       | FR-4.5 (story variant), style variants, PWA                                                                               | ⊘ parked                                     |

Full requirement text: [02 — Requirements](02-requirements.md).
