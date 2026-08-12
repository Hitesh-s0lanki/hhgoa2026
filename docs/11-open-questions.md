# 11 — Open Questions & Assumptions

Everything we decided without confirmation. Each has a **default** so nothing blocks, and a note on what changes if the answer differs.

Status: **⧗ open** · **✔ answered** · **⊘ moot**

---

> **Update, 8 Aug 2026.** The brand kit has been extracted from hhgoa.com ([13](13-brand-identity.md)) and the official task PDF retrieved ([14](14-official-brief.md)). Q-1, Q-3, Q-4, and Q-5 are now answered; Q-2 is partly answered. Q-18 and Q-19 are new.

## Blocking-ish (affects the critical path)

### Q-2 · Is there an approved design for the two formats, or do we design them? ◐ partly answered

**Answered:** the visual language is unambiguous — flat vector line illustration, six-colour palette, Imbue + Victor Mono ([13](13-brand-identity.md)).
**Still open:** there is no Figma for the two output formats specifically, so the compositions are ours to design within that language.
**Default:** implement the layouts in [13 — Revised template direction](13-brand-identity.md#revised-template-direction), reusing the event's own `footer trees.png` composition as the frame.

### Q-18 · Is there an official brand-kit download? ⧗ new

**Finding:** the footer shows a "Brand Kit" label, but it is a `<p>` with no `href` — the link does not exist.
**Default:** production CSS and the asset files _are_ the brand kit; values are recorded in [13](13-brand-identity.md).
**If one appears:** diff it against [13](13-brand-identity.md) and re-baseline the visual snapshots deliberately ([T-029](tasks/T-029-cross-device-qa.md)).

### Q-19 · Does the team/combined frame have a required team size or layout? ⧗ new

**Context:** the website asks us to "bring your teammates into one combined frame"; the PDF does not mention it at all ([14](14-official-brief.md#discrepancy-the-website-adds-requirements)).
**Default:** support 2–4 photos in a grid, auto-selecting the layout by count ([T-033](tasks/T-033-team-combined-frame.md)).
**If different:** the template is data, so another arrangement is a new spec file, not a rebuild.

## Product decisions

### Q-6 · Should generated images be uploaded to our storage at all? ⧗

**Tension:** the OG-preview share route requires a public copy of the user's face; the privacy default says nothing leaves the device.
**Default:** upload only on explicit opt-in, with the button labelled as creating a public link, 60-day auto-expiry, and unguessable ids ([T-031](tasks/T-031-privacy-and-abuse.md)).
**If the answer is "no uploads":** drop [T-023](tasks/T-023-storage-presigned-upload.md) and [T-024](tasks/T-024-share-page-og.md); ship native-share + download-then-post only. That still satisfies FR-5.1–5.3 and removes all storage cost and privacy surface. This is a genuinely defensible product choice, not a downgrade.

### Q-7 · Is a public gallery of generated cards wanted? ⧗

**Assumption:** no. It is not in the brief.
**Default:** out of scope ([02](02-requirements.md#out-of-scope-for-v1)).
**If wanted:** this is the one request that changes the architecture — it needs a database (ADR-004 reverses), moderation, and a real consent flow for publishing someone's face. Treat as a separate project, not a feature.

### Q-8 · Must builder titles be AI-generated? ⧗

**Assumption:** no; deterministic is better here (ADR-007).
**Default:** rules table + curated pool + reroll ([T-017](tasks/T-017-builder-title-generator.md)).
**If AI is explicitly wanted:** add it as an optional refinement behind the deterministic default — the render never waits on the network, and a failed call silently keeps the local title. Cost: an API key, a rate-limited route, and a content-safety consideration (this text goes next to a real person's face and name).

### Q-9 · What fields does the Builder ID card carry? ⧗

**Assumption:** name, role, stack, derived builder title.
**Default:** as specced in [06](06-brand-and-templates.md).
**Candidates raised but not included:** X handle, company, city, "why I'm coming", QR code to a profile. Each costs a text layer and a validation rule; a QR code costs a dependency and a lot of card real estate.

### Q-10 · Should there be style variants (e.g. sunset / palm / night)? ⧗

**Assumption:** nice to have, P3.
**Default:** the template registry supports it for free — a variant is a new spec file. Ship one style well first.

### Q-11 · Any output sizes beyond square and 4:5? ⧗

**Assumption:** 1080×1080 (A) and 1080×1350 (B) cover the need.
**Default:** as above; 9:16 story variant parked at P3 ([T-019](tasks/T-019-export-and-variants.md)).

---

## Technical

### Q-12 · What is the production domain? ⧗

**Why it matters:** `og:image` and `og:url` must be absolute, so the domain must be known before the share route can be verified end to end.
**Default:** develop against the Vercel preview URL via `NEXT_PUBLIC_SITE_URL`; nothing hardcoded.

### Q-13 · Whose cloud account holds the bucket? ⧗

**Assumption:** ours (R2), handed over at the end.
**Default:** all storage config via env vars so ownership can transfer without a code change.
**Also unresolved:** who pays, and who is the data controller for the stored images — relevant if the event has a privacy policy we must align with.

### Q-14 · Expected volume? ⧗

**Assumption:** low hundreds to low thousands of generations.
**Default:** the current design has effectively no per-user server cost; only the presign endpoint needs a rate limit.
**If it goes viral:** the client-side architecture is the mitigation — there is no render capacity to exhaust. Storage and CDN egress are the only scaling concerns, and R2 removes the egress one.

### Q-15 · Minimum browser support? ⧗

**Assumption:** iOS Safari 16+, Android Chrome 110+, current desktop evergreens ([12](12-qa-and-testing.md)).
**Default:** `createImageBitmap` with `imageOrientation` is the effective floor; older browsers get the manual-EXIF fallback path.
**If Safari 15 or older must work:** add ~half a day for the `exifr` + manual-rotate path and for `toDataURL` export.

### Q-16 · Does an analytics/attribution requirement exist? ⧗

**Assumption:** basic, cookieless, no PII.
**Default:** count funnel steps (`upload_started`, `render_ok`, `download`, `share_native`, `share_link`) with no image data and no field text ever attached (NFR-3.5).
**If UTM/attribution tracking is wanted:** confirm it against the privacy copy before adding anything that sets a cookie.

### Q-17 · Should content moderation exist on uploaded shares? ⧗

**Why it matters:** the link route puts a user-supplied image on a domain we control, at a public URL. Someone will eventually upload something they shouldn't.
**Default:** unguessable ids (not enumerable, so not browsable), 60-day expiry, and a documented manual takedown path (delete the object by key).
**If stronger moderation is required:** either drop the link route (see Q-6) or add a moderation API call before the object becomes public — which adds latency and cost to the share path.

---

## Answered

_(Move items here with the date and the decision as they resolve, so the reasoning is not lost.)_

| Q                                               | Answered   | Decision                                                                                                                                                   |
| ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q-1** Where does the brand kit come from?     | 2026-08-08 | Extracted from hhgoa.com production CSS and assets. No placeholder kit needed. See [13](13-brand-identity.md).                                             |
| **Q-3** Font licensing?                         | 2026-08-08 | **Imbue** and **Victor Mono** are both Google Fonts under SIL OFL 1.1. Self-hosting a subset WOFF2 is permitted. No blocker.                               |
| **Q-4** Do both formats ship, or is one enough? | 2026-08-08 | The brief says _"pick one of the two formats (or build both if you want)"_. Format A alone is a complete submission. Build B only if Day 3 finishes early. |
| **Q-5** Caption and hashtag?                    | 2026-08-08 | **`#FrameInGoa`**, confirmed by both the site and the PDF. A post without the literal hashtag is an **invalid submission**. Handle: `@247pmstudio`.        |

---|---|---|
| — | — | — |

---

## How to use this file

- Anything here is a **stated assumption**, not a hidden one. That distinction is the whole point of the document.
- When an answer arrives: update the item, move it to **Answered** with a date, and edit the task file it affects. Do not leave the old default in place — a stale assumption is worse than an open question.
- If a new decision gets made without confirmation during the build, add it here rather than burying it in a commit message.
