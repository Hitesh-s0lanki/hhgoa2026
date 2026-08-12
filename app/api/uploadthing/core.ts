import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { sessionFromRequest } from "@/lib/session-server";

/**
 * Two endpoints, because the two kinds of image have nothing in common.
 *
 * `passPhoto` takes the source photo a person picked — a 12 MP HEIC off a
 * phone, arbitrary dimensions. `passCard` takes what the app produced: PNGs the
 * renderer made, at sizes we control. Separate routes mean the size and count
 * limits can be honest about each, and a bug in the render path can never
 * present itself as a photo upload.
 *
 * The browser uploads straight to UploadThing's storage with a presigned URL —
 * bytes never stream through this app (ADR-006). What runs here is only the
 * authorisation step in front of the presign.
 */

const f = createUploadthing();

/**
 * `awaitServerData: false` — two reasons, both load-bearing.
 *
 * Speed: with the default, `uploadFiles()` does not resolve until UploadThing
 * has called *back* into this app and that handler has returned. That is a
 * whole extra internet round trip inserted between "the bytes landed" and "the
 * user sees their card", for data the client already has in the upload response.
 *
 * Local development: that callback is an inbound request to a public URL.
 * `localhost` has none, so with the default every upload in dev waits for a
 * callback that can never arrive.
 */
const routeOptions = { awaitServerData: false } as const;

/**
 * The session cookie proxy minted. It is not authentication — there are no
 * accounts here — but it does mean an upload is attributable to a browser that
 * has actually loaded the page, which is the cheapest possible bar in front of
 * an endpoint that hands out presigned URLs.
 */
function requireSession(req: Request) {
  const sessionId = sessionFromRequest(req);
  if (!sessionId) {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "No session. Reload the page and try again.",
    });
  }
  return { sessionId };
}

export const passFileRouter = {
  /**
   * The photo the builder picked. 16 MB rather than the uploader's own 25 MB
   * ceiling: what reaches here has already been through validation, and the
   * card only ever draws a ~900 px arch, so anything larger is paying for
   * pixels nobody sees.
   */
  passPhoto: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } }, routeOptions)
    .middleware(({ req }) => requireSession(req))
    .onUploadComplete(({ metadata, file }) => {
      // Nothing to persist here. The row is written by POST /api/pass once the
      // card exists, and a photo with no pass attached is not a record of
      // anything. Logged only so an orphan is traceable.
      console.info("[uploadthing] photo", metadata.sessionId, file.key);
    }),

  /**
   * The generated card: the both-faces sheet, plus the 1200×630 OG crop. Two
   * files, one call, so they upload concurrently on the share path.
   *
   * Both types are listed because the renderer asks for WebP and takes PNG
   * where the browser cannot encode it (WebKit). Pinning this to `image/png`
   * alone would reject every upload from Chrome.
   */
  passCard: f(
    {
      "image/png": { maxFileSize: "8MB", maxFileCount: 2 },
      "image/webp": { maxFileSize: "8MB", maxFileCount: 2 },
    },
    routeOptions,
  )
    .middleware(({ req }) => requireSession(req))
    .onUploadComplete(({ metadata, file }) => {
      console.info("[uploadthing] card", metadata.sessionId, file.key);
    }),
} satisfies FileRouter;

export type PassFileRouter = typeof passFileRouter;
