"use client";

import type { PassFileRouter } from "@/app/api/uploadthing/core";

/**
 * The browser's side of the upload: a presign request to `/api/uploadthing`,
 * then a direct PUT to storage. The file never passes through this app's
 * server, which is what keeps a 6 MB photo off a serverless function's body
 * limit and out of its billed duration (ADR-006).
 *
 * `uploadthing/client` is loaded through a dynamic `import()` and never at
 * module scope. It carries `effect` and `@effect/platform` with it — far past
 * the 50 KB rule in docs/05-tech-stack.md — and nothing on the landing page
 * needs it until someone picks a photo. Statically imported it lands in the
 * page's entry chunk and is parsed during hydration by every visitor,
 * including the ones who only came to read.
 *
 * The type import above is erased at compile time, so the router (and the
 * server-only module it lives in) costs the client nothing.
 */

/** Resolved once; every later upload reuses the same loaded module. */
let uploaderPromise: ReturnType<typeof makeUploader> | null = null;

async function makeUploader() {
  const { genUploader } = await import("uploadthing/client");
  // Typed against the router, so endpoint names and their limits are checked at
  // compile time rather than discovered in a 400.
  return genUploader<PassFileRouter>();
}

function uploader() {
  uploaderPromise ??= makeUploader();
  return uploaderPromise;
}

/**
 * Start fetching the chunk before it is needed. Called when the user first
 * shows intent, so the network cost overlaps with them typing rather than
 * landing in front of the first upload.
 */
export function warmUploader(): void {
  void uploader().catch(() => {});
}

/** What the rest of the app needs from an upload: where it landed. */
export type Uploaded = { url: string; key: string };

/**
 * `ufsUrl` is the current field; `url` is the deprecated one kept for
 * compatibility. Reading both means this keeps working across the v7 line
 * without pinning a patch version.
 */
function toUploaded(
  file: { key: string | null; url: string; ufsUrl?: string } | undefined,
): Uploaded {
  // An empty response is not a shape the SDK documents, but it types as
  // possible and would otherwise reach the API as `url: undefined` and come
  // back a 400 with nothing to explain it.
  if (!file) throw new Error("The upload returned no file.");
  return { url: file.ufsUrl ?? file.url, key: file.key ?? "" };
}

/** The source photo. Fired in the background at pick time, never awaited by the UI. */
export async function uploadPhoto(file: File, signal?: AbortSignal): Promise<Uploaded> {
  const { uploadFiles } = await uploader();
  const [uploaded] = await uploadFiles("passPhoto", { files: [file], signal });
  return toUploaded(uploaded);
}

/**
 * The rendered card and its OG crop, in one call so the two PUTs overlap
 * instead of queueing — this pair is on the critical path of the share tap.
 */
export async function uploadCard(
  sheet: File,
  og: File,
  signal?: AbortSignal,
): Promise<{ sheet: Uploaded; og: Uploaded }> {
  const { uploadFiles } = await uploader();
  const uploaded = await uploadFiles("passCard", { files: [sheet, og], signal });

  // UploadThing resolves in the order given, but the pair is asymmetric and a
  // silent swap would put a 1200×630 crop behind the download button, so it is
  // matched by name rather than by index.
  const bySheet = uploaded.find((file) => file.name === sheet.name) ?? uploaded[0];
  const byOg = uploaded.find((file) => file.name === og.name) ?? uploaded[1];

  return { sheet: toUploaded(bySheet), og: toUploaded(byOg) };
}
