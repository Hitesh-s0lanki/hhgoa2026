# 12 — QA & Testing

## Testing strategy

The pyramid here is unusual: most of the risk sits in _browser behaviour_ (HEIC, EXIF, download, share), not in our logic. So the investment is heavier at the ends — pure-function unit tests and real-device manual testing — and lighter in the middle.

```
        ▲
        │   real-device manual        ← highest value, irreplaceable
        │   ████████████
        │
        │   visual regression         ← catches template drift
        │   ██████
        │
        │   e2e (Playwright)          ← the happy path only
        │   ████
        │
        │   unit (Vitest)             ← geometry, text layout, titles, validation
        │   ████████████
        ▼
```

Rationale: nothing in a headless test can tell you whether an iPhone will save the PNG to the camera roll, and nothing on a device can tell you whether `coverFit` preserves aspect ratio for a 10000×100 panorama. Use each for what it can actually prove.

---

## Fixtures

These are a hard deliverable, not optional scaffolding. Most of the bugs in this project class are fixture-shaped.

```
tests/fixtures/
├── orientation/          exif-1.jpg … exif-8.jpg
│                         All eight EXIF orientation values, each depicting an
│                         obviously-asymmetric scene (text works well) so a wrong
│                         rotation is visible at a glance.
│                         Source: generate with exiftool from one base image.
│
├── aspect/
│   ├── portrait-3x4.jpg          3000 × 4000   subject in upper third
│   ├── portrait-9x16.jpg         1080 × 1920
│   ├── landscape-4x3.jpg         4000 × 3000   subject off-centre left
│   ├── landscape-16x9.jpg        1920 × 1080
│   ├── square-1x1.jpg            2000 × 2000
│   ├── panorama.jpg             10000 ×  100   extreme, must not crash
│   ├── strip.jpg                  100 × 10000  extreme, must not crash
│   └── tiny.jpg                    40 ×    40  below MIN_EDGE → must be rejected
│
└── formats/
    ├── photo.jpg          baseline
    ├── photo-progressive.jpg
    ├── photo.png          with alpha
    ├── photo.webp
    ├── iphone.heic        straight off an iPhone, EXIF intact
    ├── iphone-hdr.heic    10-bit / HDR gain map — a real-world decode edge case
    ├── corrupt.jpg        valid header, truncated body
    ├── zero.jpg           0 bytes
    ├── notaphoto.pdf      wrong type entirely
    └── huge.jpg           ~40 MP, ~30 MB — must hit the size cap
```

Generating the orientation set:

```bash
for i in 1 2 3 4 5 6 7 8; do
  cp base.jpg "exif-$i.jpg"
  exiftool -overwrite_original -Orientation=$i -n "exif-$i.jpg"
done
```

---

## Unit tests (Vitest)

Only pure functions. No DOM, no canvas mocking beyond a minimal 2D-context stub for text metrics.

### `fit.test.ts` — the invariants that matter

```ts
describe("coverFit", () => {
  const slots = [
    { w: 1, h: 1 },
    { w: 1080, h: 1350 },
    { w: 1920, h: 1080 },
  ];
  const images = [
    { width: 3000, height: 4000 },
    { width: 4000, height: 3000 },
    { width: 2000, height: 2000 },
    { width: 10000, height: 100 },
    { width: 100, height: 10000 },
  ];

  for (const slot of slots)
    for (const img of images) {
      it(`preserves aspect ratio: ${img.width}x${img.height} → ${slot.w}x${slot.h}`, () => {
        const r = coverFit(img, slot);
        expect(r.sw / r.sh).toBeCloseTo(slot.w / slot.h, 5); // no distortion, ever
      });

      it(`stays in bounds: ${img.width}x${img.height} → ${slot.w}x${slot.h}`, () => {
        for (const t of [
          { scale: 1, offsetX: 0, offsetY: 0 },
          { scale: 1, offsetX: -1, offsetY: -1 },
          { scale: 1, offsetX: 1, offsetY: 1 },
          { scale: 3, offsetX: 1, offsetY: -1 },
        ]) {
          const r = coverFit(img, slot, t);
          expect(r.sx).toBeGreaterThanOrEqual(0);
          expect(r.sy).toBeGreaterThanOrEqual(0);
          expect(r.sx + r.sw).toBeLessThanOrEqual(img.width + 1e-6);
          expect(r.sy + r.sh).toBeLessThanOrEqual(img.height + 1e-6);
        }
      });
    }

  it("returns the whole image for a square photo in a square slot", () => {
    const r = coverFit({ width: 500, height: 500 }, { w: 100, h: 100 });
    expect(r).toMatchObject({ sx: 0, sy: 0, sw: 500, sh: 500 });
  });

  it("biases portraits upward", () => {
    const r = coverFit({ width: 3000, height: 4000 }, { w: 1, h: 1 });
    const centred = (4000 - 3000) / 2;
    expect(r.sy).toBeLessThan(centred); // head-room, not chest-centred
  });
});
```

The two "for every input" properties — aspect preserved, always in bounds — are worth more than any number of example tests. They are the formal statement of FR-2.1.

### Other unit suites

| Suite              | Asserts                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text.test.ts`     | shrink stops at `minSize`; wrap respects `maxLines`; overflow ellipsizes; a 200-char single word still fits; empty string draws nothing                                                 |
| `titles.test.ts`   | same role → same title (deterministic); every role in a 40-entry corpus maps to something; unknown role gets a sane generic; reroll changes the output and cycles rather than repeating |
| `validate.test.ts` | every fixture in `formats/` gets the right verdict; HEIC brands all sniff correctly; `file.type` lies are ignored in favour of magic bytes                                              |
| `caption.test.ts`  | assembled caption + t.co allowance is under 280; `#` and newlines survive URL encoding                                                                                                  |

---

## Visual regression (Playwright)

The only reliable defence against silent template drift and wrong-font rendering.

```ts
// tests/e2e/visual.spec.ts
for (const templateId of ["pfp-frame", "builder-card"] as const) {
  for (const fixture of ["portrait-3x4", "landscape-4x3", "square-1x1"]) {
    test(`${templateId} × ${fixture}`, async ({ page }) => {
      await page.goto(`/?__test=1&template=${templateId}`);
      await page.setInputFiles("input[type=file]", `tests/fixtures/aspect/${fixture}.jpg`);
      await page.waitForSelector('[data-render-settled="true"]');
      await expect(page.locator("canvas")).toHaveScreenshot(`${templateId}-${fixture}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}
```

Two things make this work rather than flake:

1. **`data-render-settled`** — an explicit attribute the app sets after fonts are loaded, assets are preloaded, and the render has completed. Never screenshot on a timeout.
2. **Deterministic mode** — `__test=1` disables the procedural grain layer (or seeds it), because per-render noise defeats pixel comparison.

Run it in Chromium and WebKit. WebKit is where font metrics and SVG-to-canvas differences show up.

---

## E2E happy path

```ts
test("upload → preview → download", async ({ page }) => {
  await page.goto("/");
  const download = page.waitForEvent("download");
  await page.setInputFiles("input[type=file]", "tests/fixtures/aspect/portrait-3x4.jpg");
  await page.waitForSelector('[data-render-settled="true"]');
  await page.getByRole("button", { name: /download/i }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^hh-goa-2026-.*\.png$/);
});
```

Keep e2e coverage thin and on the critical path. The unhappy paths are cheaper and more thoroughly covered as unit tests plus the manual script below.

---

## Device / browser matrix

Legend: **must** = blocks release · **should** = fix before launch · **best-effort** = note it, do not block

| Environment                             | Priority    | Specifically verify                                                                           |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| **iOS Safari 17+, iPhone 12-ish**       | must        | HEIC from camera roll; save to Photos; native share sheet to X; no tab crash on a 12 MP photo |
| **iOS Safari, older iPhone (SE/11)**    | should      | memory ceiling; HEIC decode time                                                              |
| **Android Chrome, mid-range**           | must        | HEIC → WASM path (Chrome cannot decode natively); download to Files; share sheet              |
| **Desktop Chrome**                      | must        | drag & drop; `<a download>`; intent link opens X                                              |
| **Desktop Safari**                      | must        | canvas font rendering; SVG-to-canvas quirks; download                                         |
| **Desktop Firefox**                     | should      | `OffscreenCanvas` support; export                                                             |
| **Desktop Edge**                        | should      | smoke test                                                                                    |
| **X in-app browser (iOS)**              | should      | file picker availability; if blocked, the "open in Safari" escape hatch appears               |
| **Instagram / WhatsApp in-app browser** | best-effort | same                                                                                          |
| **iPad Safari**                         | best-effort | layout at tablet widths                                                                       |

Emulators do not substitute here. The HEIC path, the memory ceiling, and the share sheet all behave differently on real hardware.

---

## Manual test script

Run the whole thing on each **must** environment before release. Estimated 15 minutes per device.

### A · Ingest

1. ☐ Land on the page. Nothing blocks the CTA; no console errors.
2. ☐ Upload a JPEG. Preview appears in under ~1 s.
3. ☐ Upload a PNG with transparency. No black box artefacts.
4. ☐ Upload a HEIC straight from the camera roll. Works; the "Converting…" state appears only if it is genuinely slow.
5. ☐ Upload each of `exif-1` … `exif-8`. **All eight appear upright.**
6. ☐ Upload a PDF. Recoverable error; the drop zone still works afterwards.
7. ☐ Upload a 0-byte file. Recoverable error.
8. ☐ Upload `huge.jpg` (~30 MB). Either handled or cleanly rejected by the cap — never a hang.
9. ☐ Upload `tiny.jpg` (40 px). Rejected with a useful message.
10. ☐ Replace the photo three times in a row. No crash, no memory growth, no stale preview.

### B · Framing

11. ☐ Portrait photo → face is framed with headroom, not chest-centred.
12. ☐ Landscape photo → subject is not cropped out.
13. ☐ Square photo → fills exactly, nothing lost.
14. ☐ Panorama → does not crash; result is a sane centre crop.
15. ☐ Drag the photo. It moves smoothly (60 fps) and stops at the edges without showing gaps.
16. ☐ Zoom to maximum. No transparent slivers at any edge.

### C · Render

17. ☐ The frame/pattern/logo all appear. Nothing is missing on the very first render (asset preload).
18. ☐ **Fonts are the brand faces, not a system fallback.** Compare against the design reference.
19. ☐ Format B: type a 60-character name. It shrinks, then wraps, then ellipsizes. It never overflows the card.
20. ☐ Format B: leave every field empty. Placeholders render; the layout is not broken.
21. ☐ Format B: paste an emoji and a non-Latin character into the name. Either renders or degrades gracefully — no `tofu` boxes in the middle of the card.
22. ☐ Reroll the builder title several times. It changes and stays legible at the longest option.

### D · Output

23. ☐ Download. The file lands somewhere the user can find it.
24. ☐ Open the file. Resolution ≥ 1080 px; text is crisp, not blurry.
25. ☐ Filename is meaningful.
26. ☐ **The downloaded file matches the on-screen preview exactly.**
27. ☐ iOS: the image reaches the Photos library (via share sheet → Save Image).

### E · Share

28. ☐ Tap share on mobile. The OS sheet appears with the image attached.
29. ☐ Choose X. The composer opens with the image genuinely attached.
30. ☐ Caption is available (in the composer or on the clipboard, with the UI saying which).
31. ☐ Desktop: the intent link opens X with the caption pre-filled.
32. ☐ Link route: post the `/share/[id]` URL and confirm the card shows **the generated graphic**.
33. ☐ Paste the same URL into WhatsApp. The preview shows the graphic.
34. ☐ Open `/share/<garbage-id>`. Friendly page, not a stack trace.
35. ☐ Turn off the network mid-session. Download still works; share-link is disabled with a stated reason.

### F · Accessibility (T-030)

36. ☐ Complete the entire flow with keyboard only.
37. ☐ Every interactive element has a visible focus ring.
38. ☐ VoiceOver / TalkBack announces the upload zone, the preview, and each action meaningfully.
39. ☐ Text contrast in the UI chrome meets 4.5:1.
40. ☐ Errors are announced (`role="alert"` / live region), not only shown.
41. ☐ `prefers-reduced-motion` suppresses the crop-adjust animation.

### G · Performance (T-028)

42. ☐ Lighthouse mobile ≥ 90 on performance.
43. ☐ Initial JS transfer ≤ 200 KB gzip; the HEIC and face chunks are **not** in it.
44. ☐ Slider drag stays at 60 fps under 4× CPU throttling.
45. ☐ No layout shift when the preview appears (reserve the aspect box).

---

## Definition of done, per task

A task is not done until:

- ☐ Its acceptance criteria in `tasks/T-0xx-*.md` are all checked.
- ☐ Unit tests exist for any pure function it introduced.
- ☐ `npm run build` and `npx tsc --noEmit` pass clean.
- ☐ It was exercised on at least one real mobile device if it touches ingest, output, or share.
- ☐ Its checkbox in [TASKLIST.md](TASKLIST.md) is ticked, and any assumption it forced is recorded in [11](11-open-questions.md).

## Release gate

Ship only when:

- ☐ Every **must** row in the device matrix passes the full manual script.
- ☐ All P0 requirements in [02](02-requirements.md) are met.
- ☐ Visual regression snapshots are committed and green in Chromium + WebKit.
- ☐ The privacy line is visible in the UI and accurate about what is uploaded.
- ☐ Storage lifecycle expiry is actually configured on the bucket (verify, do not assume).
- ☐ Any cut scope is written down in the project README ([T-032](tasks/T-032-deploy-and-release.md)).
