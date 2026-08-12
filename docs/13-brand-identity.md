# 13 — Brand Identity (extracted from hhgoa.com)

**Source:** <https://hhgoa.com> — production CSS, asset files, and the official task PDF.
**Extracted:** 8 August 2026. Values below are the _real_ ones, not placeholders.

This supersedes the placeholder guidance in [06 — Brand & Templates](06-brand-and-templates.md) and largely resolves [Q-1, Q-2, Q-3, Q-5](11-open-questions.md).

---

## The event

|                  |                                                    |
| ---------------- | -------------------------------------------------- |
| Name             | **HH GOA** — Hacker House Goa 2026                 |
| Tagline          | **Less Noise. More Signal**                        |
| Sub-line         | _4 days. one rhythm. everything intentional._      |
| Dates            | **28–31 October 2026**                             |
| Location         | Goa, India                                         |
| Format           | 4-day build-station hackathon, 500 elite builders  |
| Organizer        | **2:47 pm Studio**                                 |
| X                | [@247pmstudio](https://x.com/247pmstudio)          |
| Telegram         | [@twofourtysevenpm](https://t.me/twofourtysevenpm) |
| Apply            | <https://hacker-house-goa-2026.devfolio.co/>       |
| Campaign hashtag | **#FrameInGoa**                                    |

Positioning copy, verbatim — useful for matching tone:

> Most hackathons are just hype and no substance. We're changing that. From October 28–31, we're taking over Goa for the country's biggest build-station.
>
> This is for the developers who live in their terminals and ship things that matter. No fluff, no useless networking—just 500 elite builders, high-speed fiber, and the ocean at your doorstep. If you're ready to lock in and build your legacy, we'll see you on the sand.

The voice is lowercase-leaning, terse, terminal-adjacent, slightly wry. Not corporate, not hype-y. Match it in the app's copy.

---

## Palette

Taken verbatim from the site's compiled CSS (`--brand-*` utilities and the shadcn `:root` block). Six colors, no gradients — the site uses **flat fills only**.

| Token            | Hex       | Role on the site                                                           |
| ---------------- | --------- | -------------------------------------------------------------------------- |
| `brand-primary`  | `#0B6839` | **The** background. Deep forest/bottle green. Page ground, cards, borders. |
| `brand-accent`   | `#FEE101` | Bright yellow. The wordmark, the sun, focus rings, highlighted text.       |
| `brand-pink`     | `#FF0080` | Hot magenta. CTAs, links, bullets, signage accents. Highest-energy color.  |
| `brand-offwhite` | `#FFFBE8` | Warm cream. Light-surface panels, muted body text on green.                |
| `brand-white`    | `#FFFFFF` | Line art, primary text on green.                                           |
| `brand-black`    | `#000000` | Offset drop shadows, text on yellow/cream.                                 |

The full shadcn mapping as shipped, for reference:

```css
:root {
  --background: #0b6839;
  --foreground: #fff;
  --card: #0b6839;
  --card-foreground: #fff;
  --primary: #0b6839;
  --primary-foreground: #fff;
  --secondary: #fee101;
  --secondary-foreground: #000;
  --muted: #0b6839;
  --muted-foreground: #fee101;
  --accent: #ff0080;
  --accent-foreground: #fff;
  --border: #0b6839;
  --input: #0b6839;
  --ring: #fee101;
  --radius: 0.625rem;
}
```

### How the colors actually behave

```
   Green #0B6839 is the ground. Everything sits ON it.
   ┌──────────────────────────────────────────────┐
   │  ███ green field                             │
   │                                              │
   │  ██ YELLOW  ← display type, the sun, focus   │
   │  ██ PINK    ← CTAs, links, one accent object │
   │  ── WHITE   ← line art, body text            │
   │  ▓▓ CREAM   ← light panels, muted text       │
   │                                              │
   │  Black is used ONLY as an offset shadow      │
   │  behind yellow type, never as a fill.        │
   └──────────────────────────────────────────────┘
```

Yellow and pink are never adjacent at large sizes — pink is a spot accent, yellow is the voice. Roughly 70% green / 15% white / 10% yellow / 5% pink by area.

### Contrast notes (for our UI)

| Pair                   | Ratio   | Verdict                                  |
| ---------------------- | ------- | ---------------------------------------- |
| `#FFFFFF` on `#0B6839` | ~7.6:1  | ✔ body text                              |
| `#FFFBE8` on `#0B6839` | ~7.3:1  | ✔ body text                              |
| `#FEE101` on `#0B6839` | ~6.9:1  | ✔ body text and headings                 |
| `#000000` on `#FEE101` | ~15.9:1 | ✔ anything                               |
| `#FFFFFF` on `#FF0080` | ~4.0:1  | ⚠ large text only (≥24 px / ≥19 px bold) |
| `#0B6839` on `#FFFBE8` | ~7.3:1  | ✔ dark-on-cream panels                   |

The one to watch is white-on-pink. The site uses it on rounded pill buttons at ~13.5 px bold, which is borderline. In our UI, either enlarge it or use black on pink. Flagged in [T-030](tasks/T-030-accessibility-pass.md).

---

## Typography

Two faces, both **Google Fonts under the SIL Open Font License** — which means self-hosting a WOFF2 subset is unambiguously permitted. **[Q-3](11-open-questions.md) is resolved: no licensing blocker.**

| Role               | Family             | Weights used    | Character                                                          |
| ------------------ | ------------------ | --------------- | ------------------------------------------------------------------ |
| Display / headings | **Bowlby One SC**  | 400 (only)      | Fat small-caps poster face; heavy, flat-sided, shouts at any size   |
| Body / UI / mono   | **DM Mono**        | 400, 500        | Geometric monospace, wide sidebearings; even colour in small caps   |

Site declarations (`app/globals.css`, loaded by `next/font` in `app/layout.tsx`):

```css
--font-display: var(--font-bowlby), Impact, "Haettenschweiler", sans-serif;
--font-body: var(--font-dm-mono), ui-monospace, "SF Mono", monospace;
```

The pairing is the whole personality: **a fat poster face shouting over a monospace that whispers.** Bowlby for every heading and the wordmark; DM Mono for everything the user types and every UI label. A generic sans anywhere reads as off-brand immediately.

Two constraints the faces impose, both already encoded in `globals.css`:

- **Bowlby only draws small caps and only ships one weight.** Lowercase input renders as small caps whatever you do, so the `h1`–`h4` base rule sets `text-transform: uppercase` to make that deliberate rather than accidental. There is no bold — weight is a *size* decision.
- **Bowlby is wide where a condensed face is narrow.** Headline sizes are roughly a third smaller than the same copy would take in a condensed serif; the display sizes on the site are `clamp()`ed against that, not fixed.

Labels and buttons are uppercase DM Mono at weight 700 with **zero** letter-spacing (the `label-caps` utility). DM Mono already carries wide sidebearings — adding tracking on top makes a 10px label read as spaced-out lettering rather than a label. DM Mono has no 700 on Google Fonts, so `font-bold` renders synthesised; on a monospace the faux weight is even across the face.

### Getting them

```bash
# Google Fonts, OFL — self-host, do not hotlink
npx google-font-installer download "Bowlby One SC"
npx google-font-installer download "DM Mono"

# subset to Latin + digits + punctuation (T-003)
pyftsubset BowlbyOneSC-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201D,U+2026,U+2013-2014" \
  --flavor=woff2 --output-file=public/branding/fonts/display.woff2
```

Both are static — there is no variable axis to pin. Each subsets to well under 30 KB.

> **Canvas caveat.** Bowlby is solid and low-contrast, so unlike a hairline serif it survives downsampling — the thumbnail risk this replaces is gone. The risk it introduces instead is *width*: a name that fit a condensed face on one line will not fit here, so the canvas renderer's fit-to-width shrink step ([T-016](tasks/T-016-format-b-builder-card.md)) matters more, not less.

---

## Visual language

The site is **flat vector line illustration** in a strictly limited palette — a retro travel-poster / risograph register, not a gradient-and-glow tech aesthetic.

```
   Sun rise.png (1440×1438) — the hero
   ┌────────────────────────────────────────┐
   │  ███████ green sky ████████████████    │
   │              ╲ │ ╱                     │
   │            ── ◗◖ ──   ← YELLOW sun,    │
   │              ╱ │ ╲       radiating rays│
   │  ～～～～ green sea ～～～～～～～～      │
   │  🌴  ▁▁▁▁ white sand ▁▁▁▁  🌴          │
   │   ⛱  ╱▔╲ line-art shacks ╱▔╲  [PINK]   │
   └────────────────────────────────────────┘
```

Recurring motifs, in order of how identifiable they are:

| Motif                                                         | Where         | Use for us                                                                                         |
| ------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| **Radiating sun** (yellow half-disc + rays)                   | hero          | The single most recognisable mark. Strong candidate for a frame corner or an arc behind the photo. |
| **Palm trees** (white outline, green fronds)                  | hero, footer  | Natural left/right frame columns — see below.                                                      |
| **Tropical flowers** (pink + yellow)                          | footer base   | A bottom border band.                                                                              |
| **Beach furniture** (umbrellas, loungers, scooter, signposts) | details       | Too busy for a frame; good for the landing page.                                                   |
| **Black offset shadow on yellow type**                        | wordmark      | Copy this exactly for our display text.                                                            |
| **देवनागरी "गोवा"** (`goa_hindi.svg`, 181×180)                | section marks | A distinctive, non-obvious identity cue. Excellent for a frame corner.                             |

### `footer trees.png` is effectively a ready-made frame

```
   1440 × 887
   ┌────────────────────────────────────────┐
   │ 🌴🌴                              🌴🌴 │  palms enter from
   │  ╲╲                                ╱╱  │  both edges
   │                                        │
   │        ← empty green center →          │  ← the photo goes HERE
   │                                        │
   │ ✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿✿ │  flower band
   └────────────────────────────────────────┘
```

Palms on both sides, a flower band along the bottom, and a clear green center. That is a frame overlay the event already drew. Adapting it to 1:1 is the fastest path to a genuinely on-brand Format A — see [T-015](tasks/T-015-format-a-pfp-frame.md).

---

## Asset inventory

All under `https://hhgoa.com/assets/`. **These are the event's assets, used for a submission to the event's own task** — but re-export at the sizes we need rather than shipping 3 MB PNGs, and record provenance in `MANIFEST.md`.

| File                      | Size   | Dimensions  | Notes                                                                        |
| ------------------------- | ------ | ----------- | ---------------------------------------------------------------------------- |
| `Sun rise.png`            | 3.2 MB | 1440 × 1438 | Hero beach scene. The sun is extractable.                                    |
| `footer trees.png`        | 2.3 MB | 1440 × 887  | **Best frame candidate.** Palms + flower band.                               |
| `Hacker house.png`        | 27 KB  | 1148 × 237  | **Wordmark** — yellow Bowlby caps with black offset shadow, alpha.            |
| `goa_hindi.svg`           | 25 KB  | 181 × 180   | "गोवा" in Devanagari, outlined.                                              |
| `details.png`             | 2.0 MB | 1440 × 937  | Signposts, umbrella, scooter, palms.                                         |
| `agenda.png`              | 2.4 MB | 1440 × 872  | Agenda scene.                                                                |
| `hackers.png`             | 2.1 MB | 1440 × 804  | Hackers scene.                                                               |
| `2-47.svg`                | 32 KB  | 546 × 335   | 2:47 pm Studio mark (organizer, not event).                                  |
| `/favicon.webp`           | 36 KB  | 1440 × 1440 | Site icon.                                                                   |
| `0xx-*.svg` … `18x-*.svg` | —      | —           | Figma-exported decorative vectors (numbered, e.g. `036-vector-54-3934.svg`). |

The PNGs are enormous because they are full-bleed 1440 px illustrations. Our budget is 250 KB total ([T-003](tasks/T-003-brand-asset-intake.md)), so: crop to what the frame needs, re-export at 2160 px where it is the frame, run `oxipng`, and prefer the SVGs where one exists.

> **No official brand-kit download exists.** The footer shows a "Brand Kit" label but it is a `<p>`, not a link — there is no href. So the palette and fonts above, read out of production CSS, _are_ the brand kit. Recorded as [Q-18](11-open-questions.md).

---

## Updated design tokens

Replaces the placeholder block in [06](06-brand-and-templates.md#design-tokens) and [T-002](tasks/T-002-design-tokens-and-ui.md):

```ts
// lib/brand/tokens.ts
export const brand = {
  color: {
    primary: "#0B6839", // deep green — the ground
    accent: "#FEE101", // bright yellow — display type, the sun
    pink: "#FF0080", // hot magenta — CTAs, spot accent
    offwhite: "#FFFBE8", // warm cream — light panels
    white: "#FFFFFF",
    black: "#000000", // offset shadows only
  },
  font: {
    display: { family: "Bowlby One SC", weight: 400, file: "/branding/fonts/display.woff2" },
    body: { family: "DM Mono", weight: 500, file: "/branding/fonts/body.woff2" },
  },
  shadow: {
    // The signature treatment: hard black offset behind yellow display type.
    offset: { dx: 0.004, dy: 0.004, color: "#000000" }, // fractions of canvas
  },
  radius: { photo: 0.04, ui: "0.625rem" },
  isPlaceholder: false,
} as const;
```

Two changes worth calling out:

- `radius.ui` is `0.625rem` because that is the site's `--radius`. Buttons on the site are fully rounded pills (`rounded-full`) — match that for CTAs.
- `shadow.offset` is new. The hard black offset behind yellow display type is the site's most distinctive typographic move, and reproducing it in canvas is two `fillText` calls. It belongs in the tokens so both templates get it for free.

---

## Revised template direction

### Format A — PFP Frame (1080 × 1080)

```
   ┌─────────────────────────────────────┐
   │ ███ #0B6839 ground ███████████████  │
   │  🌴                            🌴   │  ← palms from footer trees.png
   │   ╲    ╭───────────────────╮    ╱   │
   │        │                   │        │
   │        │   USER'S PHOTO    │        │  ← inset, radius 0.04,
   │        │                   │        │    2px #FEE101 ring
   │        ╰───────────────────╯        │
   │            ── ◗◖ ──                 │  ← yellow radiating sun,
   │       H A C K E R  H O U S E        │    then the wordmark
   │  ✿✿✿✿✿✿✿ GOA · 28–31 OCT ✿✿✿✿✿✿✿   │  ← flower band + date strip
   └─────────────────────────────────────┘
```

Layer order (photo before frame, per [T-015](tasks/T-015-format-a-pfp-frame.md)):

1. `fill` `#0B6839`
2. `photo` — inset `0.10 → 0.90`, radius `0.04`, ring `#FEE101`
3. `image` palm columns (cropped from `footer trees.png`) — overlaps the photo edge
4. `custom` radiating sun in `#FEE101`
5. `image` wordmark (`Hacker house.png`) or Bowlby text with the black offset
6. `image` flower band along the bottom

**Drop the grain layer.** The site has no texture anywhere — it is flat vector throughout. Grain would be off-brand here, which reverses the guidance in [T-015](tasks/T-015-format-a-pfp-frame.md) written before the real kit was known.

### Format B — Builder ID Card (1080 × 1350)

```
   ┌─────────────────────────────────┐
   │ ███ #0B6839 ████████ ── ◗◖ ──  │  sun, top-right
   │  HACKER HOUSE  ▸ GOA 2026       │  yellow Bowlby + black offset
   │                                 │
   │     ╭───────────────────╮       │
   │     │      PHOTO        │       │  #FEE101 ring
   │     ╰───────────────────╯       │
   │                                 │
   │     HITESH SOLANKI              │  Bowlby 400, #FEE101, offset shadow
   │     Software Engineer           │  DM Mono, #FFFBE8
   │     Next.js · TS · AWS          │  DM Mono, #FF0080
   │     ─────────                   │
   │     ▸ AI PRODUCT BUILDER        │  Bowlby, #FF0080, tracked
   │                                 │
   │  ✿✿  #FrameInGoa   28–31 OCT ✿✿ │
   └─────────────────────────────────┘
```

Reversed from the earlier draft: the card is **green with light type**, not cream with dark type. The site is overwhelmingly green-ground, and a cream card would read as a different brand. Cream (`#FFFBE8`) stays as the muted body-text color, matching site usage.

Because both formats now share the green ground, differentiate them by **composition** (square/frame-led vs. portrait/type-led), not by inverting the palette.

---

## Copy for our app, in the event's voice

| Slot          | Text                                                                |
| ------------- | ------------------------------------------------------------------- |
| Headline      | **Frame yourself for Goa.**                                         |
| Sub           | _Less noise. More signal._                                          |
| CTA           | **UPLOAD YOUR PHOTO** (uppercase DM Mono, pink block)            |
| Formats line  | JPG · PNG · HEIC · up to 25 MB                                      |
| Privacy       | Your photo stays on your device.                                    |
| No-login      | No signup. No account. Just your photo.                             |
| Share caption | `Framed for HH Goa 2026 🌴 Less noise, more signal.\n\n#FrameInGoa` |

Uppercase, DM Mono, weight 700, zero tracking for every label and button — that is the site's UI treatment.

---

## What this resolves

| Question                                                                 | Status                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [Q-1](11-open-questions.md) Where does the brand kit come from?          | **Resolved** — extracted from production CSS + assets. No placeholder kit needed.                          |
| [Q-2](11-open-questions.md) Is there an approved design for the formats? | **Partly** — no Figma for the formats, but the visual language is unambiguous. We design within it.        |
| [Q-3](11-open-questions.md) Font licensing?                              | **Resolved** — Bowlby One SC and DM Mono are both Google Fonts / SIL OFL. Self-hosting permitted.              |
| [Q-5](11-open-questions.md) Caption and hashtag?                         | **Resolved** — `#FrameInGoa` is confirmed by both the site and the official brief. Handle: `@247pmstudio`. |
| [Q-10](11-open-questions.md) Style variants?                             | Still open, but the palette gives obvious ones (sunrise / palm / night).                                   |

## References

- <https://hhgoa.com> — the site
- <https://hacker-house-goa-2026.devfolio.co/> — applications
- [14 — The Official Brief](14-official-brief.md) — the task PDF, decoded
- [06 — Brand & Templates](06-brand-and-templates.md) — the template contract
