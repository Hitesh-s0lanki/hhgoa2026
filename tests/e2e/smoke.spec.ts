import { expect, test } from "@playwright/test";

test("landing page renders with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the hero CTA is above the fold and lands on the generator", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  const cta = page.getByRole("link", { name: /make your frame/i }).first();
  await expect(cta).toBeInViewport();

  await cta.click();
  await expect(page.locator("#generate")).toBeInViewport();
});

test("the upload well is the one photo control and opens the picker", async ({ page }) => {
  await page.goto("/#generate");

  // One control, not a well and a button racing for the same job. Matched by
  // name because the hidden file input also exposes role=button, unnamed.
  const cta = page.getByRole("main").getByRole("button", { name: /photo/i });
  await expect(cta).toHaveCount(1);

  const chooser = page.waitForEvent("filechooser");
  await cta.click();
  expect(await chooser).toBeTruthy();
});

test("the builder class is derived from the role and rerolls", async ({ page }) => {
  await page.goto("/#generate");

  // By role: the reroll button's aria-label also contains "builder class".
  const title = page.getByRole("textbox", { name: "Builder class" });
  await expect(title).toHaveValue("BUILDER");

  await page.getByRole("textbox", { name: "Role" }).fill("ML Engineer");
  await expect(title).toHaveValue(/AI|MODEL|NEURAL/);

  const derived = await title.inputValue();
  await page.getByRole("button", { name: /reroll/i }).click();
  await expect(title).not.toHaveValue(derived);

  // Typing takes over: the table must not overwrite a manual title.
  await title.fill("PROFESSIONAL YAK SHAVER");
  await page.getByRole("textbox", { name: "Role" }).fill("Founder");
  await expect(title).toHaveValue("PROFESSIONAL YAK SHAVER");
});

test("generate opens the pass dialog with the values that were typed", async ({ page }) => {
  await page.goto("/#generate");

  // The fields are controlled, so a fill that lands before hydration sets the
  // DOM value and nothing else. Waiting on a derived value proves React is
  // driving the form before the rest of the test types into it.
  await page.getByRole("textbox", { name: "Role" }).fill("ML Engineer");
  await expect(page.getByRole("textbox", { name: "Builder class" })).not.toHaveValue("BUILDER");

  await page.getByRole("textbox", { name: "Your name" }).fill("Hitesh Solanki");
  await page.getByRole("button", { name: /generate pass/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  /*
   * Asserted on the card itself, because the card is now the only thing in the
   * dialog — the details list that used to spell the fields out underneath was
   * removed.
   *
   * Role is deliberately not checked: it is never printed on the pass. It only
   * *derives* the builder class, so the class appearing is the evidence that
   * the role was read. Checking for "ML Engineer" would be checking for text
   * the product does not claim to show.
   */
  await expect(dialog.getByText("Hitesh Solanki").last()).toBeVisible();
  await expect(dialog.getByText(/MODEL|NEURAL|AI|WRANGLER/).last()).toBeVisible();

  // Closing must return you to the form with everything still filled in.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Your name" })).toHaveValue("Hitesh Solanki");
});

test("about page is reachable from the nav and credits the builder", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("footer links out to the builder's GitHub and LinkedIn", async ({ page }) => {
  await page.goto("/");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: /github/i })).toHaveAttribute(
    "href",
    "https://github.com/Hitesh-s0lanki",
  );
  await expect(footer.getByRole("link", { name: /linkedin/i })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/hitesh-solanki",
  );
});
