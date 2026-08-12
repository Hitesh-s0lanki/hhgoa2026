"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Lotus, SubjectSilhouette } from "@/components/brand/ornaments";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { type Crop, DEFAULT_CROP, ZOOM, clampCrop, cropStyle } from "@/lib/image/crop";
import type { Photo } from "@/lib/image/ingest";
import { cn } from "@/lib/utils";

/**
 * The photo half of the generator: pick one, then frame it.
 *
 * The drop target *is* the frame's photo window, so what the user aims at is
 * literally the hole their face goes into — and once a photo is in, that same
 * window becomes the control that moves it. One element, two jobs, no second
 * preview of the same picture.
 *
 * Framing is not a nicety here. The brief is explicit that people will not crop
 * before uploading, and a centred cover fit puts the subject of a landscape
 * group shot outside the arch with no recourse. Drag to pan, the slider to
 * zoom, arrow keys for both — see [[lib/image/crop]] for why the model is
 * fractional rather than pixel-based.
 *
 * Presentational by design: the file, its normalized bytes and the crop all
 * belong to the parent, which also feeds the card, so there is exactly one
 * owner of the photo and the preview can never disagree with the export.
 */

/** Arrow-key nudge, as a fraction of the window. ~2% is a visible but fine step. */
const NUDGE = 0.02;

/** The dashed enclosure. Both states wear it so the row never changes shape. */
const ROW =
  "border-brand-ink flex items-center gap-3.5 border-2 border-dashed p-3 transition-colors";

/**
 * The arch, at thumbnail size. The shape is the pass's own photo window rather
 * than UI chrome, which is why it survives every state of this control.
 *
 * The offset shadow is load-bearing, not decoration: a black rule around a dark
 * interior has almost no contrast against the green ground, so without it the
 * well is the one element on the page that does not read as an object.
 */
const WINDOW =
  "arch border-brand-ink bg-brand-deep shadow-brutal-sm relative flex aspect-3/4 w-24 shrink-0 items-center justify-center overflow-hidden border-2";

/** The dotted ring inside a solid frame — the event's pass, exactly. */
function Ring() {
  return (
    <span
      aria-hidden="true"
      className="arch border-brand-yellow/40 pointer-events-none absolute inset-1 z-10 border border-dotted"
    />
  );
}

/**
 * Covers the window while an ingest runs. A HEIC decode is a multi-second WASM
 * round trip, and an empty arch for that long reads as a control that ignored
 * the file rather than one that is working on it.
 */
function Busy({ on }: { on?: boolean }) {
  if (!on) return null;
  return (
    <span className="bg-brand-deep/75 absolute inset-0 z-20 flex items-center justify-center">
      <Loader2 className="text-brand-yellow size-5 animate-spin" />
    </span>
  );
}

/**
 * The line under the label. `truncate` because camera-roll filenames are long
 * and must not widen the panel; `role="status"` so a decode finishing or a
 * conversion happening is announced rather than only being visible.
 */
function Hint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} role="status" className="text-brand-cream/55 mt-1 block truncate text-[10px]">
      {children}
    </span>
  );
}

export function UploadZone({
  photo,
  busy,
  error,
  crop,
  onFile,
  onCropChange,
}: {
  photo: Photo | null;
  /** An ingest is running — a HEIC decode is seconds, and silence reads as broken. */
  busy?: boolean;
  /** Whatever went wrong upstream, written for the person who picked the file. */
  error?: string | null;
  crop: Crop;
  onFile: (file: File) => void;
  onCropChange: (crop: Crop) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const statusId = useId();

  const pick = useCallback(
    (file: File | undefined) => {
      if (file) onFile(file);
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
      pick(event.dataTransfer?.files[0]);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [pick]);

  /** Memoised so it is one stable object per photo — the clamp reads it a lot. */
  const natural = useMemo(
    () => (photo ? { width: photo.width, height: photo.height } : null),
    [photo],
  );

  /** Move by a fraction of the window, then pull back inside the photo's edges. */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      onCropChange(clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, natural));
    },
    [crop, natural, onCropChange],
  );

  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!photo || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop };
    setPanning(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const box = windowRef.current?.getBoundingClientRect();
    if (!start || !box?.width || !box.height) return;

    // Pixels travelled ÷ the window's own size: the offset the crop stores is a
    // fraction, so the same gesture means the same thing at any editor size.
    onCropChange(
      clampCrop(
        {
          ...start.crop,
          x: start.crop.x + (event.clientX - start.x) / box.width,
          y: start.crop.y + (event.clientY - start.y) / box.height,
        },
        natural,
      ),
    );
  };

  const endPan = () => {
    drag.current = null;
    setPanning(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowLeft"
        ? ([-NUDGE, 0] as const)
        : event.key === "ArrowRight"
          ? ([NUDGE, 0] as const)
          : event.key === "ArrowUp"
            ? ([0, -NUDGE] as const)
            : event.key === "ArrowDown"
              ? ([0, NUDGE] as const)
              : null;
    if (!step) return;
    // Otherwise the arrow keys scroll the page out from under the crop.
    event.preventDefault();
    nudge(step[0], step[1]);
  };

  const hint = photo
    ? photo.converted
      ? `${photo.file.name} · converted for the web`
      : photo.file.name
    : "JPG · PNG · HEIC · up to 25 MB";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        // `image/*` alongside the explicit list: it is what makes an iPhone
        // offer the camera and the photo library rather than the Files app.
        accept="image/*,.heic,.heif"
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          // Lets the user re-pick the same file after a rejection.
          event.target.value = "";
        }}
      />

      <div
        className={cn(
          ROW,
          dragging ? "bg-brand-yellow/20" : photo ? "bg-brand-deep/50" : null,
          // The empty row is one big button and gets the button's own hover; the
          // filled row is three separate controls and must not light up as one.
          !photo && !dragging && "bg-brand-deep/50 has-[button:hover]:bg-brand-deep",
        )}
      >
        {photo ? (
          <>
            {/* Filled: the same arch, now the control that moves the picture. */}
            <div
              ref={windowRef}
              // The one widget here that needs raw arrow keys — `application`
              // is what stops a screen reader's browse mode from eating them.
              role="application"
              aria-label="Position your photo. Use the arrow keys to move it."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPan}
              onPointerCancel={endPan}
              onKeyDown={onKeyDown}
              className={cn(
                WINDOW,
                // `touch-action: none` so a vertical drag on a phone moves the
                // photo instead of scrolling the page past it.
                "focus-visible:outline-brand-yellow cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-2",
                panning && "cursor-grabbing",
              )}
            >
              <Ring />
              {/* A local object URL — there is nothing for next/image to
                  optimize. eslint-disable-next-line @next/next/no-img-element */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="The photo you selected"
                // Otherwise the browser's own image drag starts and the pan
                // turns into a file drag over the page's own drop handler.
                draggable={false}
                style={cropStyle(crop)}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <Busy on={busy} />
            </div>

            <div className="min-w-0 flex-1">
              <span className="label-caps text-brand-yellow block text-[11px]">
                Drag to reframe
              </span>
              <Hint id={statusId}>{busy ? "Reading your photo…" : hint}</Hint>

              <div className="mt-2.5 flex items-center gap-2.5">
                <Slider
                  aria-label="Zoom"
                  value={[crop.zoom]}
                  min={ZOOM.min}
                  max={ZOOM.max}
                  step={ZOOM.step}
                  onValueChange={([zoom]) =>
                    onCropChange(clampCrop({ ...crop, zoom: zoom ?? ZOOM.min }, natural))
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Reset the framing"
                  title="Reset the framing"
                  onClick={() => onCropChange(DEFAULT_CROP)}
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>

            {/*
             * Its own button now, not the row: once the arch is a pan control
             * the row cannot also be one big click target, or every drag that
             * ends over the label would re-open the file picker.
             */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "self-center")}
            >
              Replace
            </button>
          </>
        ) : (
          /*
           * Empty: one control, one accessible name. The drop target *is* the
           * frame's photo window, so what the user aims at is literally the
           * hole their face goes into — and the whole row is that target,
           * because at this point there is nothing else in it to press.
           */
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="group flex w-full cursor-pointer items-center gap-3.5 text-left"
          >
            <span className={cn(WINDOW, "flex")}>
              <Ring />
              <SubjectSilhouette className="text-brand-cream/15 size-7 -translate-y-1" />
              <Lotus className="text-brand-pink/80 absolute bottom-1.5 left-1.5 w-2" />
              <Lotus className="text-brand-pink/80 absolute right-1.5 bottom-1.5 w-2" />
              <Busy on={busy} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="label-caps text-brand-yellow block text-[11px]">
                Your photo — drop it anywhere
              </span>
              <Hint id={statusId}>{busy ? "Reading your photo…" : hint}</Hint>
            </span>

            {/*
             * A span wearing the button's own classes, not a nested <button>:
             * the whole row is already the control, so this is the button's
             * *face* rather than a second one. The `group-*` pair widens the
             * press — pointing at the photo window presses it too.
             */}
            <span
              className={cn(
                buttonVariants({ size: "sm" }),
                "group-hover:shadow-brutal-sm group-hover:translate-x-0.75 group-hover:translate-y-0.75",
                "group-active:translate-x-1.25 group-active:translate-y-1.25 group-active:shadow-none",
              )}
            >
              Upload
            </span>
          </button>
        )}
      </div>

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
