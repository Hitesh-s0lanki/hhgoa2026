import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/render/rasterize";

/**
 * `slugify` only ever produces a filename, but that filename is what someone
 * sees in their downloads folder after making the thing — and a name that
 * collapses to nothing, or to a path, is the failure worth guarding.
 */
describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hitesh Solanki")).toBe("hitesh-solanki");
  });

  it("keeps accented letters as letters rather than dropping them", () => {
    // NFKD + mark-stripping: "é" must become "e", not vanish into a dash.
    expect(slugify("Zoë Müller")).toBe("zoe-muller");
  });

  it("never returns an empty string", () => {
    // A name with nothing ASCII in it would otherwise produce ".png".
    expect(slugify("")).toBe("builder");
    expect(slugify("   ")).toBe("builder");
    expect(slugify("日本語")).toBe("builder");
    expect(slugify("!!!")).toBe("builder");
  });

  it("cannot produce a path or a hidden file", () => {
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(slugify(".bashrc")).toBe("bashrc");
    expect(slugify("a/b\\c")).toBe("a-b-c");
  });

  it("collapses runs and trims edge separators", () => {
    expect(slugify("  a   b  ")).toBe("a-b");
    expect(slugify("--a--")).toBe("a");
  });

  it("stays short enough for every filesystem", () => {
    expect(slugify("x".repeat(200))).toHaveLength(40);
  });
});
