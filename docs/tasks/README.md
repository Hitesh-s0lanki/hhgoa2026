# Task Reference Files

One file per task. Start from [../TASKLIST.md](../TASKLIST.md) — it is the checklist; these are the specs.

## Structure of every task file

| Section                  | What it is for                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Header table**         | Phase, status, estimate, dependencies, what it blocks, requirements satisfied                     |
| **Why this exists**      | The problem being solved, so the task can be re-scoped intelligently rather than followed blindly |
| **Scope**                | Explicit in / out. The out-list is the more useful half.                                          |
| **Implementation notes** | Concrete approach, usually with the real code. A starting point, not a mandate.                   |
| **Acceptance criteria**  | Checkboxes. When they are all ticked, the task is done.                                           |
| **Files touched**        | Where the work lands, per [../09-project-structure.md](../09-project-structure.md)                |
| **How to test**          | The specific verification for this task                                                           |
| **Gotchas**              | The things that will actually cost you an afternoon                                               |
| **References**           | Links to the design docs and external specs                                                       |

## Index

### Phase 0 — Foundation

- [T-001](T-001-scaffold-nextjs-app.md) Scaffold Next.js + TypeScript app
- [T-002](T-002-design-tokens-and-ui.md) Design tokens, Tailwind theme & UI primitives
- [T-003](T-003-brand-asset-intake.md) Brand asset harvest & optimization
- [T-004](T-004-template-spec-and-registry.md) `TemplateSpec` type + registry skeleton

### Phase 1 — Ingest

- [T-005](T-005-photo-uploader.md) PhotoUploader — picker, drag & drop, camera
- [T-006](T-006-file-validation.md) File validation & guardrails
- [T-007](T-007-heic-conversion.md) HEIC / HEIF decode
- [T-008](T-008-exif-and-downscale.md) EXIF orientation + downscale normalization
- [T-009](T-009-ingest-orchestration.md) Ingest orchestration + capability detection

### Phase 2 — Framing

- [T-010](T-010-cover-fit-geometry.md) Cover-fit geometry + portrait bias
- [T-011](T-011-smart-subject-positioning.md) Face-aware subject positioning
- [T-012](T-012-manual-crop-control.md) Manual pan/zoom crop control

### Phase 3 — Render engine

- [T-013](T-013-canvas-renderer-core.md) Renderer core — worker + OffscreenCanvas
- [T-014](T-014-text-layout-engine.md) Font loading + text layout engine
- [T-015](T-015-format-a-pfp-frame.md) Format A — PFP frame template
- [T-016](T-016-format-b-builder-card.md) Format B — Builder ID card template
- [T-017](T-017-builder-title-generator.md) Builder title generator
- [T-033](T-033-team-combined-frame.md) Team / combined frame

### Phase 4 — Output

- [T-018](T-018-builder-form.md) Builder form + validation
- [T-019](T-019-export-and-variants.md) Export to PNG/JPEG + size variants
- [T-020](T-020-download-action.md) Download action — desktop + iOS-safe
- [T-021](T-021-live-preview-surface.md) Live preview surface & regeneration

### Phase 5 — Share

- [T-022](T-022-x-intent-share.md) X intent share — caption prefill
- [T-023](T-023-storage-presigned-upload.md) Presigned upload API + storage
- [T-024](T-024-share-page-og.md) `/share/[id]` page with OG + Twitter cards
- [T-025](T-025-native-share-sheet.md) Native share sheet (Web Share Level 2)

### Phase 6 — Ship

- [T-026](T-026-landing-and-format-selector.md) Landing page & format selector
- [T-027](T-027-states-loading-error.md) States — loading, empty, error, offline
- [T-028](T-028-performance-budget.md) Performance budget & instrumentation
- [T-029](T-029-cross-device-qa.md) Cross-device QA matrix
- [T-030](T-030-accessibility-pass.md) Accessibility pass
- [T-031](T-031-privacy-and-abuse.md) Privacy notice, rate limiting & abuse
- [T-032](T-032-deploy-and-release.md) Deploy + release checklist

## Working conventions

- Update the header **Status** as you go, and tick the matching line in [../TASKLIST.md](../TASKLIST.md).
- Reference the task ID in commits: `feat(render): text layout engine (T-014)`.
- If you deviate from the implementation notes, edit the file to say what you did instead. These are living documents; a task file that no longer describes the code is worse than no task file.
- If a task forces an undocumented decision, add it to [../11-open-questions.md](../11-open-questions.md).
