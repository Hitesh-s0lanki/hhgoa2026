"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Lotus, SubjectSilhouette } from "@/components/brand/ornaments";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one primary action in the generator.
 *
 * The drop target *is* the frame's photo window, so what the user aims at is
 * literally the hole their face goes into. One control, one accessible name.
 *
 * It is a *row*, not a hero well: the well used to own a third of the section's
 * height for a control that is pressed once, which pushed the fields — the part
 * you actually work in — below the fold. The arch is kept at thumbnail size so
 * the photo window is still recognisable as the hole the face goes into.
 *
 * Presentational by design: the file and its object URL belong to the parent,
 * which also feeds the preview, so there is exactly one owner of the photo.
 *
 * Scope note: real ingest — magic-byte validation, HEIC decode, EXIF
 * orientation, downscale — is T-006 → T-009. The guards below are the minimum
 * needed so an obviously wrong file fails in place with a readable message
 * instead of silently painting a broken image.
 */

const MAX_BYTES = 25 * 1024 * 1024;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** iOS hands HEIC pickers an empty MIME type often enough to plan for it. */
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

const ACCEPT_ATTR = [...ACCEPTED, ".heic", ".heif"].join(",");

function rejectionReason(file: File): string | null {
  const looksLikeAPhoto =
    ACCEPTED.includes(file.type.toLowerCase()) ||
    (file.type === "" && ACCEPTED_EXTENSIONS.test(file.name));

  if (!looksLikeAPhoto) return "That's not a photo. Try a JPG, PNG, or HEIC.";
  if (file.size > MAX_BYTES) return "That file's too big — 25 MB is the ceiling.";
  return null;
}

export function UploadZone({
  photoUrl,
  fileName,
  onFile,
}: {
  photoUrl?: string | null;
  fileName?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const statusId = useId();

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      const reason = rejectionReason(file);
      if (reason) {
        setError(reason);
        return;
      }

      setError(null);
      setPreviewBroken(false);
      onFile(file);
    },
    [onFile],
  );

  /*
   * The whole window is the drop target, not just the well. Two reasons: on a
   * desktop the natural aim is "anywhere on that card", and — more importantly
   * — a photo dropped on a page that ignores it makes the browser *navigate to
   * the file*, which throws away everything the user has done. Cancelling the
   * default everywhere is what prevents that.
   */
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      // relatedTarget is null only when the pointer leaves the window itself.
      if (!event.relatedTarget) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      accept(event.dataTransfer?.files[0]);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [accept]);

  const hasPhoto = Boolean(photoUrl) && !previewBroken;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          // Lets the user re-pick the same file after a rejection.
          event.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group border-brand-ink flex w-full cursor-pointer items-center gap-3.5 border-2 border-dashed p-3 text-left transition-colors",
          dragging ? "bg-brand-yellow/20" : "bg-brand-deep/50 hover:bg-brand-deep",
        )}
      >
        {/* The arch survives the restyle: it is the pass's photo window, which
            the canvas renderer reproduces, not a piece of UI chrome that could
            be squared off with everything else. */}
        <span
          // The offset shadow is load-bearing here, not decoration: a black rule
          // around a dark-green interior has almost no contrast against the
          // green ground, so without it the well is the one element on the page
          // that does not read as an object.
          className="arch border-brand-ink bg-brand-deep shadow-brutal-sm relative flex aspect-3/4 w-14 shrink-0 items-center justify-center overflow-hidden border-2"
        >
          {/* The dotted ring inside a solid frame — the event's pass, exactly. */}
          <span
            aria-hidden="true"
            className="arch border-brand-yellow/40 pointer-events-none absolute inset-1 border border-dotted"
          />

          {hasPhoto ? (
            // A local object URL — there is nothing for next/image to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl ?? undefined}
              alt="The photo you selected"
              onError={() => setPreviewBroken(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <SubjectSilhouette className="text-brand-cream/15 size-7 -translate-y-1" />
              <Lotus className="text-brand-pink/80 absolute bottom-1.5 left-1.5 w-2" />
              <Lotus className="text-brand-pink/80 absolute right-1.5 bottom-1.5 w-2" />
            </>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="label-caps text-brand-yellow block text-[11px]">
            {hasPhoto ? "Your photo" : "Your photo — drop it anywhere"}
          </span>
          <span
            id={statusId}
            role="status"
            className="text-brand-cream/55 mt-1 block truncate text-[10px]"
          >
            {/* Long camera-roll filenames must not widen the panel. The privacy
                line under the form carries the reassurance, so this stays a bare
                confirmation of what was picked. */}
            {fileName ?? "JPG · PNG · HEIC · up to 25 MB"}
          </span>
        </span>

        {/*
         * A span wearing the button's own classes, not a nested <button>: the
         * whole row is already the control (one accessible name, one click
         * target), so this is the button's *face* rather than a second one.
         *
         * The `group-*` pair widens the press rather than replacing it — it
         * fires on the same values as the variant's own `hover:`/`active:`, so
         * the two agree wherever they overlap and the only thing gained is that
         * pointing at the photo window presses the button too.
         */}
        <span
          className={cn(
            buttonVariants({ size: "sm", variant: hasPhoto ? "secondary" : "default" }),
            "group-hover:shadow-brutal-sm group-hover:translate-x-0.75 group-hover:translate-y-0.75",
            "group-active:translate-x-1.25 group-active:translate-y-1.25 group-active:shadow-none",
          )}
        >
          {hasPhoto ? "Replace" : "Upload"}
        </span>
      </button>

      {error ? (
        <p
          role="alert"
          className="border-brand-ink bg-brand-pink text-brand-ink shadow-brutal-sm mt-3 border-2 px-3 py-2 text-[11px] leading-relaxed"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
