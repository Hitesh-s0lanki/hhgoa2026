import { describe, expect, it } from "vitest";
import { absoluteUrl, isPublicSiteUrl, SITE_URL } from "@/lib/site";

describe("absoluteUrl", () => {
  it("returns an absolute origin for a rooted path", () => {
    expect(absoluteUrl("/share/abc")).toBe(`${SITE_URL}/share/abc`);
  });

  it("normalises a path without a leading slash", () => {
    expect(absoluteUrl("share/abc")).toBe(`${SITE_URL}/share/abc`);
  });

  it("never emits a double slash after the origin", () => {
    expect(absoluteUrl("/")).not.toMatch(/[^:]\/\//);
  });
});

describe("isPublicSiteUrl", () => {
  /*
   * The guard in front of a silent failure: with NEXT_PUBLIC_SITE_URL unset,
   * the app would compose a real X post containing http://localhost:3002/share/…
   * — dead for everyone who sees it, including the author on their phone.
   */
  it("accepts a real deployed origin", () => {
    for (const url of [
      "https://hhgoa.app",
      "https://hhgoa-git-main.vercel.app",
      "http://staging.example.co.uk:8080",
    ]) {
      expect(isPublicSiteUrl(url), url).toBe(true);
    }
  });

  it("rejects anything only the serving machine can resolve", () => {
    for (const url of [
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "http://0.0.0.0:3002",
      "http://[::1]:3002",
      "http://macbook.local:3002",
      // A LAN hostname: no dot, so nothing outside the network resolves it.
      "http://devbox:3002",
    ]) {
      expect(isPublicSiteUrl(url), url).toBe(false);
    }
  });

  it("rejects a value that is not a URL at all", () => {
    expect(isPublicSiteUrl("")).toBe(false);
    expect(isPublicSiteUrl("hhgoa.app")).toBe(false);
  });
});
