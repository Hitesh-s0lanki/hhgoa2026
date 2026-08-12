# T-029 — Cross-device QA matrix

|                |                                                                         |
| -------------- | ----------------------------------------------------------------------- |
| **Phase**      | 6 — Ship                                                                |
| **Status**     | ☐ Not started                                                           |
| **Estimate**   | 3 h                                                                     |
| **Depends on** | [T-020](T-020-download-action.md), [T-025](T-025-native-share-sheet.md) |
| **Blocks**     | T-032                                                                   |
| **Satisfies**  | NFR-4                                                                   |

## Why this exists

Nearly all the real risk in this project is browser behaviour, not our logic: HEIC decoding, EXIF orientation, canvas font rendering, the download destination, the share sheet. None of it can be verified in a headless test, and none of it can be verified on a laptop.

This is the task that finds out whether the thing actually works.

## Scope

**In:** running the manual script on each priority environment, the visual regression suite, recording results, filing what breaks.

**Out:** fixing what breaks (those are bugs against the owning task).

## The matrix

**must** = blocks release · **should** = fix before launch · **best-effort** = note it, do not block

| Environment                      | Priority    | The specific risk here                                                            |
| -------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| iOS Safari 17+, iPhone 12-ish    | **must**    | HEIC from camera roll; Save to Photos; native share to X; memory on a 12 MP photo |
| iOS Safari, older iPhone (SE/11) | should      | memory ceiling; HEIC decode time                                                  |
| Android Chrome, mid-range        | **must**    | HEIC via WASM (Chrome cannot decode natively); download to Files; share sheet     |
| Desktop Chrome                   | **must**    | drag & drop; `<a download>`; intent link                                          |
| Desktop Safari                   | **must**    | canvas font rendering; SVG-to-canvas; download                                    |
| Desktop Firefox                  | should      | `OffscreenCanvas` support; export                                                 |
| Desktop Edge                     | should      | smoke test                                                                        |
| X in-app browser (iOS)           | should      | file picker availability; escape hatch                                            |
| Instagram / WhatsApp in-app      | best-effort | same                                                                              |
| iPad Safari                      | best-effort | tablet layout                                                                     |

### Why these four are "must"

- **iOS Safari** — the majority of real traffic, and the only place HEIC-from-camera-roll and Save-to-Photos can be verified.
- **Android Chrome** — the _only_ place the WASM HEIC path gets exercised, since Safari decodes natively.
- **Desktop Chrome** — drag & drop and the anchor download.
- **Desktop Safari** — WebKit's canvas font metrics and SVG handling differ from Blink's, and this is where the unsized-SVG bug shows up.

Emulators do not substitute. Device labs (BrowserStack) are useful for layout but cannot test the camera roll, the share sheet, or real memory pressure.

## The manual script

Run the full 45-point script from [12 — QA & Testing](../12-qa-and-testing.md#manual-test-script) on each **must** environment. Roughly 15 minutes each.

Grouped as: **A** ingest (10) · **B** framing (6) · **C** render (6) · **D** output (5) · **E** share (8) · **F** accessibility (6) · **G** performance (4).

The five checks most likely to fail, worth doing first as a smoke pass:

```
   A-5   all eight EXIF orientation fixtures appear upright
   A-4   HEIC from the camera roll works
   C-18  canvas text uses the brand font, not a system fallback
   D-27  the image reaches the iOS Photos library
   E-29  X composer opens with the image actually attached
```

If those five pass on iOS and Android, the project is fundamentally sound. If any fails, stop and fix before continuing the script.

## Visual regression

```ts
// tests/e2e/visual.spec.ts
for (const templateId of ["pfp-frame", "builder-card"] as const) {
  for (const fixture of ["portrait-3x4", "landscape-4x3", "square-1x1"]) {
    test(`${templateId} × ${fixture}`, async ({ page }) => {
      await page.goto(`/?__test=1&template=${templateId}`);
      await page.setInputFiles("input[type=file]", `tests/fixtures/aspect/${fixture}.jpg`);
      await page.waitForSelector('[data-render-settled="true"]');
      await expect(page.locator("canvas")).toHaveScreenshot(
        `${templateId}-${fixture}-${test.info().project.name}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }
}
```

Two things make this reliable rather than flaky:

1. **`data-render-settled`** ([T-021](T-021-live-preview-surface.md)) — never screenshot on a timeout.
2. **`__test=1`** — seeds or disables the procedural grain ([T-015](T-015-format-a-pfp-frame.md)), because per-render noise defeats pixel comparison entirely.

Run in Chromium **and** WebKit, with per-project snapshot names — font rasterization differs between engines, so one shared baseline will always fail somewhere. Expect a small legitimate diff between engines; that is why the baselines are separate rather than why the tolerance is loose.

## Recording results

Keep a simple table in the PR or a `QA-RESULTS.md`:

```markdown
| Env                   | Date       | Build   | A   | B   | C   | D   | E   | F   | G   | Notes                                                          |
| --------------------- | ---------- | ------- | --- | --- | --- | --- | --- | --- | --- | -------------------------------------------------------------- |
| iOS 17 / iPhone 13    | 2026-02-10 | a1b2c3d | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | —                                                              |
| Android 14 / Pixel 6a | 2026-02-10 | a1b2c3d | ✔   | ✔   | ✔   | ✔   | ⚠   | ✔   | ✔   | E-30 caption dropped by X app — expected, clipboard note shown |
```

Record the build SHA. "It worked when I tested it" is not useful without knowing which build, and the answer is often that the build changed.

## Acceptance criteria

- [ ] The full manual script passes on all four **must** environments
- [ ] All **should** environments pass or have a filed, triaged issue
- [ ] The five high-risk checks pass on both iOS and Android
- [ ] Visual snapshots are committed for Chromium and WebKit
- [ ] Visual tests are green with `maxDiffPixelRatio: 0.01`
- [ ] Grain is deterministic under `__test=1`
- [ ] `data-render-settled` is used for every screenshot wait — no timeouts
- [ ] Results recorded with environment, date, and build SHA
- [ ] Every failure is filed against the owning task, not fixed silently here
- [ ] The X in-app browser path is tested by opening a real tweet link

## Files touched

```
tests/e2e/visual.spec.ts
tests/e2e/happy-path.spec.ts
tests/e2e/__screenshots__/**
playwright.config.ts
QA-RESULTS.md
```

## How to test

Set up remote debugging so failures are diagnosable rather than mysterious:

- **iOS:** connect the iPhone, Safari → Develop → [device] → Web Inspector.
- **Android:** `chrome://inspect` with USB debugging on.

Then work the script in order per device, with the console open. A silent failure with a console error is a five-minute fix; the same failure with no console is an afternoon.

For the in-app browser, post the URL to a throwaway X account from another device and open it from the timeline. Pasting into the in-app browser's address bar is not the same code path.

## Gotchas

- **Emulators cannot test what matters here.** No camera roll, no real share sheet, no real memory limits, no real HEIC. Use them for layout only.
- **BrowserStack has the same limitation** for these specific risks. Useful, not sufficient.
- **iOS Safari's memory ceiling is aggressive** and the tab dies without a JS error. If a device reloads mid-test, suspect a bitmap leak ([T-008](T-008-exif-and-downscale.md)) rather than a crash in your code.
- **Font rasterization differs between Chromium and WebKit.** Separate baselines, not a loosened tolerance — loosening the tolerance hides real regressions.
- **Unseeded procedural noise makes every snapshot fail.** Seed it, or disable it in test mode.
- **HEIC test files must be genuine.** A JPEG renamed `.heic` tests nothing. Take real photos on a real iPhone in High Efficiency mode.
- **Test with the X app both installed and not installed.** Different code paths, and the not-installed case sends users to a mobile web composer that behaves differently.
- **Re-run the visual suite after any brand asset change.** A new logo version will fail every snapshot at once, which is correct — re-baseline deliberately rather than loosening the check.

## References

- [12 — QA & Testing](../12-qa-and-testing.md)
- [02 — Requirements, NFR-4](../02-requirements.md#nfr-4--compatibility)
