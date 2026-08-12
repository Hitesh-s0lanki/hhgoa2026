"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  CARD_SIZE,
  PassCardBack,
  PassCardFront,
  resolvePassFields,
} from "@/components/editor/PassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { PassFields } from "@/components/editor/PassCard";
import type { PassFields } from "@/components/editor/PassCard";
import type { Crop } from "@/lib/image/crop";

/**
 * The pass in hand: both faces of the card (PassCard.tsx) behind a pointer.
 *
 * Three gestures, in escalating commitment:
 *   - **hover** tilts the card toward the cursor (a lanyard card catching
 *     light, not a parallax gimmick — ±7° and it snaps back on leave);
 *   - **click/tap** flips it over;
 *   - **drag** spins it by hand, and release snaps to whichever face is
 *     nearest, so a half-turn lands flat instead of stuck edge-on.
 *
 * The angle is a running number, not a boolean: spinning it 540° with the
 * pointer must settle at "back", not lurch to some canonical 180°.
 *
 * Accessibility: the card stays a plain region a screen reader can read
 * through, and the flip is *also* a real button below the card — pointer
 * theatrics are never the only way to reach the backside. Reduced motion
 * kills the tilt here and the flip transition via the global CSS block.
 *
 * The hard offset shadow is a separate static sheet behind the 3D stage, so
 * the card rotates over its shadow the way a card on a table actually does.
 */

/*
 * `min-w-0` alongside `w-76`: a percentage `max-width` is treated as `none`
 * while a grid or flex parent works out intrinsic sizes, so the card's 304px
 * min-content contribution was sizing the hero's grid column — pushing a 320px
 * screen 4px past its own padding and clipping the headline and body copy.
 * Letting it shrink is safe now only because the card scales to fit rather
 * than being cropped; before `useFitScale` this would have sliced the artwork.
 */

const FLIP_THRESHOLD_PX = 5;
const DEG_PER_PX = 0.6;

/**
 * Scales the card down to whatever width it has actually been given.
 *
 * The card is a fixed 304×456 because the exported raster has to be
 * deterministic ([[CARD_SIZE]]). On a 320 px phone the pass dialog has ~240 px
 * of inner width, and a plain `max-w-full` there shrinks the card's *box* while
 * its fixed-px contents stay 304 px wide — so the wordmark, the builder-class
 * band and the footer row were being sliced off at the right edge. Scaling
 * keeps the whole card, just smaller.
 *
 * Measured rather than derived from breakpoints because the constraining box is
 * a dialog, not the viewport: the same component sits in a 26 rem grid column
 * on desktop and in a padded modal on a phone, and only the element knows.
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      // A zero measurement means the element is display:none somewhere up the
      // tree (a closed dialog). Keeping the last scale avoids a 0-width flash
      // when it opens.
      if (width > 0) setScale(Math.min(1, width / CARD_SIZE.width));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
}

export function PassPreview({
  fields,
  photoUrl,
  crop,
  shareId,
  className,
  interactive = true,
}: {
  fields?: Partial<PassFields>;
  photoUrl?: string | null;
  /** Passed straight through to the card's arch window. See [[lib/image/crop]]. */
  crop?: Crop;
  /** Passed straight through to the card's QR code. See [[PassCardFront]]. */
  shareId?: string | null;
  className?: string;
  /** False renders the front alone, inert — for decorative (aria-hidden) uses. */
  interactive?: boolean;
}) {
  const value = resolvePassFields(fields);
  const { ref: fitRef, scale } = useFitScale();

  /**
   * The card always lays out at its design size and is scaled from the top-left
   * corner, so the scaled box lines up with the column it was given. The
   * wrapper above reserves `height × scale` — without it the layout would keep
   * reserving the full 456 px and leave dead space under a shrunken card.
   */
  const stageStyle = {
    width: CARD_SIZE.width,
    height: CARD_SIZE.height,
    transform: scale === 1 ? undefined : `scale(${scale})`,
    transformOrigin: "top left",
  } as const;

  const [angle, setAngle] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const dragRef = useRef<{ startX: number; delta: number; moved: boolean } | null>(null);
  const noTilt = useRef(false);

  useEffect(() => {
    noTilt.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  if (!interactive) {
    return (
      <div ref={fitRef} className={cn("w-76 max-w-full min-w-0 shrink-0", className)}>
        <div style={{ height: CARD_SIZE.height * scale }}>
          <div className="relative" style={stageStyle}>
            <span
              aria-hidden="true"
              className="bg-brand-ink absolute inset-0 translate-x-2 translate-y-2 rounded-[1.4rem]"
            />
            <PassCardFront value={value} photoUrl={photoUrl} crop={crop} shareId={shareId} />
          </div>
        </div>
      </div>
    );
  }

  const showingBack = ((Math.round(angle / 180) % 2) + 2) % 2 === 1;

  const endDrag = (flip: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    setDragDelta(0);
    if (!drag || !flip) return;
    // A real drag snaps to the nearest face; an in-place press is a flip.
    setAngle((a) => (drag.moved ? Math.round((a + drag.delta) / 180) * 180 : a + 180));
  };

  return (
    <div ref={fitRef} className={cn("w-76 max-w-full min-w-0 shrink-0", className)}>
      {/* Reserves the card's *scaled* height, so the flip button below sits
          against the card rather than under a column of empty green. */}
      <div style={{ height: CARD_SIZE.height * scale }}>
        <div
          className="relative perspective-[1100px]"
          style={stageStyle}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { startX: event.clientX, delta: 0, moved: false };
            setDragging(true);
            setDragDelta(0);
            setTilt({ x: 0, y: 0 });
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (drag) {
              const dx = event.clientX - drag.startX;
              drag.delta = dx * DEG_PER_PX;
              drag.moved ||= Math.abs(dx) > FLIP_THRESHOLD_PX;
              setDragDelta(drag.delta);
              return;
            }
            if (noTilt.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const px = (event.clientX - rect.left) / rect.width - 0.5;
            const py = (event.clientY - rect.top) / rect.height - 0.5;
            setTilt({ x: py * -14, y: px * 14 });
          }}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        >
          {/* The static shadow sheet the card turns above. */}
          <span
            aria-hidden="true"
            className="bg-brand-ink absolute inset-0 translate-x-2 translate-y-2 rounded-[1.4rem]"
          />

          {/* Tilt layer: fast follow. Flip layer: slow turn. Split so the hover
            tilt never fights the 500ms flip transition. */}
          <div
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
            className="h-full w-full transition-transform duration-200 ease-out [transform-style:preserve-3d]"
          >
            <div
              style={{ transform: `rotateY(${angle + dragDelta}deg)` }}
              className={cn(
                "relative h-full w-full cursor-grab [touch-action:pan-y] select-none [transform-style:preserve-3d] active:cursor-grabbing",
                !dragging && "transition-transform duration-500",
              )}
            >
              <div className="absolute inset-0 [backface-visibility:hidden]">
                <PassCardFront value={value} photoUrl={photoUrl} crop={crop} shareId={shareId} />
              </div>
              <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <PassCardBack />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-pressed={showingBack}
          onClick={() => setAngle((a) => a + 180)}
        >
          <RefreshCw />
          {showingBack ? "Show the front" : "Flip to the back"}
        </Button>
        <p className="text-brand-cream/45 mt-2 text-[9px] leading-none">
          or drag the card to turn it over
        </p>
      </div>
    </div>
  );
}
