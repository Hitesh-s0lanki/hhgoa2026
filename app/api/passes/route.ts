import { NextResponse } from "next/server";
import { getPassesBySession } from "@/lib/db/passes";
import { sessionFromRequest } from "@/lib/session-server";
import type { PassListResponse, PassSummary } from "@/lib/share/schema";
import { absoluteUrl } from "@/lib/site";

/**
 * `GET /api/passes` — every pass this browser has published.
 *
 * The reader `getPassesBySession` was written for and never had, which is the
 * thing ADR-004 warned about from the other direction: a session id stored on
 * every row is only worth storing if something asks the question. This is the
 * question.
 *
 * **The session is taken from the cookie and nowhere else.** There is
 * deliberately no `?session=` parameter: ids are opaque, but they are also the
 * only thing standing between one person's passes and everyone's, and an
 * endpoint that accepts one as input is an endpoint that enumerates strangers'
 * photos. `httpOnly` on the cookie means script on the page cannot read it
 * either, so there is no way to ask this question about a browser that is not
 * the one asking.
 */

/** Nothing here is guessable, so it does not need auth — it needs to not be cached. */
const PRIVATE = {
  // `private` keeps it out of any shared cache between here and the browser;
  // `no-store` keeps it out of the browser's own, so a second person on a
  // shared laptop does not get served the first one's list from disk.
  "cache-control": "private, no-store",
} as const;

export async function GET(request: Request): Promise<NextResponse<PassListResponse>> {
  const sessionId = sessionFromRequest(request);

  // No session yet (a first request, or a cookie that failed validation) is an
  // empty list, not an error: "you have not made any passes" is the truthful
  // answer and the UI renders nothing for it either way.
  if (!sessionId) return NextResponse.json({ passes: [] }, { headers: PRIVATE });

  // Reads never throw — a missing or unreachable database degrades to "no
  // passes yet" rather than putting an error panel on the landing page.
  const rows = await getPassesBySession(sessionId);

  const passes: PassSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    role: row.role,
    stack: row.stack,
    thumbnailUrl: row.ogUrl ?? row.cardUrl,
    cardUrl: row.cardUrl,
    shareUrl: absoluteUrl(`/share/${row.id}`),
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({ passes }, { headers: PRIVATE });
}
