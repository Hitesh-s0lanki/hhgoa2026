import { expect, test } from "@playwright/test";

/**
 * `GET /api/passes` — the session-scoped list behind the "Your passes" section.
 *
 * These stay hermetic: they never create a pass, because doing so would write a
 * row to a real Neon database on every CI run. What they pin is the contract and
 * the isolation, which is the part that would be dangerous to get wrong.
 */

test("a browser with no passes gets an empty list, not an error", async ({ request }) => {
  // Also the shape when DATABASE_URL is unset: reads degrade to empty rather
  // than throwing, so the landing page never shows an error panel for a
  // section nobody asked for.
  const response = await request.get("/api/passes");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ passes: [] });
});

test("the list is never cached where another person could be served it", async ({ request }) => {
  const cacheControl = (await request.get("/api/passes")).headers()["cache-control"] ?? "";
  // `private` keeps it out of any shared cache in between; `no-store` keeps it
  // out of the browser's own, so a second person on a shared laptop cannot get
  // the first one's list off disk.
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
});

test("the session cannot be supplied as a parameter", async ({ request }) => {
  /*
   * The whole security model of this endpoint is that the session comes from an
   * httpOnly cookie and nowhere else. If a query parameter could name a session,
   * the ids in every posted share link would become a way to enumerate other
   * people's passes. Passing one must change nothing.
   */
  const forged = await request.get(
    "/api/passes?session=6ba7b810-9dad-11d1-80b4-00c04fd430c8&sessionId=6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  );
  expect(forged.status()).toBe(200);
  expect(await forged.json()).toEqual({ passes: [] });
});

test("the section is absent entirely for a browser that has made nothing", async ({ page }) => {
  await page.goto("/");
  // Not an empty state — absent. A first-time visitor should meet the form, not
  // a panel explaining that they have no passes.
  await expect(page.getByRole("heading", { name: /your passes/i })).toHaveCount(0);
});
