# 01 — Project Overview

## What this is

A single-purpose web tool. One job, done fast and well:

> **A person uploads a photo of themselves. The app places it inside an HH Goa 2026 branded design. They get a real image file back and post it.**

That is the entire product. It is closer to a one-template Canva than to a social app or an AI product.

## What this is _not_

Being explicit here saves a lot of accidental scope:

| Not this                           | Why not                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| A social network                   | No profiles, no feed, no follows.                                    |
| An AI image generator              | We never alter the person's face or synthesize pixels. We composite. |
| A photo editor                     | No filters, brightness, stickers, or layers.                         |
| An account-based SaaS              | No login by requirement. No user table.                              |
| A gallery / directory of attendees | Not asked for. Would add a database, moderation, and privacy load.   |

If a feature request arrives, the test is: _does it get a person from "I have a photo" to "I posted it" faster?_ If not, it goes to [Open Questions](11-open-questions.md) rather than into the build.

## Who uses it

| Trait                                          | Implication for us                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Attendee or applicant of HH Goa 2026           | They already care about the brand; they want the flex, not a tutorial.                             |
| Arrives from a link on X or WhatsApp           | In-app browser (iOS WKWebView / Android WebView), not a clean Chrome tab.                          |
| On a phone, one-handed, possibly on venue wifi | Mobile-first layout; small payloads; no reliance on fast upload.                                   |
| Photo is a HEIC straight from the camera roll  | HEIC support is table stakes, not an edge case.                                                    |
| Will bounce in seconds if it stalls            | Perceived speed is a _feature_, tracked as a budget in [T-028](tasks/T-028-performance-budget.md). |

## The two formats

### Format A — PFP Frame

The user's photo, unmodified, sitting inside a branded frame or ring. Square, 1:1, sized for a profile picture.

```
   ┌───────────────────────────┐
   │  ╭─────────────────────╮  │  ← branded ring / border /
   │  │                     │  │    pattern / corner marks
   │  │    USER'S PHOTO     │  │
   │  │     (untouched)     │  │
   │  │                     │  │
   │  ╰─────────────────────╯  │
   │      HH GOA 2026 ▸        │  ← lockup, may sit on the frame
   └───────────────────────────┘
```

Key property: **we do not touch the face.** We crop and position, then draw brand elements around/over the edges. This is why it is fast, reliable, and never looks uncanny.

### Format B — Builder ID Card

A card that carries identity text alongside the photo.

```
   ┌─────────────────────────────┐
   │  HH GOA 2026        ◢◤      │
   │                             │
   │      ┌──────────────┐       │
   │      │              │       │
   │      │    PHOTO     │       │
   │      │              │       │
   │      └──────────────┘       │
   │                             │
   │      HITESH SOLANKI         │  ← name
   │      Software Engineer      │  ← role
   │      ──────────────         │
   │      AI PRODUCT BUILDER     │  ← builder title (derived)
   │                             │
   │      #FrameInGoa            │
   └─────────────────────────────┘
```

Same rendering engine, different template spec and a small form in front of it. See [Brand & Templates](06-brand-and-templates.md).

## Why Format A ships first

It has the shortest path to "polished and done":

```
   Format A:  upload ──► fit ──► frame ──► download        (4 moving parts)
   Format B:  upload ──► fit ──► form ──► validate ──►
                        title ──► text layout ──► card ──► download   (8)
```

Format A proves the hard part (ingest + fit + render + export) with the least surface area. Once that engine is solid, Format B is mostly a new template spec plus a form. Order is enforced in the [Roadmap](10-roadmap-phases.md).

## The one genuinely hard problem

Everything else is ordinary web work. The interesting problem is this:

> Given an arbitrary photo — any aspect ratio, any orientation flag, possibly HEIC, possibly with the subject off to one side — place it into a fixed-aspect slot so that it looks _deliberately composed_, in under a second, on a mid-range phone.

That is [Image Pipeline](07-image-pipeline.md), and tasks [T-005](tasks/T-005-photo-uploader.md) through [T-012](tasks/T-012-manual-crop-control.md).

## Definition of done (product level)

The project is done when a stranger can, on an iPhone, from a link in a tweet:

1. Open the page and understand what to do without reading instructions.
2. Pick a HEIC photo from their camera roll.
3. See a correct, on-brand result within ~2 seconds, with their face well-placed.
4. Save it to their photo library.
5. Post it to X with the caption already written.

…and at no point sees a spinner they have to wonder about, a stretched face, a sideways photo, or an error they cannot recover from.
