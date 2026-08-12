/**
 * The session cookie: a random id, minted once in `proxy.ts`, carried by the
 * browser from then on.
 *
 * It is not authentication and deliberately identifies nothing about a person —
 * there is no login here. It exists so a row in `passes` can answer "which
 * browser made this", which is what lets someone come back and find the pass
 * they generated without an account (FR: no signup).
 *
 * Constants only. `proxy.ts` runs on every request and may be deployed away
 * from the app, so it must not import anything that touches the database, and
 * the docs are explicit that proxy cannot share *state* with the app — headers,
 * cookies and the URL are the only channel. This module is the shared
 * vocabulary for that channel, not shared state.
 */

export const SESSION_COOKIE = "hhg_sid";

/**
 * Proxy sets the cookie on the *response*, which the browser only sends back on
 * the next request. A first-time visitor who submits the form on their very
 * first page view would otherwise have no session at all, so proxy also writes
 * the id onto the forwarded *request* under this header and server code reads
 * the header first.
 */
export const SESSION_HEADER = "x-hhg-session";

/** A year. The cookie's only job is to outlive the tab someone made a pass in. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/** Same shape as `crypto.randomUUID()`, which is what proxy mints. */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cookies are client-controlled, so an id coming back in from a request is
 * input, not a fact. Anything that is not a UUID we minted is discarded and
 * replaced — it would otherwise flow straight into a `varchar(64)` column and
 * into `WHERE session_id = ...`.
 */
export function isSessionId(value: string | undefined | null): value is string {
  return typeof value === "string" && SESSION_ID.test(value);
}
