import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Route } from "@playwright/test";
import { passIdPattern } from "../../lib/share/pass-id";
import { passQrTarget } from "../../lib/share/qr-target";
import { createPassSchema } from "../../lib/share/schema";

/**
 * The share path, with UploadThing and the database stubbed out.
 *
 * Everything between "press Post on X" and "a tab opens on the intent URL" is
 * covered here without a single credential: the two card images are rendered
 * and handed to the uploader, the request to `/api/pass` is checked against the
 * *real* zod schema the route validates with, and the composed X URL is
 * asserted on. What is not covered is UploadThing and Neon actually working,
 * which is a deployment concern, not a code one.
 *
 * Validating the captured body with `createPassSchema` rather than a hand-written
 * shape is the point of the test: it is the same object the route parses, so a
 * field renamed on one side fails here instead of in production as a 400.
 */

const PHOTO = {
  name: "builder.jpg",
  mimeType: "image/jpeg",
  buffer: readFileSync(resolve("tests/fixtures/formats/builder.jpg")),
};

/** A host that matches the schema's UploadThing allowlist without being real. */
const INGEST = "https://ingest.test.ufs.sh";
const CDN = "https://appid.ufs.sh/f";

type Captured = { uploads: string[][]; body: unknown };

/**
 * UploadThing's browser flow is three requests: presign against our own route,
 * a HEAD to discover a resume offset, then the PUT that carries the bytes.
 * All three are intercepted so nothing leaves the machine.
 */
async function stubUploads(context: BrowserContext): Promise<Captured> {
  const captured: Captured = { uploads: [], body: null };

  // On the context, not the page: the share opens a second page and the X
  // intent must be intercepted there too, or the test hits the real x.com.
  await context.route("https://x.com/**", (route: Route) =>
    route.fulfill({ contentType: "text/html", body: "<title>x stub</title>" }),
  );

  await context.route("**/api/uploadthing**", async (route: Route) => {
    const payload = route.request().postDataJSON() as { files: { name: string }[] };
    const names = payload.files.map((file) => file.name);
    captured.uploads.push(names);

    await route.fulfill({
      json: names.map((name, index) => ({
        url: `${INGEST}/${index}`,
        key: `key-${index}`,
        name,
        customId: null,
      })),
    });
  });

  await context.route(`${INGEST}/**`, async (route: Route) => {
    if (route.request().method() === "HEAD") {
      return route.fulfill({ status: 200, headers: { "x-ut-range-start": "0" } });
    }
    const key = new URL(route.request().url()).pathname.slice(1);
    return route.fulfill({
      json: {
        url: `${CDN}/key-${key}`,
        appUrl: `${CDN}/key-${key}`,
        ufsUrl: `${CDN}/key-${key}`,
        fileHash: `hash-${key}`,
        serverData: null,
      },
    });
  });

  await context.route("**/api/pass", async (route: Route) => {
    captured.body = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        id: "abc123def456",
        shareUrl: "https://hhgoa.test/share/abc123def456",
        imageUrl: "https://appid.ufs.sh/f/og-key",
      },
    });
  });

  return captured;
}

test("posting to X renders, uploads, saves and opens the intent", async ({ page, context }) => {
  const captured = await stubUploads(context);

  await page.goto("/#generate");
  await page.getByRole("textbox", { name: "Role" }).fill("ML Engineer");
  await expect(page.getByRole("textbox", { name: "Builder class" })).not.toHaveValue("BUILDER");
  await page.getByRole("textbox", { name: "Your name" }).fill("Hitesh Solanki");
  await page.getByRole("textbox", { name: "Stack" }).fill("Next.js · TS · AWS");
  await page.setInputFiles('input[type="file"]', PHOTO);
  await expect(page.getByText(PHOTO.name)).toBeVisible();

  // The photo goes up on pick, before any button is pressed. That head start is
  // the reason the share tap only pays for the card.
  await expect.poll(() => captured.uploads.length).toBeGreaterThan(0);
  expect(captured.uploads[0]).toEqual([PHOTO.name]);

  await page.getByRole("button", { name: /generate pass/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const started = Date.now();
  // The tab is opened synchronously with the click, long before there is a URL
  // to put in it — waiting on the *event* would time the popup, not the share.
  const tab = context.waitForEvent("page");
  await dialog.getByRole("button", { name: /post on x/i }).click();
  const opened = await tab;
  expect(opened.url()).toBe("about:blank");

  // The link appearing in the dialog is the flow's own "done" signal.
  const link = dialog.getByRole("link", { name: /share\/abc123def456/ });
  await expect(link).toBeVisible();
  console.info(`[perf] share completed in ${Date.now() - started} ms`);

  await opened.waitForURL(/x\.com/);

  /*
   * The card and its OG crop go up together, in one call, so the two PUTs
   * overlap instead of queueing.
   *
   * Matched by pattern, not by exact name: the sheet is WebP where the browser
   * can encode it and PNG where it cannot (WebKit), and on WebKit it is the
   * very same File as the download rather than a second identical capture.
   * The OG crop is always PNG — crawlers, not browsers, read it.
   */
  const [sheetName, ogName] = captured.uploads[1] ?? [];
  expect(sheetName).toMatch(/^hhgoa-2026-(card|pass)-hitesh-solanki\.(webp|png)$/);
  expect(ogName).toBe("hhgoa-2026-og-hitesh-solanki.png");

  // The exact object the route will parse. A mismatch is a 400 in production.
  const parsed = createPassSchema.safeParse(captured.body);
  expect(parsed.error?.issues ?? []).toEqual([]);
  expect(parsed.success && parsed.data).toMatchObject({
    name: "Hitesh Solanki",
    role: "ML Engineer",
    stack: "Next.js · TS · AWS",
    title: "MODEL WRANGLER",
    passNumber: "HHG-2026-7922",
  });

  /*
   * The QR code on the card has to point at the pass this request just created,
   * which means the id was minted in the browser and painted onto the capture
   * surface *before* the card was rasterised. The capture surface is the DOM
   * that was photographed, so its code is the one inside the uploaded PNG.
   *
   * `passQrTarget` is asserted through rather than hard-coded because the
   * answer depends on the origin: on this suite's localhost it is the event
   * site (a code that scanned to `localhost` would be dead on the only device
   * anyone scans with), and on a deployed origin it is `/share/<id>`. Both
   * branches are unit-tested; this pins the wiring that feeds it.
   */
  const id = (captured.body as { id: string }).id;
  expect(id).toMatch(passIdPattern);
  await expect(page.locator('[inert] svg[role="img"]').first()).toHaveAttribute(
    "aria-label",
    `QR code linking to ${passQrTarget(id)}`,
  );

  // A composed post, not a bare link: the caption and tags are pre-filled for
  // the user to edit before posting.
  const intent = new URL(opened.url());
  expect(intent.origin + intent.pathname).toBe("https://x.com/intent/post");
  expect(intent.searchParams.get("text")).toContain("Hitesh Solanki");
  expect(intent.searchParams.get("text")).toContain("MODEL WRANGLER");
  expect(intent.searchParams.get("hashtags")).toContain("FrameInGoa");

  /*
   * The suite runs on http://localhost, which is *not* a public origin — so
   * this asserts the fallback, because that is what actually happens here.
   * Posting the share page from a dev machine would put a link in a real tweet
   * that 404s for everyone including the author on their phone; the image URL
   * is at least reachable. The UI says so rather than doing it silently.
   *
   * `resolvePostUrl` is unit-tested on both branches — this only pins the wiring.
   */
  expect(intent.searchParams.get("url")).toBe("https://appid.ufs.sh/f/og-key");
  await expect(dialog.getByText(/NEXT_PUBLIC_SITE_URL is not a public address/)).toBeVisible();

  // Both URLs are offered either way: the page is what you post, the image is
  // the file itself for anywhere that wants an image source.
  await expect(
    dialog.getByRole("link", { name: "https://hhgoa.test/share/abc123def456" }),
  ).toBeVisible();
  await expect(dialog.getByRole("link", { name: "https://appid.ufs.sh/f/og-key" })).toBeVisible();
});

test("an unknown share id 404s instead of erroring", async ({ page }) => {
  // Also the shape of every request when `DATABASE_URL` is unset: `getPass`
  // returns null rather than throwing, so a missing database is a 404 page and
  // not a 500 on a URL someone has already posted.
  const response = await page.goto("/share/doesnotexist");
  expect(response?.status()).toBe(404);
});

test("the pass API refuses to store an image URL it did not issue", async ({ request }) => {
  // The stored URL becomes this domain's og:image. Anything that gets past the
  // allowlist unfurls an attacker's picture under our name.
  const response = await request.post("/api/pass", {
    data: {
      name: "Attacker",
      title: "X",
      passNumber: "HHG-2026-0001",
      cardUrl: "https://evil.example.com/defacement.png",
    },
  });

  // 400 (rejected) locally, or 503 when there is no database to write to —
  // never 201. Both are refusals; only a 2xx would be the bug.
  expect([400, 503]).toContain(response.status());
});

test("a failed save leaves the editor usable and says why", async ({ page, context }) => {
  await stubUploads(context);
  // Registered after the stub and on the page, so this handler wins.
  await page.route("**/api/pass", (route) =>
    route.fulfill({ status: 503, json: { error: "Link sharing is not configured." } }),
  );

  await page.goto("/#generate");
  await page.getByRole("textbox", { name: "Your name" }).fill("Hitesh Solanki");
  await page.getByRole("button", { name: /generate pass/i }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /post on x/i }).click();

  await expect(dialog.getByText("Link sharing is not configured.")).toBeVisible();

  // The failure must not strand the buttons in a spinner — download is the path
  // that still works when the server does not, and it has to stay reachable.
  await expect(dialog.getByRole("button", { name: /download the card/i })).toBeEnabled();
});
