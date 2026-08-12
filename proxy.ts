import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_HEADER, SESSION_MAX_AGE, isSessionId } from "@/lib/session";

/**
 * Proxy — Next 16's renamed Middleware (`docs/01-app/01-getting-started/16-proxy.md`).
 *
 * It does exactly one thing: make sure every request arrives carrying a session
 * id. If the cookie is present and well-formed it is passed through untouched;
 * otherwise a new one is minted, forwarded to the app on a request header, and
 * set on the response so the browser has it from the next request on.
 *
 * Why the header as well as the cookie: `Set-Cookie` only takes effect on the
 * *following* request. Someone who lands and immediately generates a pass would
 * otherwise submit with no session, and their first pass — the one they
 * actually care about — would be the one that could not be grouped with the
 * rest. Writing the id onto the forwarded request closes that gap.
 *
 * No database call happens here. Proxy runs on *every* request, and the docs
 * are explicit that it is not the place for data fetching; a write per request
 * would put a Neon round trip in front of every static asset. The row is
 * written once, when the form is submitted.
 */
/**
 * `Secure` is decided by the protocol the *browser* used, not by `NODE_ENV`.
 *
 * Keyed off the environment instead, a production build served over plain HTTP
 * — which is exactly what `npm run build && npm start` and the Playwright CI
 * run are — marks the cookie `Secure` and Safari drops it silently. Chrome
 * hides the bug by exempting `localhost`; WebKit does not, so the session
 * simply never exists there.
 *
 * `x-forwarded-proto` comes first because behind a load balancer or a CDN the
 * TLS terminates upstream and `nextUrl` sees plain HTTP for a request the user
 * made over HTTPS. Vercel, Fly and nginx all set it.
 */
function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  // A chain of proxies appends, so the client's own protocol is the first hop.
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return request.nextUrl.protocol === "https:";
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = isSessionId(existing) ? existing : crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set(SESSION_HEADER, sessionId);

  const response = NextResponse.next({ request: { headers } });

  // Rewritten on every request, not just when minted, so the expiry rolls
  // forward for someone who keeps coming back rather than lapsing a year after
  // their first visit.
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}

export const config = {
  /*
   * Without a matcher this runs on `_next/static`, `_next/image` and every file
   * in `public/` — hundreds of pointless invocations per page load, each one
   * re-issuing a Set-Cookie on an asset response.
   *
   * `api/uploadthing` is excluded too: it is called by UploadThing's own
   * client and callback, neither of which needs a session, and it is on the
   * critical path for the upload.
   */
  matcher: [
    "/((?!api/uploadthing|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico|woff2?)$).*)",
  ],
};
