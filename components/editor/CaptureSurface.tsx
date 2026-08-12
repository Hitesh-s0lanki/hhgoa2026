"use client";

import type { RefObject } from "react";
import { Lotus, Sparkle, Waves } from "@/components/brand/ornaments";
import { PassCardBack, PassCardFront, type PassFields } from "@/components/editor/PassCard";
import { EVENT, SHARE_HASHTAG, SITE_URL } from "@/lib/site";

/**
 * What actually gets rasterised.
 *
 * The on-screen preview is the wrong thing to photograph: it lives inside a
 * perspective stage under a live `rotateY`, one face is `backface-visibility:
 * hidden`, and it is responsive. Capturing it would export whatever tilt the
 * pointer happened to leave behind.
 *
 * So the export gets its own DOM — the same two card faces, at fixed pixel
 * sizes, with no transform on them — parked off-screen. It is laid out (not
 * `display:none`) because a node with no layout has nothing to clone, and it is
 * `inert` + `aria-hidden` so a duplicate of the whole card never reaches the
 * tab order or a screen reader.
 *
 * Two compositions, because a card and a link preview are different pictures:
 *
 *   - **sheet** — both faces side by side. This is "the complete card", and
 *     what Download hands back.
 *   - **og** — 1200×630, the front plus the builder's name set large. X and
 *     WhatsApp crop a link thumbnail to roughly 2:1; the sheet posted into that
 *     slot would arrive with its two cards clipped at the sides.
 */

/** The card's native size. Every type size inside `PassCard` is set for it. */
const CARD = { width: 304, height: 456 };

/** 32px margin, 32px gutter, and room under the cards for one printed line. */
const SHEET = { width: 704, height: 556 };

/** The size every crawler expects. Rasterised at 2× for a retina thumbnail. */
const OG = { width: 1200, height: 630 };

/** Big enough that the card reads as the subject, not a thumbnail on a field. */
const OG_CARD_SCALE = 1.18;

export const CAPTURE_SIZES = { CARD, SHEET, OG, OG_CARD_SCALE } as const;

function CardFace({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: CARD.width, height: CARD.height }} className="relative shrink-0">
      {children}
    </div>
  );
}

export function CaptureSurface({
  fields,
  photoUrl,
  shareId,
  sheetRef,
  ogRef,
}: {
  fields: PassFields;
  photoUrl?: string | null;
  /**
   * The id the pass is about to be published under, once the share flow has
   * claimed one. This is the only place it materially matters: whatever is on
   * this DOM at capture time is the QR code baked into the PNG people keep.
   */
  shareId?: string | null;
  sheetRef: RefObject<HTMLDivElement | null>;
  ogRef: RefObject<HTMLDivElement | null>;
}) {
  const detail = [fields.role, fields.stack].filter(Boolean).join("  ·  ");

  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none fixed top-0 left-0 -z-50 select-none"
      // Off the left edge rather than `visibility:hidden` or `opacity:0`:
      // those keep layout but the clone inherits them, and the export comes
      // back blank. Fixed positioning keeps it out of the document flow, so it
      // cannot extend the page or move the scrollbar.
      style={{ transform: "translateX(-200vw)" }}
    >
      {/* ---- The complete card: front and back, one sheet ---- */}
      <div
        ref={sheetRef}
        style={{ width: SHEET.width, height: SHEET.height }}
        className="bg-brand-green flex flex-col items-center justify-center gap-3 p-8"
      >
        <div className="flex items-center gap-8">
          <CardFace>
            <PassCardFront value={fields} photoUrl={photoUrl} shareId={shareId} />
          </CardFace>
          <CardFace>
            <PassCardBack />
          </CardFace>
        </div>

        {/* The printed line along the bottom of the sheet — this file gets
            posted somewhere with no page around it, so it carries its own
            attribution rather than arriving as an anonymous card. */}
        <p className="label-caps text-brand-cream/60 flex items-center gap-2 text-[10px]">
          <Waves className="text-brand-cream/30 w-6" />
          <Sparkle className="text-brand-pink w-1.5" />
          {EVENT.location} · {EVENT.dates} · #{SHARE_HASHTAG}
          <Sparkle className="text-brand-pink w-1.5" />
          <Waves className="text-brand-cream/30 w-6" />
        </p>
      </div>

      {/* ---- The link preview ---- */}
      <div
        ref={ogRef}
        style={{ width: OG.width, height: OG.height }}
        className="bg-brand-green flex items-center gap-16 overflow-hidden px-20"
      >
        {/*
         * The wrapper is sized to the *scaled* card so the flex row reserves
         * the right width — a transform paints outside the layout box, and
         * without this the text column would sit under the card's edge.
         */}
        <div
          style={{
            width: Math.round(CARD.width * OG_CARD_SCALE),
            height: Math.round(CARD.height * OG_CARD_SCALE),
          }}
          className="relative shrink-0"
        >
          <div
            style={{
              width: CARD.width,
              height: CARD.height,
              transform: `scale(${OG_CARD_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <PassCardFront value={fields} photoUrl={photoUrl} shareId={shareId} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="label-caps text-brand-yellow flex items-center gap-2.5 text-[15px]">
            <Sparkle className="text-brand-pink w-2.5" />
            {EVENT.name} · Builder pass
          </p>

          {/* `break-words`: a 28-character name with no spaces would otherwise
              run straight off the 1200px edge and be cropped mid-letter. */}
          <p className="font-display text-offset text-brand-yellow mt-5 text-[58px] leading-[0.88] break-words uppercase">
            {fields.name}
          </p>

          <div className="border-brand-yellow mt-7 inline-flex max-w-full items-center gap-3 border-2 px-4 py-2.5">
            <Lotus className="text-brand-pink w-4 shrink-0" />
            <span className="font-display text-offset text-brand-pink truncate text-[26px] uppercase">
              {fields.title}
            </span>
            <Lotus className="text-brand-pink w-4 shrink-0" />
          </div>

          {detail ? (
            <p className="text-brand-cream/85 mt-6 truncate text-[17px]">{detail}</p>
          ) : null}

          <p className="label-caps text-brand-cream/55 mt-9 text-[13px]">
            {SITE_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "")} · #{SHARE_HASHTAG}
          </p>
        </div>
      </div>
    </div>
  );
}
