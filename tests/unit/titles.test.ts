import { describe, expect, it } from "vitest";
import { deriveTitle } from "@/lib/brand/titles";

/** One role per rule in the table, plus the messy strings real people type. */
const ROLES = [
  "ML Engineer",
  "Founder",
  "Product Designer",
  "DevOps",
  "Data Scientist",
  "Security Researcher",
  "iOS Developer",
  "Frontend Engineer",
  "Backend Engineer",
  "Software Engineer",
  "SWE",
  "full stack dev",
  "Product Manager",
  "Student",
  "Professional Yak Shaver",
  "",
];

describe("deriveTitle", () => {
  it("is deterministic — the same role never flickers between renders", () => {
    for (const role of ROLES) {
      expect(deriveTitle(role)).toBe(deriveTitle(role));
    }
  });

  it("ignores case and surrounding whitespace", () => {
    expect(deriveTitle("  Software Engineer  ")).toBe(deriveTitle("software engineer"));
  });

  it("matches the most specific rule first", () => {
    // "ML Engineer" hits both the AI rule and the engineer rule; AI wins.
    expect(deriveTitle("ML Engineer")).toMatch(/AI|MODEL|NEURAL/);
    expect(deriveTitle("Software Engineer")).toMatch(/FULL-STACK|CODE|PRODUCT HACKER/);
  });

  it("falls back rather than returning nothing for an unknown role", () => {
    expect(deriveTitle("Professional Yak Shaver")).not.toBe("");
    expect(deriveTitle("")).not.toBe("");
  });

  it("cycles on reroll and returns to where it started", () => {
    const start = deriveTitle("Software Engineer");
    expect(deriveTitle("Software Engineer", 1)).not.toBe(start);
    // The full-stack pool holds three titles.
    expect(deriveTitle("Software Engineer", 3)).toBe(start);
  });

  it("never exceeds the 24 characters the card lays out on one line", () => {
    for (const role of ROLES) {
      for (let reroll = 0; reroll < 5; reroll++) {
        expect(deriveTitle(role, reroll).length).toBeLessThanOrEqual(24);
      }
    }
  });

  it("always returns uppercase, matching the card's type treatment", () => {
    for (const role of ROLES) {
      const title = deriveTitle(role);
      expect(title).toBe(title.toUpperCase());
    }
  });
});
