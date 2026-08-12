import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The export path, end to end in a real browser.
 *
 * These are the tests that matter most in this suite, because the whole
 * download/share feature rests on one assumption a unit test cannot check:
 * that `modern-screenshot` can clone the card's DOM — `next/font` faces, the
 * arch's percentage border-radius, a `blob:` photo, inline SVG ornaments, a CSS
 * transform — and paint it to a canvas correctly, in every engine.
 *
 * So they assert on the actual PNG bytes and on how long it took, not on a
 * button changing colour.
 */

/**
 * A 4:3 photo with four distinct quadrants. Solid colours make it obvious in a
 * failure screenshot which way up the crop landed, and a real JPEG (not a 1×1
 * pixel) means `createImageBitmap` and the embedder do real work.
 */
const PHOTO = {
  name: "builder.jpg",
  mimeType: "image/jpeg",
  // Resolved from the repo root, which is where Playwright runs.
  buffer: readFileSync(resolve("tests/fixtures/formats/builder.jpg")),
};

/** Generous: CI runners are slow and the first capture fetches both fonts. */
const RENDER_BUDGET_MS = 10_000;

async function fillPass(page: import("@playwright/test").Page) {
  await page.goto("/#generate");

  // Proves hydration has taken over the controlled inputs before we type.
  await page.getByRole("textbox", { name: "Role" }).fill("ML Engineer");
  await expect(page.getByRole("textbox", { name: "Builder class" })).not.toHaveValue("BUILDER");

  await page.getByRole("textbox", { name: "Your name" }).fill("Hitesh Solanki");
  await page.getByRole("textbox", { name: "Stack" }).fill("Next.js · TS · AWS");

  await page.setInputFiles('input[type="file"]', PHOTO);
  await expect(page.getByText(PHOTO.name)).toBeVisible();
}

test("downloads a real PNG of the complete card, both faces", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await fillPass(page);
  await page.getByRole("button", { name: /generate pass/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const started = Date.now();
  const downloadPromise = page.waitForEvent("download", { timeout: RENDER_BUDGET_MS });
  await dialog.getByRole("button", { name: /download the card/i }).click();
  const download = await downloadPromise;
  const elapsed = Date.now() - started;

  // The filename carries the builder's name — this is a file people keep.
  expect(download.suggestedFilename()).toBe("hhgoa-2026-pass-hitesh-solanki.png");

  const path = await download.path();
  const bytes = readFileSync(path);

  // A real PNG: magic bytes, then the IHDR dimensions as big-endian uint32s.
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(bytes.readUInt32BE(16)).toBe(704 * 3);
  expect(bytes.readUInt32BE(20)).toBe(556 * 3);

  // Two full-size cards and a photo do not compress to a few KB. A blank or
  // half-cloned capture would — this is the assertion that catches a silently
  // empty render, which is the failure mode that matters.
  expect(bytes.byteLength).toBeGreaterThan(40_000);

  expect(errors).toEqual([]);
  console.info(`[perf] download rendered in ${elapsed} ms`);
  expect(elapsed).toBeLessThan(RENDER_BUDGET_MS);
});

test("the download is a lossless PNG regardless of what the wire format is", async ({ page }) => {
  await fillPass(page);
  await page.getByRole("button", { name: /generate pass/i }).click();

  const dialog = page.getByRole("dialog");
  const downloadPromise = page.waitForEvent("download", { timeout: RENDER_BUDGET_MS });
  await dialog.getByRole("button", { name: /download the card/i }).click();
  const download = await downloadPromise;

  /*
   * Chromium encodes the *uploaded* sheet as WebP because it is 2.3× smaller,
   * but the file a person keeps must stay PNG — it gets re-uploaded to places
   * whose forms only take PNG or JPEG. This asserts the two never got crossed.
   */
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
});

test("export is blocked, with a reason, until the pass has a name", async ({ page }) => {
  await page.goto("/#generate");
  await page.getByRole("button", { name: /generate pass/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /download the card/i })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: /post on x/i })).toBeDisabled();
  await expect(dialog.getByText(/add your name/i)).toBeVisible();
});

test("the offscreen capture surface never reaches the page or the a11y tree", async ({ page }) => {
  await fillPass(page);

  // It is a whole second copy of the card. If it were reachable, every field on
  // it would be read out twice and the page would have duplicate tab stops.
  const surface = page.locator("[inert]");
  await expect(surface).toHaveCount(1);
  await expect(surface).toHaveAttribute("aria-hidden", "true");

  // And it must not widen the document — a 1200px node parked off-screen with
  // the wrong positioning is a horizontal scrollbar on every phone.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("proxy issues a session cookie on the first request and keeps it", async ({ page }) => {
  await page.goto("/");

  const read = async () =>
    (await page.context().cookies()).find((cookie) => cookie.name === "hhg_sid");

  const first = await read();
  expect(first?.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(first?.httpOnly).toBe(true);
  expect(first?.sameSite).toBe("Lax");

  // Stable across navigations — a fresh id per request would scatter one
  // person's passes across as many sessions as pages they visited.
  await page.goto("/about");
  expect((await read())?.value).toBe(first?.value);
});
