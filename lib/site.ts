/**
 * Site-level constants. The only place env vars are read on the client side —
 * everything else takes these as arguments.
 */

export const SITE_NAME = "HH Goa 2026";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

export const SHARE_HASHTAG = process.env.NEXT_PUBLIC_SHARE_HASHTAG ?? "FrameInGoa";

/**
 * Hostnames that only resolve on the machine serving the page.
 *
 * A hostname with no dot in it (`myhost`, `staging`) is in the same category:
 * it is a LAN name, and nobody outside that network can open it.
 */
const PRIVATE_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|.*\.local|[^.]+)$/i;

/**
 * Whether `SITE_URL` is an origin a stranger can actually open.
 *
 * This exists because of a specific, silent failure: with `NEXT_PUBLIC_SITE_URL`
 * unset, `absoluteUrl` cheerfully produces `http://localhost:3002/share/abc`
 * and the app hands that to X as the thing to post. It looks like it worked —
 * a post is composed, a link is in it — and the link is dead for every single
 * person who sees it, including the person who posted it once they are on
 * their phone.
 *
 * So the share path asks this first and, when the answer is no, posts the
 * public image URL instead of a link only the author's laptop can resolve.
 */
export function isPublicSiteUrl(url: string = SITE_URL): boolean {
  try {
    return !PRIVATE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** The event itself. Verified against hhgoa.com — see docs/13-brand-identity.md. */
export const EVENT = {
  name: "Hacker House Goa",
  dates: "28–31 Oct 2026",
  location: "Goa, India",
  tagline: "Less noise. More signal.",
  subline: "4 days. One rhythm. Everything intentional.",
  site: "https://hhgoa.com",
  apply: "https://hacker-house-goa-2026.devfolio.co/",
  x: "https://x.com/247pmstudio",
  telegram: "https://t.me/twofourtysevenpm",
  organizer: "2:47 pm Studio",
} as const;

/**
 * Who made this. Rendered in the footer and on /about, so it is one constant
 * rather than a URL copy-pasted into three components.
 */
export const BUILDER = {
  name: "Hitesh Solanki",
  github: "https://github.com/Hitesh-s0lanki",
  linkedin: "https://www.linkedin.com/in/hitesh-solanki",
} as const;

/**
 * This is an entry for the event's shortlisting task, not something the
 * organizers published. The footer says so plainly — the app carries the
 * event's marks, and a reader should never have to guess who is behind it.
 */
export const AFFILIATION =
  "An independent entry for the HH Goa 2026 shortlisting task. Not affiliated with the organizers.";

/**
 * Absolute URL for a site-relative path. OG tags are ignored by crawlers when
 * the URL is relative, so share metadata must go through this.
 */
export function absoluteUrl(path: string): string {
  const origin = SITE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}
