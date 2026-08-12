import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The Neon connection, over HTTP rather than the WebSocket pool.
 *
 * Every query this app makes is a single statement with no transaction around
 * it, and neon-http sends exactly one request per statement — no pool, no
 * handshake, no connection to keep warm across a serverless cold start. That is
 * the difference between an insert that lands in ~100 ms and one that spends
 * half a second opening a socket first, which is the whole budget for the
 * "share" tap (NFR-1).
 *
 * Created lazily so importing this module never throws at build time: the app
 * must boot with `DATABASE_URL` absent, degrade sharing, and keep the download
 * path — which touches no server at all — working (docs/05-tech-stack.md).
 */

let cached: ReturnType<typeof create> | null = null;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return drizzle(neon(url), { schema });
}

/** Whether persistence is configured. Callers branch on this, never on a throw. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** The Drizzle client, or `null` when `DATABASE_URL` is unset. */
export function getDb() {
  cached ??= create();
  return cached;
}

export { schema };
