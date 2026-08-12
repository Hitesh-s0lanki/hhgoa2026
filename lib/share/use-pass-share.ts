"use client";

import { useCallback, useRef, useState } from "react";
import type { PassFields } from "@/components/editor/PassCard";
import { passId } from "@/components/editor/PassCard";
import {
  type CaptureNodes,
  type PassImages,
  downloadFile,
  renderPassImages,
} from "@/lib/render/pass-image";
import type { Uploaded } from "@/lib/upload/client";
import { uploadCard } from "@/lib/upload/client";
import { buildXIntentUrl, resolvePostUrl } from "@/lib/share/x";
import { isPublicSiteUrl } from "@/lib/site";
import type { CreatePassResponse } from "@/lib/share/schema";

/**
 * The two things a finished pass can do, as one small machine.
 *
 * Download and Share look adjacent in the UI but are not the same shape at all:
 * download is pure client work and cannot fail for a reason outside the page,
 * while share is render → upload → insert → hand off to X, any step of which
 * can fail on someone else's infrastructure. Keeping both here means the busy
 * state is shared — you cannot start a share on top of a running download —
 * without either button knowing about the other.
 */

export type ShareStatus = "idle" | "rendering" | "uploading" | "saving" | "done";

/** What the button says while it works. The user should know which step is slow. */
export const STATUS_LABEL: Record<ShareStatus, string> = {
  idle: "",
  rendering: "Drawing your pass…",
  uploading: "Uploading…",
  saving: "Almost there…",
  done: "Done",
};

/**
 * The photo upload runs in the background from the moment a file is picked, so
 * by now it has almost always landed. This is the ceiling on how long a share
 * will wait for it if it has not: past this, the pass is saved without a photo
 * URL rather than making the user watch a spinner for an image that is already
 * baked into the card they are about to post.
 */
const PHOTO_WAIT_MS = 2500;

export type PassShareOptions = {
  fields: PassFields;
  nodes: () => CaptureNodes;
  /** The in-flight (or settled) background upload of the source photo. */
  getPhotoUpload: () => Promise<Uploaded | null> | null;
  /**
   * Everything the card draws, as one value. When it changes the cached render
   * is stale and must be thrown away — otherwise someone edits their name after
   * opening the dialog and posts the previous version.
   */
  signature: string;
  /**
   * Fix the id this pass will be published under, and paint it onto the capture
   * surface *synchronously* — the card's QR code encodes `/share/<id>`, so the
   * id has to be in the DOM before the DOM is photographed.
   *
   * Returns the id. Calling it twice returns the same one; re-posting an edited
   * pass overwrites the existing row rather than orphaning the link that is
   * already printed on someone's downloaded card.
   */
  claimShareId: () => string;
};

export function usePassShare({
  fields,
  nodes,
  getPhotoUpload,
  signature,
  claimShareId,
}: PassShareOptions) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  /** A working-but-misconfigured outcome. Not an error — the share succeeded. */
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef(false);

  const busy = status !== "idle" && status !== "done";

  /**
   * The rendered PNGs, memoised against the signature they were made from.
   *
   * Rasterising is the one expensive step that needs nothing from the network,
   * which makes it the one step that can happen *before* the button is pressed.
   * `prerender()` is called when the dialog opens — the user then spends a few
   * seconds looking at their card, and by the time they press Download or Post
   * the files already exist. It turns the render from a cost into a no-op.
   *
   * A promise is cached rather than the result, so a press that lands while the
   * pre-render is still going joins it instead of starting a second one.
   */
  const cache = useRef<{ key: string; work: Promise<PassImages> } | null>(null);

  /**
   * The claimed pass id, which is part of what the card draws (it is the URL
   * inside the QR code) and therefore part of the cache key — but which is
   * claimed *during* `share()`, after this render. Keeping it beside the cache
   * rather than in the signature is what lets `share()` invalidate the
   * pre-render it is about to outgrow without re-entering React first.
   */
  const claimed = useRef<string | null>(null);

  const images = useCallback((): Promise<PassImages> => {
    const key = `${signature}|${claimed.current ?? ""}`;
    if (cache.current?.key !== key) {
      const work = renderPassImages(nodes(), fields.name);
      cache.current = { key, work };
      // A rejected promise must not be cached — a transient failure would then
      // be permanent for that signature, and retrying could never succeed.
      void work.catch(() => {
        if (cache.current?.work === work) cache.current = null;
      });
    }
    return cache.current.work;
  }, [fields.name, nodes, signature]);

  /** Start the render early and ignore the outcome. Safe to call repeatedly. */
  const prerender = useCallback(() => {
    void images().catch(() => {});
  }, [images]);

  const run = useCallback(async <T>(work: () => Promise<T>): Promise<T | null> => {
    // A double-tap on a phone fires twice before the first render commits, and
    // the second one would start a whole second render + upload + insert.
    if (running.current) return null;
    running.current = true;
    setError(null);
    setNotice(null);

    try {
      return await work();
    } catch (cause) {
      console.error("[pass]", cause);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Something went wrong. Try that again.",
      );
      setStatus("idle");
      return null;
    } finally {
      running.current = false;
    }
  }, []);

  /**
   * Save the card. No network, no session, no row — which is why this is the
   * path that still works when everything else is down.
   */
  const download = useCallback(
    () =>
      run(async () => {
        setStatus("rendering");
        const { download: file } = await images();
        downloadFile(file);
        setStatus("done");
        return file;
      }),
    [images, run],
  );

  const share = useCallback(async () => {
    /*
     * The tab is opened *now*, in the click handler, and pointed somewhere real
     * only once the URL exists. Every browser blocks a `window.open` that
     * happens after an `await` — the gesture is spent by then — so the
     * alternative is a share button that silently does nothing on Safari.
     *
     * Deliberately without the `noopener` feature: passing it makes `open()`
     * return `null` by specification, and the whole point is to keep the
     * handle. The reference is severed below instead, before it navigates.
     */
    const tab = window.open("", "_blank");

    const result = await run(async (): Promise<CreatePassResponse> => {
      setStatus("rendering");

      /*
       * Before the render, not after: this puts the pass's own id on the
       * capture surface, so the QR code in the PNG about to be uploaded points
       * at the page this very request is creating. Claiming it afterwards
       * would publish a card whose code links to the generator instead.
       *
       * The pre-render started when the dialog opened drew the un-claimed
       * card, so the first share pays for one more capture. That is the cost
       * of the code being right, and it is one capture.
       */
      const id = claimShareId();
      claimed.current = id;

      // Usually already resolved: the dialog opening started this — though not
      // on the first share, where claiming the id above just invalidated it.
      const rendered = await images();

      setStatus("uploading");

      /*
       * The card upload and the photo upload are independent, so they run at
       * the same time. Serialising them cost about two and a half seconds of
       * the share tap for nothing: the photo's URL is only needed in the
       * request body at the very end, and waiting for it before *starting* the
       * card upload put two unrelated round-trip chains end to end.
       *
       * The photo is additionally capped and caught — a pass that cannot store
       * its source photo is still a perfectly good pass, and the photo is
       * already baked into the card being posted either way.
       */
      const [card, photo] = await Promise.all([
        uploadCard(rendered.sheet, rendered.og),
        Promise.race([
          Promise.resolve(getPhotoUpload()).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), PHOTO_WAIT_MS)),
        ]),
      ]);

      setStatus("saving");
      const response = await fetch("/api/pass", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          name: fields.name,
          role: fields.role,
          stack: fields.stack,
          title: fields.title,
          passNumber: passId(fields.name),
          photoUrl: photo?.url,
          photoKey: photo?.key,
          cardUrl: card.sheet.url,
          cardKey: card.sheet.key,
          ogUrl: card.og.url,
          ogKey: card.og.key,
        }),
        // The response is a fresh id every time; a cached one would hand two
        // people the same share link.
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The pass could not be saved.");
      }

      return (await response.json()) as CreatePassResponse;
    });

    if (!result) {
      // Failed or was already running — do not leave a stranded blank tab.
      tab?.close();
      return null;
    }

    /*
     * `resolvePostUrl` decides between the share page and the raw image; see
     * its comment for why the page is almost always the right answer.
     */
    const posted = resolvePostUrl(result.shareUrl, result.imageUrl, isPublicSiteUrl());

    const intent = buildXIntentUrl({
      shareUrl: posted.url,
      name: fields.name,
      title: fields.title,
    });

    setShareUrl(result.shareUrl);
    setImageUrl(result.imageUrl);
    setStatus("done");

    if (posted.fellBack) {
      setNotice(
        "NEXT_PUBLIC_SITE_URL is not a public address, so the post links straight to the image. " +
          "Set it to the deployed URL to get a preview card on X.",
      );
    }

    if (tab) {
      // The blank tab is still same-origin, so its `opener` is writable from
      // here. Clearing it before the cross-origin navigation is what `noopener`
      // would have done — x.com must not hold a handle that can navigate the
      // editor out from under someone mid-share.
      tab.opener = null;
      tab.location.href = intent;
    }
    // Popup blocked: the URL is surfaced as a link in the UI instead, which is
    // still one tap and does not navigate the page away from the editor.
    else setError("Your browser blocked the new tab — use the link below to post.");

    return { ...result, intent };
  }, [claimShareId, fields, getPhotoUpload, images, run]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setNotice(null);
    setShareUrl(null);
    setImageUrl(null);
  }, []);

  return {
    status,
    busy,
    error,
    notice,
    shareUrl,
    imageUrl,
    download,
    share,
    prerender,
    reset,
  } as const;
}
