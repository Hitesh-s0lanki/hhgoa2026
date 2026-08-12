import { NextResponse } from "next/server";
import { upsertPass } from "@/lib/db/passes";
import { isDbConfigured } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session-server";
import { createPassSchema, type CreatePassResponse } from "@/lib/share/schema";
import { SITE_URL, absoluteUrl, isPublicSiteUrl } from "@/lib/site";

/**
 * `POST /api/pass` — the one write in the app.
 *
 * Called after the card has already been rendered and uploaded, so its entire
 * job is: validate, write the row, hand back the share URL. No image bytes pass
 * through here (ADR-006), which is what keeps it to a single Neon round trip
 * and inside the share tap's latency budget.
 *
 * The id arrives *in the request* rather than being minted here, because the
 * card that was just uploaded has a QR code on it encoding `/share/<id>` — the
 * browser had to know the id before it drew the thing it is now saving. See
 * [[lib/share/pass-id]] and `upsertPass` for what that costs in validation.
 *
 * It is only reached when someone chooses to share. Downloading touches no
 * server at all and writes nothing.
 */

/**
 * A per-session ceiling, in process memory.
 *
 * Being honest about what this is: on a serverless platform each instance keeps
 * its own map, so a determined script spread across cold starts gets through.
 * It is not the anti-abuse story — it is a cheap stop on the accidental case (a
 * retry loop, a stuck button) that costs no dependency and no network hop. The
 * real limiter is T-031's, and it belongs in front of this, not inside it.
 */
const RATE_LIMIT = { max: 12, windowMs: 60 * 60 * 1000 };
const recent = new Map<string, number[]>();

function overLimit(sessionId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(sessionId) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);
  hits.push(now);
  recent.set(sessionId, hits);

  // Bounded cleanup: without it the map grows one entry per session forever.
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((at) => now - at >= RATE_LIMIT.windowMs)) recent.delete(key);
    }
  }

  return hits.length > RATE_LIMIT.max;
}

export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) {
    return NextResponse.json({ error: "No session. Reload the page." }, { status: 401 });
  }

  if (!isDbConfigured()) {
    // 503, not 500: nothing is broken, the deployment simply has no database.
    // The client turns this into "download still works", not an error toast.
    return NextResponse.json({ error: "Link sharing is not configured." }, { status: 503 });
  }

  if (overLimit(sessionId)) {
    return NextResponse.json({ error: "Too many passes. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = createPassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pass.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // The write is the one call here that can fail on someone else's
  // infrastructure. Caught so the client gets a sentence it can show next to
  // the button, rather than an unhandled throw and a generic error page —
  // the user still has a rendered card and Download still works.
  let row;
  let failed = false;
  try {
    row = await upsertPass({ sessionId, ...parsed.data });
  } catch (cause) {
    console.error("[api/pass] write failed", cause);
    failed = true;
  }

  if (failed) {
    return NextResponse.json({ error: "The pass could not be saved." }, { status: 500 });
  }

  /*
   * No row back from a write that did not throw means exactly one thing: the id
   * is already taken by a different session (see `upsertPass`). The id came
   * from this client, so this is either a ~62-bit collision or someone POSTing
   * an id they read off a share link — and in neither case may we overwrite
   * the pass that is there.
   */
  if (!row) {
    console.warn("[api/pass] id belongs to another session", parsed.data.id);
    return NextResponse.json(
      { error: "That pass id is already taken. Reload the page and post again." },
      { status: 409 },
    );
  }

  if (!isPublicSiteUrl()) {
    // Loud, because the symptom is silent: everything succeeds and the posted
    // link is dead for everyone but this machine.
    console.warn(
      `[api/pass] NEXT_PUBLIC_SITE_URL is not a public origin (${SITE_URL}). ` +
        "Share links will point at the card image instead of /share/[id], " +
        "which means posts unfurl without a preview card. Set it to the deployed origin.",
    );
  }

  const response: CreatePassResponse = {
    id: row.id,
    shareUrl: absoluteUrl(`/share/${row.id}`),
    // The OG crop by preference: it is the 1200×630 PNG built for exactly this,
    // and PNG is the format every crawler and phone gallery handles.
    imageUrl: row.ogUrl ?? row.cardUrl,
  };
  return NextResponse.json(response, { status: 201 });
}
