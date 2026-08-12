# 14 — The Official Brief

**Source:** _"HH Goa 2026 Shortlisting Task: Build a Frame / ID Card Generator"_ — 2-page PDF linked from the Task #1 card on <https://hhgoa.com>.
**Direct link:** <https://drive.google.com/file/d/11aAIBCdhngT0QWLPBNc2bJGLqXhghN3H/view>
**Retrieved:** 8 August 2026.

This is the authoritative statement of what is being asked. Where it and my earlier reading differ, **this wins**.

---

## ⏰ Deadline

> **11:59 pm, 13th August 2026**

**Today is 8 August 2026. That is five days.**

This changes the plan materially. See [Revised plan](#revised-plan) below and the compressed schedule in [10 — Roadmap](10-roadmap-phases.md#if-you-have-only-two-days).

---

## Hard gates

Two warnings are called out in the brief itself, both of which invalidate a submission:

> ⚠ Your submission will be **flagged as an error** if your X post doesn't actually contain the hashtag **#FrameInGoa**.

> ⚠ **One submission per team only.** Once a team has registered, any further submissions from that team will be rejected.

The first is the one to be careful about: a perfect app with a post that omits the hashtag scores zero. Put `#FrameInGoa` in the app's default caption ([T-022](tasks/T-022-x-intent-share.md)) _and_ check the actual posted tweet before considering the task done.

The second means **do not submit until it is right.** There is no second attempt.

---

## What to build

> A web tool where someone uploads a photo and instantly gets back a branded HH Goa 2026 graphic, ready to download and share on X.

> Pick **one** of the two formats below (or build both if you want).

**Format A — PFP Frame/Overlay**

> A frame that sits around the uploaded photo, turning it into a ready-to-use X profile picture. The uploaded photo stays front and center, the frame just wraps it in HH Goa branding.

**Format B — Builder ID Card**

> A card with the uploaded photo + name + a couple of fun fields (your stack/role, a generated 'builder title') laid out like an event badge, designed to be posted as an image, not printed.

Note "**pick one**". Building both is explicitly optional. Given the five-day window, a polished Format A alone is a complete, compliant submission — which is what [10 — Roadmap](10-roadmap-phases.md) already recommends.

## Required flow

Verbatim, numbered as in the brief:

1. User uploads a photo (support common formats — JPG, PNG, **HEIC from iPhone**).
2. _(Format B only)_ User fills in a couple of quick fields: name, stack/role, etc.
3. Tool generates the final graphic; **should feel near-instant**.
4. User can download the image.
5. User can hit Share to X: this should open a **pre-filled tweet** (image attached **or** a link whose preview shows the actual graphic) with a caption already written in.

> **No login wall. No signup gate before showing the result. It needs to work in one pass, start to finish.**

Point 5 is worth reading closely: the brief itself accepts **either** a direct image attach **or** a link whose OG preview shows the graphic. Both routes are legitimate by the brief's own wording — which is exactly the analysis in [08 — Sharing & OG](08-sharing-and-og.md).

## Requirements

| Brief's wording                                                                                                                                                                                                            | Our coverage                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Speed** — "Upload to finished result should be fast—a few seconds, not a loading screen."                                                                                                                                | NFR-1, [T-028](tasks/T-028-performance-budget.md)                                                                               |
| **Handles real photos** — "Portrait, landscape, off-center crops, different aspect ratios; don't assume users will crop first."                                                                                            | FR-2, [T-010](tasks/T-010-cover-fit-geometry.md), [T-012](tasks/T-012-manual-crop-control.md)                                   |
| **On-brand** — "It should be unmistakably this event, not a generic badge with a logo pasted on."                                                                                                                          | NFR-2, [13 — Brand Identity](13-brand-identity.md), [T-015](tasks/T-015-format-a-pfp-frame.md)                                  |
| **Downloadable output** — "A real image file, not something that only renders on-screen."                                                                                                                                  | FR-3.1, FR-4.1, [T-019](tasks/T-019-export-and-variants.md), [T-020](tasks/T-020-download-action.md)                            |
| **Working share flow** — "Pre-filled caption + hashtag #FrameInGoa. If you share via link rather than direct image attach, ensure the link preview (OG image) shows the generated graphic, not a blank/default thumbnail." | FR-5, [T-022](tasks/T-022-x-intent-share.md), [T-024](tasks/T-024-share-page-og.md), [T-025](tasks/T-025-native-share-sheet.md) |
| **Mobile-friendly** — "Most people will use this from their phone."                                                                                                                                                        | NFR-4, [T-029](tasks/T-029-cross-device-qa.md)                                                                                  |

Every requirement in the brief maps to existing tasks. The docs were written against a faithful reading; nothing needs to be invented.

## What to submit

> - Live working link
> - End results posted on X with the hashtag **#FrameInGoa**

> ⚠ Remember: Submissions without an X post containing #FrameInGoa will be treated as invalid.

**Where:** <https://forms.gle/jM5hTaGvsrfEfixPA>

So the deliverable is two things — a deployed URL and a public post. The post is not a formality; it is half the submission.

---

## Discrepancy: the website adds requirements

The Task #1 card on hhgoa.com says something the PDF does not:

> Design your own HH Goa 2026 themed photo frame generator. **Use that same generator to bring your teammates into one combined frame.** Post it on X with **a quick how-to** on generating your own #FrameInGoa post using your generator — and you're done.

Its bullet list also states:

> - Instantly recognizable HH Goa 2026 identity
> - 1-click download + 1-click Share to X
> - Works on any photo — no manual cropping
> - Personalized: name, stack, a generated builder class
> - Seconds from upload to shareable output
> - Get to the top of the ladder and win the exclusive HH Goa ID
> - Use #FrameInGoa to get featured in the Radar

Three things here are **not** in the PDF:

| Addition                                           | Impact                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **"bring your teammates into one combined frame"** | A multi-photo / group frame. My docs listed group cards as out of scope — that was wrong. See below.              |
| **"a quick how-to" in the X post**                 | A submission-content requirement, not a product one. Free to satisfy.                                             |
| **"1-click download + 1-click Share"**             | Reinforces: no intermediate "Generate" button. Already the design ([T-021](tasks/T-021-live-preview-surface.md)). |

Also note the website says _"a generated builder class"_ while the PDF says _"builder title"_ — same thing, [T-017](tasks/T-017-builder-title-generator.md) covers it.

### On the team/combined frame

The cheapest honest reading: the _posted result_ should show teammates in one combined frame, and the generator should be able to produce that. It does **not** require a full multi-user collaborative flow.

Minimum viable version — a third template that accepts 2–4 photos in a grid inside the same branded frame:

```
   ┌───────────────────────────────┐
   │ 🌴  HACKER HOUSE · GOA 26  🌴 │
   │   ╭─────────╮ ╭─────────╮     │
   │   │ photo 1 │ │ photo 2 │     │
   │   ╰─────────╯ ╰─────────╯     │
   │   ╭─────────╮ ╭─────────╮     │
   │   │ photo 3 │ │ photo 4 │     │
   │   ╰─────────╯ ╰─────────╯     │
   │  ✿✿ TEAM NAME · #FrameInGoa ✿✿│
   └───────────────────────────────┘
```

Architecturally this is close to free: the `photo` layer already takes a rect, so a team template is _n_ photo layers in one spec, plus an uploader that accepts several files. The only engine change is letting a `photo` layer name which image index it draws — a small, declarative extension to [T-004](tasks/T-004-template-spec-and-registry.md), not a special case in the renderer.

**New task: [T-033](tasks/T-033-team-combined-frame.md).**

---

## Revised plan

Five days, one developer. The brief's "pick one format" plus the website's team frame gives this priority order:

```
 Day 1 (8 Aug)   T-001 T-002 T-003(harvest hhgoa.com assets) T-004
                 T-005 T-006 T-007 T-008 T-009        ← ingest, incl. HEIC
 Day 2 (9 Aug)   T-010 T-013 T-014 T-021              ← fit + render + preview
 Day 3 (10 Aug)  T-015 (Format A, polished) T-019 T-020
                 ├─ MILESTONE: the core product works ─┤
 Day 4 (11 Aug)  T-033 (team frame) T-022 T-025 T-012
                 T-026 T-027                          ← share + shell
 Day 5 (12 Aug)  T-029 (device QA) T-032 (deploy)
                 X post with #FrameInGoa + how-to
                 Submit the form
 Buffer (13 Aug) fixes only. Submit early — one shot only.
```

**Deliberately cut,** and worth stating in the README:

| Cut                                                                                                                                               | Why it is safe                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [T-016](tasks/T-016-format-b-builder-card.md) + [T-018](tasks/T-018-builder-form.md) Format B                                                     | The brief says pick one.                                              |
| [T-011](tasks/T-011-smart-subject-positioning.md) face detection                                                                                  | Heuristic + manual control satisfies "no manual cropping".            |
| [T-023](tasks/T-023-storage-presigned-upload.md) + [T-024](tasks/T-024-share-page-og.md) OG link route                                            | Native share attaches the real image; the brief accepts either route. |
| [T-028](tasks/T-028-performance-budget.md) / [T-030](tasks/T-030-accessibility-pass.md) / [T-031](tasks/T-031-privacy-and-abuse.md) formal passes | Do the obvious parts inline; skip the formal audits.                  |

If Day 3 finishes early, add Format B — it is a template plus a form on an engine that already exists. Do not start it before Format A is genuinely polished.

### Submission checklist

- [ ] Deployed, publicly reachable URL — opened on a phone from a fresh browser
- [ ] Full flow works on iOS Safari (HEIC → save → share)
- [ ] Team/combined frame produced and used in the post
- [ ] X post published, containing a **literal `#FrameInGoa`** — verify on the live tweet
- [ ] Post includes the quick how-to
- [ ] Form submitted at <https://forms.gle/jM5hTaGvsrfEfixPA>
- [ ] **One submission only** — confirm with the team before sending

## References

- [13 — Brand Identity](13-brand-identity.md) — extracted palette, fonts, assets
- [02 — Requirements](02-requirements.md) — the decomposed requirement IDs
- [10 — Roadmap](10-roadmap-phases.md) — phases and cut lines
