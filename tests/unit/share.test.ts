import { describe, expect, it } from "vitest";
import { createPassSchema, uploadedUrl } from "@/lib/share/schema";
import { buildXCaption, buildXIntentUrl, resolvePostUrl } from "@/lib/share/x";

const VALID = {
  id: "k3f9x2m7qp1a",
  name: "Hitesh Solanki",
  role: "ML Engineer",
  stack: "Next.js · TS · AWS",
  title: "MODEL WRANGLER",
  passNumber: "HHG-2026-7922",
  cardUrl: "https://appid.ufs.sh/f/abc123",
};

describe("uploadedUrl", () => {
  /*
   * This is the security control on the endpoint, not a formatting nicety. A
   * stored URL becomes this domain's `og:image`, so anything that gets past it
   * is an image of the attacker's choosing unfurling under our name whenever
   * the share link is posted.
   */
  it("accepts UploadThing's own hosts", () => {
    expect(uploadedUrl.safeParse("https://appid.ufs.sh/f/abc123").success).toBe(true);
    expect(uploadedUrl.safeParse("https://utfs.io/f/abc123").success).toBe(true);
  });

  it("rejects any other host", () => {
    for (const url of [
      "https://evil.example.com/x.png",
      // The classic near-miss: our host as a *prefix* of theirs.
      "https://ufs.sh.evil.com/x.png",
      // And as a substring that is not a domain boundary.
      "https://notufs.sh/x.png",
      "https://evil.com/?u=https://appid.ufs.sh/f/a",
    ]) {
      expect(uploadedUrl.safeParse(url).success, url).toBe(false);
    }
  });

  it("rejects non-https schemes on an allowed host", () => {
    expect(uploadedUrl.safeParse("http://appid.ufs.sh/f/abc").success).toBe(false);
    expect(uploadedUrl.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("createPassSchema", () => {
  it("accepts a complete pass", () => {
    expect(createPassSchema.safeParse(VALID).success).toBe(true);
  });

  it("requires only a name, a title, a pass number and the card", () => {
    const minimal = { ...VALID, role: undefined, stack: undefined };
    expect(createPassSchema.safeParse(minimal).success).toBe(true);
  });

  it("treats an emptied optional field as absent rather than as an empty string", () => {
    const parsed = createPassSchema.parse({ ...VALID, role: "   " });
    expect(parsed.role).toBeUndefined();
  });

  it("rejects a name longer than the card can draw", () => {
    // 28 is FIELD_LIMITS.name and the column width. The three must agree.
    expect(createPassSchema.safeParse({ ...VALID, name: "x".repeat(29) }).success).toBe(false);
    expect(createPassSchema.safeParse({ ...VALID, name: "x".repeat(28) }).success).toBe(true);
  });

  /*
   * The id is minted in the browser so the card's QR code can encode
   * `/share/<id>` before the card is rasterised — which makes it client input
   * that becomes a URL on this domain. Anchored to the generator's exact
   * alphabet and length, because "looks like an id" is not a check.
   */
  it("rejects an id that is not one this app mints", () => {
    for (const id of [
      "K3F9X2M7QP1A", // uppercase is not in the alphabet
      "k3f9x2m7qp1", // eleven
      "k3f9x2m7qp1ab", // thirteen
      "k3f9-2m7qp1a", // the separators the alphabet deliberately excludes
      "k3f9x2m7qp1a/../admin",
      "k3f9x2m7qp1a\nx",
      "",
    ]) {
      expect(createPassSchema.safeParse({ ...VALID, id }).success, id).toBe(false);
    }
  });

  it("rejects a pass with no id at all", () => {
    const withoutId: Record<string, unknown> = { ...VALID };
    delete withoutId.id;
    expect(createPassSchema.safeParse(withoutId).success).toBe(false);
  });

  it("rejects a pass with no card image", () => {
    const withoutCard: Record<string, unknown> = { ...VALID };
    delete withoutCard.cardUrl;
    expect(createPassSchema.safeParse(withoutCard).success).toBe(false);
  });
});

describe("buildXIntentUrl", () => {
  const input = {
    shareUrl: "https://hhgoa.app/share/abc123def456",
    name: "Hitesh Solanki",
    title: "MODEL WRANGLER",
  };

  it("points at the current intent endpoint", () => {
    const url = new URL(buildXIntentUrl(input));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
  });

  it("carries the share URL separately from the text", () => {
    const url = new URL(buildXIntentUrl(input));
    // X unfurls the `url` parameter into the card image. Folded into `text` it
    // is just characters, and the post arrives without a preview.
    expect(url.searchParams.get("url")).toBe(input.shareUrl);
    expect(url.searchParams.get("text")).not.toContain(input.shareUrl);
  });

  it("passes hashtags un-prefixed, as the intent expects", () => {
    const tags = new URL(buildXIntentUrl(input)).searchParams.get("hashtags");
    expect(tags).toBe("FrameInGoa,HackerHouseGoa");
    expect(tags).not.toContain("#");
  });

  it("leaves room to edit — the caption stays well inside X's limit", () => {
    const text = new URL(buildXIntentUrl(input)).searchParams.get("text") ?? "";
    // A URL always costs 23 characters on X regardless of its length.
    expect(text.length + 23).toBeLessThan(200);
  });

  it("names the builder, and falls back to first person without one", () => {
    expect(buildXCaption({ name: "Hitesh Solanki", title: "X" })).toContain("Hitesh Solanki is");
    expect(buildXCaption({ name: "  ", title: "X" })).toContain("I'm going");
  });
});

describe("resolvePostUrl", () => {
  const SHARE = "https://hhgoa.app/share/abc123def456";
  const IMAGE = "https://appid.ufs.sh/f/og-key";

  it("posts the share page when the site has a public origin", () => {
    // X reads og:image off this page to build the preview card. A link to the
    // PNG itself has no meta tags, so it would post with no picture at all.
    expect(resolvePostUrl(SHARE, IMAGE, true)).toEqual({ url: SHARE, fellBack: false });
  });

  it("posts the image instead when the origin is not publicly reachable", () => {
    // A dev machine: the share page 404s for everyone else, so the choice is a
    // dead link versus a live image without a preview. The image wins.
    expect(resolvePostUrl(SHARE, IMAGE, false)).toEqual({ url: IMAGE, fellBack: true });
  });

  it("never posts nothing — an absent image falls back to the page", () => {
    expect(resolvePostUrl(SHARE, "", false)).toEqual({ url: SHARE, fellBack: false });
  });
});
