import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { type NewPass, type Pass, passes } from "./schema";

/**
 * Every read and write of the `passes` table, in one place.
 *
 * Reads and writes have deliberately different failure postures.
 *
 * **Reads never throw.** `/share/[id]` is a URL somebody has already posted to
 * X — by the time it is loaded, the link is out of our hands. If the database
 * is unreachable, or `DATABASE_URL` is unset, or the migration has not been
 * run, the honest answer to "show me this pass" is "not found", not a 500 error
 * page under our branding on a link a person put their name on.
 *
 * **Writes do throw**, so `POST /api/pass` can tell the user their pass was not
 * saved instead of handing back a share URL that resolves to nothing.
 */

/**
 * Write a pass at an id the browser chose (see [[lib/share/pass-id]] for why it
 * is minted there), replacing the row if that id already exists.
 *
 * Re-posting is a real flow: someone shares, spots a typo, fixes it and posts
 * again — and their card carries a QR pointing at `/share/<id>`, so the second
 * post has to land on the *same* row or the code on the image they already
 * downloaded starts lying. Hence upsert rather than insert.
 *
 * The `where` is the whole security story of a client-supplied id: ids are
 * public (they are in every posted link), so without it anyone could POST
 * someone else's id and overwrite their pass. Scoped to the session that owns
 * the row, a mismatched id updates nothing and returns `null`, which the route
 * turns into a 409.
 */
export async function upsertPass(row: NewPass): Promise<Pass | null> {
  const db = getDb();
  if (!db) return null;

  const { id: _id, sessionId, createdAt: _createdAt, ...fields } = row;
  const [saved] = await db
    .insert(passes)
    .values(row)
    .onConflictDoUpdate({
      target: passes.id,
      set: fields,
      where: eq(passes.sessionId, sessionId),
    })
    .returning();

  // Postgres returns nothing at all when the conflict target matches but the
  // `where` does not: a row exists at this id and it is not this session's.
  return saved ?? null;
}

export async function getPass(id: string): Promise<Pass | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [row] = await db.select().from(passes).where(eq(passes.id, id)).limit(1);
    return row ?? null;
  } catch (cause) {
    // Logged, not swallowed silently — "every share link is 404ing" and "one id
    // does not exist" look identical from the outside, and the log is the only
    // thing that tells them apart.
    console.error("[db] getPass failed", cause);
    return null;
  }
}

/** Every pass one browser has made — the session cookie is the only key. */
export async function getPassesBySession(sessionId: string, limit = 20): Promise<Pass[]> {
  const db = getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(passes)
      .where(eq(passes.sessionId, sessionId))
      .orderBy(desc(passes.createdAt))
      .limit(limit);
  } catch (cause) {
    console.error("[db] getPassesBySession failed", cause);
    return [];
  }
}
