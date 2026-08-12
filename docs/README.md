# HH Goa 2026 — Photo Framer

> Upload a photo → get it composited into an on-brand **HH Goa 2026** graphic → download it or share it on X. No login, no waiting.

This folder is the single source of truth for **what** we are building, **why** each decision was made, and **which task to pick up next**.

---

## Read in this order

| #   | Document                                       | Answers                                                         |
| --- | ---------------------------------------------- | --------------------------------------------------------------- |
| 00  | **README.md** (this file)                      | Where do I start?                                               |
| 01  | [Project Overview](01-project-overview.md)     | What is this product in one page?                               |
| 02  | [Requirements](02-requirements.md)             | What exactly must it do? What is explicitly out of scope?       |
| 03  | [User Flows](03-user-flows.md)                 | What does the user see, click, and get — screen by screen?      |
| 04  | [Architecture](04-architecture.md)             | How do the pieces fit together, and why?                        |
| 05  | [Tech Stack](05-tech-stack.md)                 | What are we using, and what did we deliberately reject?         |
| 06  | [Brand & Templates](06-brand-and-templates.md) | How do we keep design separate from code?                       |
| 07  | [Image Pipeline](07-image-pipeline.md)         | The core engineering problem, in detail.                        |
| 08  | [Sharing & OG Previews](08-sharing-and-og.md)  | How the X share actually works (and its real limits).           |
| 09  | [Project Structure](09-project-structure.md)   | Where does each file live and what owns what?                   |
| 10  | [Roadmap & Phases](10-roadmap-phases.md)       | What order do we build in? What is the MVP cut line?            |
| 11  | [Open Questions](11-open-questions.md)         | What are we assuming, and what must the organizers confirm?     |
| 12  | [QA & Testing](12-qa-and-testing.md)           | How do we know it works on a real iPhone?                       |
| 13  | [**Brand Identity**](13-brand-identity.md)     | The real palette, fonts, and assets — extracted from hhgoa.com. |
| 14  | [**The Official Brief**](14-official-brief.md) | The task PDF decoded, plus the deadline and submission rules.   |

> ⏰ **Deadline: 11:59 pm, 13 August 2026.** One submission per team — there is no second attempt. Read [14](14-official-brief.md) before doing anything else.

## Then work from

- **[TASKLIST.md](TASKLIST.md)** — the master checklist. 32 tasks, grouped into 7 phases, each linking to a full task file.
- **[tasks/](tasks/)** — one detailed reference file per task: why it exists, scope, implementation notes, acceptance criteria, gotchas.

---

## The 30-second version

```
                        USER'S PHONE / BROWSER
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │  Upload photo  ──►  Normalize  ──►  Fit  ──►  Composite      │
   │  (JPG/PNG/HEIC)     (EXIF, size)   (cover)   (canvas + brand)│
   │                                                    │         │
   │                                                    ▼         │
   │                                            Real PNG / JPEG   │
   │                                              │         │     │
   │                                    Download ─┘         └─ Share
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
                                                              │
                            optional, only when sharing a link │
                                                              ▼
                                            Object storage + /share/[id]
                                            page carrying the OG image
```

**Everything on the happy path happens in the browser.** The server exists only so that a _link_ shared to X can show the generated graphic as its preview image.

## The brand, in one block

Real values, read out of hhgoa.com's production CSS. Full detail in [13](13-brand-identity.md).

```
   #0B6839  brand-primary   deep green — THE ground, ~70% of every surface
   #FEE101  brand-accent    bright yellow — display type, the sun
   #FF0080  brand-pink      hot magenta — CTAs, spot accent
   #FFFBE8  brand-offwhite  warm cream — light panels, muted text
   #FFFFFF / #000000        line art / hard offset shadow behind yellow type

   Display:  Imbue        (high-contrast condensed serif)   ── both SIL OFL,
   Body/UI:  Victor Mono  (programming monospace)           ── self-hosting OK
```

Aesthetic: **flat vector line illustration, retro travel-poster / risograph.** Sun with radiating rays, palm trees, tropical flowers, Devanagari "गोवा". No gradients, no texture, no grain.

## Non-negotiables (from the brief)

0. **The X post must literally contain `#FrameInGoa`.** Without it the submission is invalid, however good the app is.
1. **No account.** No login, signup, email, or onboarding. Land → upload → done.
2. **Near-instant.** Target: upload to visible result in under ~2 s. No progress-bar theatre.
3. **Any photo shape.** Portrait, landscape, square, off-centre — the app adapts, never the user.
4. **HEIC works.** iPhones produce HEIC by default; that is the majority of our real traffic.
5. **On-brand, not stickered.** The output must look like HH Goa 2026 designed it, not like a logo was pasted on.
6. **Mobile-first.** The primary device is a phone held in one hand at an event.
7. **No AI needed.** This is 2D compositing. See [ADR-007](04-architecture.md#decision-log).

## Output formats

The brief says **pick one** of A or B; both is optional. The website additionally asks for a combined team frame in the posted result.

|             | Format A — **PFP Frame**                   | Format B — **Builder ID Card**                | **Team Frame**                              |
| ----------- | ------------------------------------------ | --------------------------------------------- | ------------------------------------------- |
| Input       | Photo only                                 | Photo + name + role + stack                   | 2–4 photos + team name                      |
| Output      | Square avatar with branded frame           | Portrait card with typography                 | Square grid in one frame                    |
| Build order | **First** — ship polished                  | Only if time remains                          | Needed for the post                         |
| Detail      | [T-015](tasks/T-015-format-a-pfp-frame.md) | [T-016](tasks/T-016-format-b-builder-card.md) | [T-033](tasks/T-033-team-combined-frame.md) |

## Conventions used in these docs

- `☐` not started · `◐` in progress · `☑` done · `⊘` cut from scope
- Task IDs are stable (`T-014`) — reference them in commits and PRs: `feat(render): text layout engine (T-014)`
- **Assumption:** blocks mark things we decided without confirmation. Every one is tracked in [Open Questions](11-open-questions.md).
- Estimates are for one developer, in focused hours.
