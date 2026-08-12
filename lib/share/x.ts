import { EVENT, SHARE_HASHTAG } from "@/lib/site";

/**
 * The X post.
 *
 * X's web intent cannot carry an image — there is no public API for attaching
 * one to a composed post, and nothing a browser can do gets around that. What
 * it *does* do is unfurl a link, so the picture in the post is the `og:image`
 * of the URL we hand it. That is why `/share/[id]` exists and why the card is
 * uploaded before this URL is built: the image is the link's preview, not an
 * attachment.
 *
 * The composer opens pre-filled and the user still has to press Post. That is
 * the correct shape for this — nothing is published without them.
 */

/** The current intent endpoint. `/intent/tweet` still 302s here. */
const INTENT = "https://x.com/intent/post";

/** Without the leading `@` — the intent's `via` parameter adds it. */
const VIA = EVENT.x.replace(/^.*\/@?/, "");

export type XPostInput = {
  /** The absolute `/share/[id]` URL. X unfurls this into the card image. */
  shareUrl: string;
  name: string;
  title: string;
};

/**
 * The caption, kept short on purpose. X counts a URL as 23 characters no
 * matter its length, and the hashtags are appended by the intent rather than
 * typed into the text, so this leaves plenty of room for someone to edit it
 * before posting — which most people do.
 */
export function buildXCaption({ name, title }: Pick<XPostInput, "name" | "title">): string {
  const who = name.trim();
  const klass = title.trim().toUpperCase();

  return [
    who ? `${who} is going to ${EVENT.name} 2026.` : `I'm going to ${EVENT.name} 2026.`,
    klass ? `Builder class: ${klass}.` : "",
    `${EVENT.dates} · ${EVENT.location}`,
    "",
    "Make your own pass →",
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Which of the two URLs actually goes in the post.
 *
 * The share page, almost always — and that is not a preference. X composes the
 * preview by fetching the linked page and reading `og:image` off it. A link
 * straight to the PNG carries no meta tags for it to read, so the post arrives
 * as a bare URL with no picture at all, which is the one outcome a share
 * feature cannot have.
 *
 * The exception is a deployment whose own origin is not publicly reachable —
 * a dev machine. There the share page 404s for everyone but its author, so the
 * choice is between a dead link and a live image with no preview card, and the
 * live image wins. `fellBack` is surfaced so the UI can say why.
 */
export function resolvePostUrl(
  shareUrl: string,
  imageUrl: string,
  siteIsPublic: boolean,
): { url: string; fellBack: boolean } {
  if (siteIsPublic) return { url: shareUrl, fellBack: false };
  return { url: imageUrl || shareUrl, fellBack: Boolean(imageUrl) };
}

export function buildXIntentUrl({ shareUrl, name, title }: XPostInput): string {
  const params = new URLSearchParams({
    text: buildXCaption({ name, title }),
    url: shareUrl,
    // Comma-separated and un-prefixed; the intent adds the `#`. Passing them
    // here rather than inside `text` keeps them out of the way of an edit.
    hashtags: [SHARE_HASHTAG, "HackerHouseGoa"].join(","),
    via: VIA,
  });

  return `${INTENT}?${params.toString()}`;
}
