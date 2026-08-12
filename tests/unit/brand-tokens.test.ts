import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "@/lib/brand/tokens";

/**
 * The classic brand-drift failure is the website being one green and the
 * exported PNG being another. Tailwind v4 declares its theme in CSS, so the
 * values necessarily exist in two files — this is what stops them diverging.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");

describe("brand tokens", () => {
  const declared = { ...brand.color, ...brand.ui };

  it.each(Object.entries(declared))("%s (%s) is declared in the Tailwind theme", (_name, hex) => {
    expect(css.toLowerCase()).toContain(hex.toLowerCase());
  });

  it("keeps the palette flat — no gradients anywhere in the theme", () => {
    // The event's visual language is flat vector throughout. `radial-gradient`
    // is allowed: it draws the dotted hairline rule, not a colour ramp.
    expect(css).not.toMatch(/linear-gradient/);
  });

  it("is no longer a placeholder kit", () => {
    expect(brand.isPlaceholder).toBe(false);
  });
});
