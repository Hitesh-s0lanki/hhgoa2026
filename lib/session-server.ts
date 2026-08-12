import "server-only";

import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_HEADER, isSessionId } from "./session";

/**
 * Reading back what `proxy.ts` wrote.
 *
 * Header first, cookie second, in both variants: proxy forwards the id on the
 * request header, and on a visitor's very first request that header is the only
 * copy that exists — the cookie is still travelling back on the response.
 *
 * Neither function mints an id. Proxy is the single place a session is created;
 * a second minting site would hand out ids that never reach the browser.
 */

/** For Route Handlers, which already hold the request — no dynamic API needed. */
export function sessionFromRequest(request: Request): string | null {
  const fromHeader = request.headers.get(SESSION_HEADER);
  if (isSessionId(fromHeader)) return fromHeader;

  const fromCookie = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return isSessionId(fromCookie) ? fromCookie : null;
}

/** For Server Components and Server Functions, which do not. */
export async function getSessionId(): Promise<string | null> {
  const fromHeader = (await headers()).get(SESSION_HEADER);
  if (isSessionId(fromHeader)) return fromHeader;

  const fromCookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return isSessionId(fromCookie) ? fromCookie : null;
}

/**
 * A `Cookie` header is `a=1; b=2`. Values are only ever compared against
 * `isSessionId`, so no percent-decoding is needed — a UUID survives encoding
 * unchanged, and anything that does not is rejected either way.
 */
function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
