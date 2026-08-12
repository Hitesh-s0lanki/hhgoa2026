"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Sparkles } from "lucide-react";
import { Sparkle } from "@/components/brand/ornaments";
import { BuilderForm, type FieldName } from "@/components/editor/BuilderForm";
import { CaptureSurface } from "@/components/editor/CaptureSurface";
import { PassDialog } from "@/components/editor/PassDialog";
import { PassPreview } from "@/components/editor/PassPreview";
import { resolvePassFields } from "@/components/editor/PassCard";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/uploader/UploadZone";
import { deriveTitle } from "@/lib/brand/titles";
import { type Crop, DEFAULT_CROP, cropKey } from "@/lib/image/crop";
import { type Photo, PhotoError, ingestPhoto } from "@/lib/image/ingest";
import { warmRasterizer } from "@/lib/render/rasterize";
import { newPassId } from "@/lib/share/pass-id";
import { usePassShare } from "@/lib/share/use-pass-share";
import { type Uploaded, uploadPhoto, warmUploader } from "@/lib/upload/client";

/**
 * Section 2 — the generator.
 *
 * One owner for the photo and the fields, so the upload well and the preview
 * can never disagree about what is loaded. The preview still updates as you
 * type (T-021) — there is nothing to submit and no state that a button commits.
 *
 * The numbered steps are gone. Photo and fields were never two decisions, and
 * the two headed blocks cost a screen of height to say so; they are one panel
 * now, with the upload as its first row. *Generate* is a viewing control on top
 * of that: it lifts the finished card into a dialog at full size, which is also
 * how the preview reaches a phone without another screen of scrolling.
 *
 * It also owns everything the export needs — the off-screen capture surface,
 * the background photo upload, and the share machine — because all three have
 * to start *before* the button that uses them is pressed. That is the entire
 * reason the download and the post feel instant rather than staged.
 */

/** Refused before anything is decoded — a ceiling on work, not on quality. */
const MAX_BYTES = 25 * 1024 * 1024;

export function Generator() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [reading, setReading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** How the photo sits in the arch. Reset with every new photo, never carried. */
  const [crop, setCrop] = useState<Crop>(DEFAULT_CROP);
  const [values, setValues] = useState<Record<FieldName, string>>({
    name: "",
    role: "",
    stack: "",
  });
  const [reroll, setReroll] = useState(0);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  /**
   * The id this browser's pass will live at, once it is posted — and therefore
   * the URL inside the QR code on the card.
   *
   * Null until the first share, on purpose. A pass that is only ever downloaded
   * has no `/share` page, so a code pointing at one would be a code that scans
   * to a 404 on an image the person already has; until then it points at the
   * generator (see [[passQrTarget]]). The id survives the whole session, so
   * fixing a typo and posting again refreshes the same page rather than
   * stranding the link already printed on the first download.
   */
  const [shareId, setShareId] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const ogRef = useRef<HTMLDivElement>(null);

  /**
   * The source photo goes up the moment it is picked, not when Share is
   * pressed. It is the largest file in the flow and the one step whose duration
   * we do not control, so it runs during the seconds the user spends typing
   * their name — by the time they press anything it has already landed.
   *
   * A ref, not state: nothing renders from it, and re-rendering the whole
   * generator when a background upload settles would restart the preview.
   */
  const photoUpload = useRef<Promise<Uploaded | null> | null>(null);

  // Revokes the previous object URL when the photo is replaced, and the last
  // one on unmount. Leaking these pins whole decoded bitmaps in memory.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  /**
   * Which pick is current. Ingest is asynchronous — a HEIC decode is seconds of
   * WASM — so someone who picks the wrong photo and immediately replaces it has
   * two runs in flight. Without this the slower one wins and the card shows the
   * photo they just rejected.
   */
  const pick = useRef(0);

  const onFile = useCallback(async (file: File) => {
    const token = ++pick.current;
    setPhotoError(null);

    if (file.size > MAX_BYTES) {
      setReading(false);
      setPhotoError("That file's too big — 25 MB is the ceiling.");
      return;
    }

    setReading(true);

    let next: Photo;
    try {
      next = await ingestPhoto(file);
    } catch (cause) {
      if (token !== pick.current) return;
      console.warn("[photo] ingest failed", cause);
      // The previous photo, if there was one, stays on the card: a rejected
      // replacement should not also destroy the pass someone already had.
      setReading(false);
      setPhotoError(
        cause instanceof PhotoError ? cause.message : "That photo could not be read. Try another.",
      );
      return;
    }

    // A newer pick landed first. Drop this one — including its object URL,
    // which nothing will ever render and the cleanup effect will never see.
    if (token !== pick.current) {
      URL.revokeObjectURL(next.url);
      return;
    }

    setPhoto(next);
    setReading(false);
    // A fresh photo has fresh framing; carrying a 3× zoom from the last one
    // would open on a crop of somebody else's face.
    setCrop(DEFAULT_CROP);

    // The normalized file, not the original: it is the one that has been
    // decoded, rotated upright and cut to a sane size, so the stored copy
    // matches the pixels on the card and the upload is a fraction of the bytes.
    //
    // Never rejects: a failed photo upload must not surface as an error on a
    // path the user has not asked for yet, and the share reads it as "no photo".
    photoUpload.current = uploadPhoto(next.file).catch((cause) => {
      console.warn("[pass] photo upload failed", cause);
      return null;
    });
  }, []);

  // Typing in the class field takes over permanently; the table never
  // overwrites a person who wanted "PROFESSIONAL YAK SHAVER".
  const title = titleOverride ?? deriveTitle(values.role, reroll);
  const fields = useMemo(() => ({ ...values, title }), [values, title]);

  /** What the card actually draws — empty fields fall back to placeholders. */
  const drawn = useMemo(() => resolvePassFields(fields), [fields]);

  /** No point mounting a second copy of the card for someone still reading. */
  const hasInput = Boolean(photo) || Boolean(values.name.trim());

  /**
   * Everything the card draws. A change here invalidates a cached render — and
   * the share id belongs in it, because it is drawn: it is the URL encoded in
   * the QR code.
   */
  const signature = `${drawn.name}|${drawn.role}|${drawn.stack}|${drawn.title}|${photo?.url ?? ""}|${cropKey(crop)}|${shareId ?? ""}`;

  /**
   * `flushSync` is doing real work here, not being defensive. The share reads
   * the capture surface immediately after this returns, and a normal `setState`
   * would still be queued at that point — the rasterizer would photograph the
   * previous card and publish a QR pointing at the generator. This forces the
   * re-render and the DOM commit before the caller's next line runs.
   */
  const claimShareId = useCallback(() => {
    if (shareId) return shareId;
    const id = newPassId();
    flushSync(() => setShareId(id));
    return id;
  }, [shareId]);

  const share = usePassShare({
    fields: { ...drawn, name: fields.name.trim() || drawn.name },
    nodes: useCallback(() => ({ sheet: sheetRef.current, og: ogRef.current }), []),
    getPhotoUpload: useCallback(() => photoUpload.current, []),
    signature,
    claimShareId,
  });

  /*
   * Spend the expensive setup now, in the background, while the user is still
   * typing. Both halves are lazy chunks that would otherwise be fetched inside
   * the click that needs them: the rasterizer, whose first capture also inlines
   * both web fonts (most of a second on a phone), and the uploader, which
   * carries `effect` with it. Once only — after this everything is cached.
   */
  const warmed = useRef(false);
  useEffect(() => {
    if (!hasInput || warmed.current || !sheetRef.current) return;
    warmed.current = true;
    warmRasterizer(sheetRef.current);
    warmUploader();
  }, [hasInput]);

  return (
    <section id="generate" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-12">
      <Reveal>
        <header className="text-center">
          <p className="label-caps text-brand-yellow flex items-center justify-center gap-2 text-[10px]">
            <Sparkle className="animate-twinkle text-brand-pink w-2" />
            Step into the frame
            <Sparkle className="animate-twinkle text-brand-pink w-2 [animation-delay:1.3s]" />
          </p>
          <h2 className="text-offset text-brand-yellow mt-3 text-[clamp(1.9rem,6.5vw,2.75rem)]">
            Build your pass.
          </h2>
        </header>
      </Reveal>

      {/* A fixed control column rather than `1fr`: at 1fr the panel floats alone
          in half a screen of green on a desktop. */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,26rem)_auto] lg:justify-center lg:gap-14">
        {/* `min-w-0`: the filename line inside the upload row is `truncate`, so
            its min-content contribution is the whole string — without this the
            grid column sizes to it and the panel hangs off a 390px screen. */}
        <Reveal delay={80} className="min-w-0">
          {/* One panel, one black rule around the whole job — photo and fields
              are the same decision and now look like it. */}
          <div className="border-brand-ink bg-brand-green shadow-brutal space-y-5 border-2 p-4 sm:p-5">
            <UploadZone
              photo={photo}
              busy={reading}
              error={photoError}
              crop={crop}
              onFile={onFile}
              onCropChange={setCrop}
            />

            <BuilderForm
              values={values}
              title={title}
              onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
              onTitleChange={setTitleOverride}
              onReroll={() => {
                setTitleOverride(null);
                setReroll((count) => count + 1);
              }}
            />

            <div className="space-y-3 pt-1">
              {/* Opening the dialog also starts the render. The user then
                  spends a few seconds looking at their card, which is exactly
                  long enough for both PNGs to be ready before they press
                  anything — so Download is instant and Post only pays for the
                  network. */}
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setShowPass(true);
                  if (fields.name.trim()) share.prerender();
                }}
              >
                <Sparkles />
                Generate pass
              </Button>
              {/*
               * This used to promise the photo never left the device. It does
               * now — the card is uploaded so a posted link has something to
               * unfurl, and the photo with it. Saying so plainly is not
               * optional: the old line would be a false privacy claim, which is
               * worse than no claim at all.
               */}
              <p className="text-brand-cream/45 text-center text-[10px] leading-relaxed">
                No signup, no account. Your pass is only uploaded when you post or share it.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Desktop only: on a phone this is a second full card between the
            fields and the footer, and the dialog already shows it at full size
            on demand. All the card's motion (tilt, flip) is the pointer's
            doing — artwork that bobs on its own while you type in it reads as
            a broken preview. */}
        <Reveal delay={160} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <h3 className="label-caps text-brand-cream/50 mb-3 text-center text-[10px]">
            Live preview
          </h3>
          <PassPreview photoUrl={photo?.url} crop={crop} fields={fields} shareId={shareId} />
        </Reveal>
      </div>

      {/* Off-screen, and the only thing that is ever rasterised. Mounted here
          rather than in the dialog so it is laid out and warm long before the
          dialog opens. */}
      {hasInput ? (
        <CaptureSurface
          fields={drawn}
          photoUrl={photo?.url}
          crop={crop}
          shareId={shareId}
          sheetRef={sheetRef}
          ogRef={ogRef}
        />
      ) : null}

      <PassDialog
        open={showPass}
        onOpenChange={setShowPass}
        fields={fields}
        photoUrl={photo?.url}
        crop={crop}
        shareId={shareId}
        share={share}
        canExport={Boolean(fields.name.trim())}
      />
    </section>
  );
}
