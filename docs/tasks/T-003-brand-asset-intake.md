# T-003 — Brand asset harvest & optimization

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 0 — Foundation                        |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 3 h                                   |
| **Depends on** | [T-001](T-001-scaffold-nextjs-app.md) |
| **Blocks**     | T-004, T-015, T-016                   |
| **Satisfies**  | NFR-2.1, NFR-2.2                      |

## Why this exists

> **Status change (8 Aug 2026):** the brand kit has been **extracted from hhgoa.com** — see [13 — Brand Identity](../13-brand-identity.md). This task is no longer "wait for the organizers"; it is "harvest, re-export, and optimize what already exists."

The palette and typefaces are known and final. What remains is turning the event's 1440 px full-bleed illustrations into frame-sized assets inside our 250 KB budget, and subsetting two Google Fonts.

There is **no official brand-kit download** — the footer's "Brand Kit" label is a `<p>` with no href. Production CSS _is_ the brand kit ([Q-18](../11-open-questions.md)).

## Scope

**In:** harvesting the event's assets, cropping and re-exporting them to frame sizes, subsetting the two fonts, filling in the real values in `lib/brand/tokens.ts`, and writing `MANIFEST.md`.

**Out:** template composition ([T-004](T-004-template-spec-and-registry.md), [T-015](T-015-format-a-pfp-frame.md), [T-016](T-016-format-b-builder-card.md)).

## What to harvest

| Source                                         | Becomes                     | How                                                                                                                        |
| ---------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `hhgoa.com/assets/footer trees.png` (1440×887) | `palms.png` + `flowers.png` | Crop the palm columns and the flower band separately; re-export at 2160 px wide, alpha preserved                           |
| `hhgoa.com/assets/Hacker house.png` (1148×237) | `wordmark.png`              | Already yellow-on-alpha with the black offset. Re-export at 2× the slot width.                                             |
| `hhgoa.com/assets/Sun rise.png` (1440×1438)    | `custom` draw fn            | Do **not** ship this 3.2 MB file. Redraw the sun (half-disc + rays) procedurally — it is ~15 lines and infinitely sharper. |
| `hhgoa.com/assets/goa_hindi.svg` (181×180)     | `goa-devanagari.svg`        | Already SVG and small. `svgo` it.                                                                                          |
| Google Fonts **Imbue**                         | `fonts/display.woff2`       | Static 400 weight, Latin subset                                                                                            |
| Google Fonts **Victor Mono**                   | `fonts/body.woff2`          | 500 weight, Latin subset                                                                                                   |

Both fonts are **SIL OFL** — self-hosting is permitted without further clearance ([Q-3](../11-open-questions.md) resolved).

```bash
# palms: keep the left and right thirds, drop the empty middle
magick "footer trees.png" -crop 1440x760+0+0 +repage -resize 2160x palms-raw.png
magick "footer trees.png" -crop 1440x160+0+727 +repage -resize 2160x flowers-raw.png
npx oxipng -o 4 --strip safe public/branding/*.png
```

Budget check: the source PNGs total ~14 MB. After cropping to what the frame actually needs and crushing, `palms.png` + `flowers.png` + `wordmark.png` should land under 180 KB, leaving room for the two fonts inside the 250 KB total.

## Optimization pipeline

```bash
# SVG — strip editor metadata, keep viewBox, ensure explicit width/height
npx svgo --multipass -i goa_hindi.svg -o public/branding/goa-devanagari.svg

# PNG overlays — export at 2× the template's native size (2160 px), then crush
npx oxipng -o 4 --strip safe public/branding/{palms,flowers,wordmark}.png

# Fonts — subset to Latin + digits + punctuation
pyftsubset display.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201D,U+2026,U+2013-2014" \
  --flavor=woff2 --output-file=public/branding/fonts/display.woff2
```

| Asset                 | Target size  | Notes                                                                                     |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `goa-devanagari.svg`  | < 15 KB      | **Must have explicit `width`/`height`** — Safari refuses to draw an unsized SVG to canvas |
| `palms.png` (2160 px) | < 100 KB     | PNG-24 with alpha; the flat green areas compress very well                                |
| `flowers.png`         | < 50 KB      | Bottom band only                                                                          |
| `wordmark.png`        | < 30 KB      | Already 27 KB at source                                                                   |
| Each font             | < 30 KB      | Latin subset of a variable face                                                           |
| **Total**             | **< 250 KB** | These load on first render, so they are on the critical path                              |

The **sun** is drawn procedurally in a `custom` layer rather than shipped ([T-015](T-015-format-a-pfp-frame.md)) — it is ~15 lines, sharper at every scale, and saves 3.2 MB.

## `MANIFEST.md`

```markdown
# Brand assets

| File                | Source                                     | Retrieved  | Licence     | Notes                    |
| ------------------- | ------------------------------------------ | ---------- | ----------- | ------------------------ |
| palms.png           | hhgoa.com/assets/footer trees.png, cropped | 2026-08-08 | event-owned | 2160 px wide, alpha      |
| flowers.png         | hhgoa.com/assets/footer trees.png, cropped | 2026-08-08 | event-owned | bottom band              |
| wordmark.png        | hhgoa.com/assets/Hacker house.png          | 2026-08-08 | event-owned | yellow + black offset    |
| goa-devanagari.svg  | hhgoa.com/assets/goa_hindi.svg             | 2026-08-08 | event-owned | svgo'd                   |
| fonts/display.woff2 | Google Fonts — Imbue                       | 2026-08-08 | SIL OFL 1.1 | static 400, Latin subset |
| fonts/body.woff2    | Google Fonts — Victor Mono                 | 2026-08-08 | SIL OFL 1.1 | 500, Latin subset        |
```

Record source and licence for every file. In six months, "where did this come from and are we allowed to use it?" is a question with real consequences, and nobody remembers.

## Acceptance criteria

- [ ] `palms.png`, `flowers.png`, `wordmark.png` exist at 2× the slots that use them, with clean alpha
- [ ] The sun is drawn procedurally, not shipped as a 3.2 MB PNG
- [ ] `goa-devanagari.svg` has explicit `width`/`height` and draws to a canvas in **Safari**
- [ ] Imbue and Victor Mono are subset WOFF2 and load in both DOM and canvas
- [ ] `lib/brand/tokens.ts` holds the six real hex values with roles assigned
- [ ] `brand.isPlaceholder === false`
- [ ] Total branding payload < 250 KB
- [ ] `MANIFEST.md` records source, retrieval date, and licence for every file
- [ ] Colours in the exported PNG match `#0B6839` / `#FEE101` / `#FF0080` exactly (sRGB, no P3 drift)

## Files touched

```
public/branding/**
lib/brand/tokens.ts
docs/11-open-questions.md   (Q-18)
```

## How to test

Draw every asset onto a canvas at both 1× and 2×, in Chrome **and** Safari, and export the result. Specifically check:

- The logo SVG appears at all in Safari (the unsized-SVG failure is silent).
- The frame PNG's alpha edges are clean, with no white fringing from being flattened at export.
- The pattern tiles without a visible seam.
- Both fonts render as themselves, not as a fallback.

## Gotchas

- **Unsized SVG + Safari = nothing drawn, no error.** The most common brand-asset bug in canvas work. Always set `width` and `height` in the SVG file itself.
- **`svgo` can break things.** It sometimes removes `viewBox` or mangles clip paths with aggressive settings. Always diff the rendered result, not just the file size.
- **Export overlays at 2×.** A 1080 px frame upscaled to a 2160 px export looks visibly soft, and it is the first thing a designer will spot.
- **Watch for pre-flattened alpha.** Overlays exported with a white background instead of transparency produce a white halo around the photo that is easy to miss on a light-background preview.
- **Imbue is extremely high-contrast.** Its hairlines can disappear when a canvas downsamples. Check the export at thumbnail size, not just at 100%.
- **Colour space.** The site's PNGs may carry a P3 profile; convert to sRGB on intake or the exported green will not match `#0B6839`.
- **These are the event's own assets, used for the event's own task.** That is the intended use, but record provenance in `MANIFEST.md` rather than leaving it implicit.
- **Version the files.** If a v2 logo arrives mid-build, `logo.svg` changing silently makes every visual-regression snapshot fail at once with no obvious cause. Note the swap in `MANIFEST.md` and re-baseline deliberately.

## References

- [13 — Brand Identity](../13-brand-identity.md) — the extracted palette, fonts, and asset inventory
- [06 — Brand & Templates](../06-brand-and-templates.md)
- [11 — Open Questions Q-18](../11-open-questions.md)
