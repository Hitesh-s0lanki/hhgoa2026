"use client";

import { Check, Download, Image as ImageIcon, Link2, Loader2 } from "lucide-react";
import { XMark } from "@/components/site/social-icons";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type usePassShare } from "@/lib/share/use-pass-share";

/**
 * The two things you can do with a finished pass.
 *
 * Download first and Share second, in that visual weight: download is the
 * guaranteed path — it needs no network, no database and no third party, so it
 * is the one that always works, and it is what most people at a venue with bad
 * wifi actually want. Share is the outbound one and is allowed to fail.
 *
 * Purely presentational. All the state lives in `usePassShare` so the dialog
 * owns one machine rather than this component owning half of it.
 */

export function PassActions({
  share,
  disabled,
  disabledReason,
}: {
  share: ReturnType<typeof usePassShare>;
  /** True until the pass is worth exporting — currently, until it has a name. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { status, busy, error, notice, shareUrl, imageUrl } = share;
  const blocked = disabled || busy;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={blocked}
          onClick={() => void share.download()}
        >
          {busy && status === "rendering" ? <Loader2 className="animate-spin" /> : <Download />}
          Download the card
        </Button>

        <Button
          type="button"
          className="flex-1"
          disabled={blocked}
          onClick={() => void share.share()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <XMark className="size-4" />}
          Post on X
        </Button>
      </div>

      {/*
       * One live region for every outcome, rather than a spinner here and a
       * toast there. `role="status"` so a screen reader hears the step change;
       * the same element carries the error because a user watching one line for
       * progress should not have to find a second line for the failure.
       */}
      <p role="status" aria-live="polite" className="min-h-[1.25rem] text-center text-[10px]">
        {busy ? <span className="text-brand-cream/70">{STATUS_LABEL[status]}</span> : null}

        {!busy && error ? (
          <span className="text-brand-pink border-brand-pink/40 block border-2 border-dashed px-3 py-2 leading-relaxed">
            {error}
          </span>
        ) : null}

        {!busy && !error && status === "done" ? (
          <span className="text-brand-yellow inline-flex items-center gap-1.5">
            <Check className="size-3" aria-hidden="true" />
            Ready — check the new tab, or your downloads.
          </span>
        ) : null}

        {!busy && !error && status === "idle" && disabled ? (
          <span className="text-brand-cream/45">{disabledReason}</span>
        ) : null}
      </p>

      {/* A misconfiguration the share survived — worth saying, but not an error. */}
      {notice ? (
        <p className="border-brand-yellow/50 text-brand-yellow/80 border-2 border-dashed px-3 py-2 text-[10px] leading-relaxed">
          {notice}
        </p>
      ) : null}

      {/*
       * Both URLs, because they are for different jobs and people reach for the
       * wrong one otherwise.
       *
       * The share page is what goes in a post: X reads `og:image` off it to
       * build the preview card, and a link straight to the PNG has no meta tags
       * for it to read, so it would arrive as plain text with no picture.
       *
       * The image URL is the file itself on the CDN — for embedding somewhere
       * that wants an image source, or saving on a phone.
       */}
      {shareUrl || imageUrl ? (
        <dl className="border-brand-yellow/30 space-y-2 border-2 border-dashed px-3 py-2.5">
          {shareUrl ? (
            <div className="flex items-center gap-2">
              <Link2 className="text-brand-yellow/70 size-3.5 shrink-0" aria-hidden="true" />
              <dt className="label-caps text-brand-yellow/70 w-14 shrink-0 text-[8px]">Post</dt>
              <dd className="min-w-0 flex-1">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-cream/80 hover:text-brand-yellow block truncate text-[10px] underline-offset-2 hover:underline"
                >
                  {shareUrl}
                </a>
              </dd>
            </div>
          ) : null}

          {imageUrl ? (
            <div className="border-brand-yellow/15 flex items-center gap-2 border-t border-dotted pt-2">
              <ImageIcon className="text-brand-yellow/70 size-3.5 shrink-0" aria-hidden="true" />
              <dt className="label-caps text-brand-yellow/70 w-14 shrink-0 text-[8px]">Image</dt>
              <dd className="min-w-0 flex-1">
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-cream/80 hover:text-brand-yellow block truncate text-[10px] underline-offset-2 hover:underline"
                >
                  {imageUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
