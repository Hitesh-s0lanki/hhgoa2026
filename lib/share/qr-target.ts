import { EVENT, absoluteUrl, isPublicSiteUrl } from "@/lib/site";

/**
 * What the QR code on the pass actually points at.
 *
 * The card is printed matter: once it is a PNG in someone's camera roll the
 * code cannot be corrected, so the one thing this must never produce is a URL
 * that resolves to nothing. Two cases make that hard, and both are handled
 * here rather than at the call site.
 *
 * **No pass id yet.** `/share/[id]` only exists once a pass has been posted —
 * downloading writes no row (ADR-006) — so a card that has only been
 * downloaded has no page of its own. Its code points at the generator instead:
 * still the truthful answer to "where did this come from", and the scan ends
 * somewhere real.
 *
 * **No public origin.** With `NEXT_PUBLIC_SITE_URL` unset the site is
 * `localhost:3002`, which is a dead scan on the only device anyone would scan
 * with — a phone. The event's own site is the honest fallback there; see
 * `isPublicSiteUrl` for the same reasoning applied to posted links.
 */
export function passQrTarget(passId?: string | null): string {
  if (!isPublicSiteUrl()) return EVENT.site;
  return passId ? absoluteUrl(`/share/${passId}`) : absoluteUrl("/");
}
