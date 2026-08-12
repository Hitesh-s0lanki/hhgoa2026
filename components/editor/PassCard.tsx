import {
  CodeXml,
  Fingerprint,
  Home,
  LaptopMinimal,
  Presentation,
  User,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { DottedRule, Lotus, Sparkle, SubjectSilhouette, Waves } from "@/components/brand/ornaments";
import { QrCode } from "@/components/brand/QrCode";
import { type Crop, cropStyle } from "@/lib/image/crop";
import { passQrTarget } from "@/lib/share/qr-target";
import { EVENT } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The builder pass, both faces, styled after the event's own lanyard card
 * (docs/sample-images): rounded badge, yellow hairline, arched photo window,
 * the गोवा chip over the wordmark, a labelled field table with a QR block,
 * and a backside carrying access icons, the four-day schedule and the
 * VALID BUILDER ACCESS band.
 *
 * **Still a DOM stand-in, not the deliverable** — the shipped artwork is a
 * real raster from the canvas renderer (FR-3.1), and this is the composition
 * it will reproduce. Purely presentational: interactivity (tilt, flip) lives
 * in PassPreview, which owns these faces.
 *
 * The card is *artwork*, not chrome, which is why it is allowed the two
 * things the UI never gets: rounded corners and the arch.
 */

export type PassFields = {
  name: string;
  role: string;
  stack: string;
  title: string;
};

/**
 * The card's design size, in CSS pixels. Every type size, rule and inset below
 * is set for exactly this box — the layout is not fluid, on purpose: the
 * rasterizer needs a deterministic 304×456 to capture (see CaptureSurface).
 *
 * Which means a container narrower than this cannot simply squeeze the card;
 * doing that shrinks the box while the fixed-px contents stay put and get
 * clipped. Anywhere the card has to fit a smaller space it is *scaled* instead,
 * from this size. Exported so the preview and the capture surface agree.
 */
export const CARD_SIZE = { width: 304, height: 456 } as const;

const PLACEHOLDER: PassFields = {
  name: "Your name",
  role: "Your role",
  stack: "Your stack",
  title: "Builder",
};

/**
 * Not a spread: `{...PLACEHOLDER, ...fields}` overwrites the placeholder with
 * undefined, and an emptied field renders as a blank row instead of falling
 * back. `||` also covers the empty string a cleared input actually produces.
 */
export function resolvePassFields(fields?: Partial<PassFields>): PassFields {
  return {
    name: fields?.name || PLACEHOLDER.name,
    role: fields?.role || PLACEHOLDER.role,
    stack: fields?.stack || PLACEHOLDER.stack,
    title: fields?.title || PLACEHOLDER.title,
  };
}

/**
 * The pass number, derived from the name so it is stable across renders (no
 * hydration drift) but personal enough to feel issued. The empty-name default
 * is the number on the event's own sample pass.
 */
export function passId(name: string): string {
  if (!name.trim() || name === PLACEHOLDER.name) return "HHG-2026-0247";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return `HHG-2026-${String(hash % 10000).padStart(4, "0")}`;
}

/** From the sample pass footer — Goa's coordinates, printed like a boarding card. */
const COORDS = "15.2993° N · 74.1240° E";

/** One face: rounded badge, black rule, deep ground, yellow hairline inset. */
const FACE =
  "relative flex h-full w-full flex-col overflow-hidden rounded-[1.4rem] border-2 border-brand-ink bg-brand-deep";

function Hairline() {
  return (
    <span
      aria-hidden="true"
      className="border-brand-yellow/50 pointer-events-none absolute inset-2 z-10 rounded-[1rem] border"
    />
  );
}

/** The punch-out a lanyard clip goes through. What makes it a *pass*. */
function LanyardSlot() {
  return (
    <span
      aria-hidden="true"
      className="border-brand-ink bg-brand-green mx-auto mt-3 block h-2 w-14 shrink-0 rounded-full border-2"
    />
  );
}

/** A waxing/waning moon pair frames the seal on both faces of the sample. */
function Crescent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className}>
      <path d="M11.5 1A7.3 7.3 0 1 0 11.5 15 8.6 8.6 0 0 1 11.5 1Z" fill="currentColor" />
    </svg>
  );
}

/** The circular HH GOA stamp between the crescents. */
function Seal() {
  return (
    <span className="label-caps border-brand-yellow text-brand-yellow flex size-6 shrink-0 items-center justify-center rounded-full border text-center text-[5px] leading-[1.2]">
      HH
      <br />
      GOA
    </span>
  );
}

/**
 * Static bars — the sample's barcode is set dressing, and so is this.
 * Positions are laid out once at module load: alternating widths become
 * bar/gap runs, and every even run is a printed bar.
 */
const BAR_WIDTHS = [3, 1, 2, 1, 1, 3, 1, 2, 4, 1, 2, 1, 3, 1, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 1, 3];
let barCursor = 0;
const BARS = BAR_WIDTHS.map((width, index) => {
  const bar = { x: barCursor, width, printed: index % 2 === 0 };
  barCursor += width;
  return bar;
});
const BARCODE_WIDTH = barCursor;

function Barcode({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("border-brand-yellow/60 block rounded-sm border px-1.5 py-1", className)}
    >
      <svg
        viewBox={`0 0 ${BARCODE_WIDTH} 12`}
        preserveAspectRatio="none"
        className="block h-4 w-full text-current"
        fill="currentColor"
      >
        {BARS.filter((bar) => bar.printed).map((bar) => (
          <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="12" />
        ))}
      </svg>
    </span>
  );
}

/** The arched photo window, dotted ring and all — the hole the face goes in. */
function ArchWindow({ photoUrl, crop }: { photoUrl?: string | null; crop?: Crop }) {
  return (
    <div className="arch border-brand-yellow bg-brand-green/50 relative flex aspect-3/4 w-full items-center justify-center overflow-hidden border-2">
      {photoUrl ? (
        // A local object URL — there is nothing for next/image to optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          // `object-cover` frames it; the transform is the user's own
          // adjustment on top. Both are plain CSS, so the rasterizer reproduces
          // the crop exactly rather than re-deriving it. See [[cropStyle]].
          style={cropStyle(crop)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <SubjectSilhouette className="text-brand-cream/12 size-14 -translate-y-2" />
          <Waves className="text-brand-cream/15 absolute inset-x-4 bottom-4" />
          <Lotus className="text-brand-pink/80 absolute bottom-3 left-4 w-3" />
          <Lotus className="text-brand-pink/80 absolute right-4 bottom-3 w-3" />
        </>
      )}
      <span
        aria-hidden="true"
        className="arch border-brand-yellow/40 pointer-events-none absolute inset-1.5 border border-dotted"
      />
    </div>
  );
}

function FrontField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }> | null;
  label: string;
  value: string;
}) {
  return (
    <div className="border-brand-yellow/15 flex items-center gap-2 border-b py-[5px] last:border-b-0">
      {Icon ? (
        <Icon className="text-brand-yellow size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Sparkle className="text-brand-yellow w-3.5 shrink-0" />
      )}
      <span className="border-brand-yellow/25 min-w-0 border-l border-dotted pl-2">
        <span className="label-caps text-brand-yellow/80 block text-[6.5px] leading-none">
          {label}:
        </span>
        <span className="text-brand-cream mt-0.5 block truncate text-[10.5px] leading-tight">
          {value}
        </span>
      </span>
    </div>
  );
}

export function PassCardFront({
  value,
  photoUrl,
  crop,
  shareId,
  className,
}: {
  value: PassFields;
  photoUrl?: string | null;
  /** How the photo is framed inside the arch. Undefined is the plain cover fit. */
  crop?: Crop;
  /**
   * The id this pass will be published under, when it has one. The QR encodes
   * `/share/<id>` — the page with the card big and a Download button on it —
   * so scanning someone's badge hands you their pass. Until the pass has been
   * posted there is no such page, and [[passQrTarget]] points the code at the
   * generator instead of at a 404.
   */
  shareId?: string | null;
  className?: string;
}) {
  return (
    <div className={cn(FACE, className)}>
      <Hairline />
      <LanyardSlot />

      <div className="mt-2 flex items-start gap-3 px-4">
        <div className="w-[42%] shrink-0">
          <ArchWindow photoUrl={photoUrl} crop={crop} />
        </div>

        <div className="min-w-0 flex-1 pt-0.5 text-center">
          <p className="label-caps text-brand-yellow text-[9px]">HH Goa</p>
          <DottedRule className="text-brand-yellow/40 mt-1.5" />
          {/* The wordmark with the गोवा chip pinned over it, the sample's own
              move. The chip is pink-on-green's one legal use: large display. */}
          <div className="relative mt-2.5">
            <p className="font-display text-offset text-brand-yellow text-[1.65rem] leading-[0.85] uppercase">
              Hacker
              <br />
              House
            </p>
            <span className="border-brand-ink bg-brand-pink text-brand-cream shadow-brutal-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 border-2 px-1.5 py-0.5 text-[13px] leading-none font-bold">
              गोवा
            </span>
          </div>
          <p className="label-caps text-brand-yellow mt-2.5 flex items-center justify-center gap-1.5 text-[8px]">
            <Sparkle className="text-brand-pink w-1.5" />
            {EVENT.location}
            <Sparkle className="text-brand-pink w-1.5" />
          </p>
          <p className="label-caps text-brand-cream/80 mt-1 text-[8px] whitespace-nowrap">
            {EVENT.dates}
          </p>
        </div>
      </div>

      <p className="label-caps text-brand-cream/85 mx-4 mt-2.5 flex items-center gap-2 text-[8px]">
        <span aria-hidden="true" className="bg-brand-pink/70 h-px flex-1" />
        Less noise. <span className="text-brand-pink">More signal.</span>
        <span aria-hidden="true" className="bg-brand-pink/70 h-px flex-1" />
      </p>

      <div className="border-brand-yellow/20 mx-4 mt-1.5 flex gap-2.5 border-t pt-1">
        <div className="min-w-0 flex-1">
          <FrontField icon={User} label="Builder name" value={value.name} />
          <FrontField icon={CodeXml} label="Stack" value={value.stack} />
          <FrontField icon={null} label="Builder class" value={value.title} />
          <FrontField icon={Fingerprint} label="Pass ID" value={passId(value.name)} />
        </div>
        {/* 92px, up from 84: the code is 29 modules plus its quiet zone, and
            this is the width at which each module clears ~2.5px on screen —
            the point where a phone camera stops hunting. The export is 3×, so
            the downloaded PNG has a very comfortable code. */}
        <div className="w-23 shrink-0 pt-1.5">
          <QrCode value={passQrTarget(shareId)} className="w-full" />
          <span className="mt-1.5 flex items-center justify-center gap-1.5">
            <Sparkle className="text-brand-pink w-2 shrink-0" />
            <Waves className="text-brand-cream/25 w-8" />
          </span>
        </div>
      </div>

      {/* The class band: the pass's loudest slot, straight from the sample —
          pink display caps inside a yellow rule, lotus each side. */}
      <div className="border-brand-yellow mx-4 mt-2 flex items-center justify-center gap-2 rounded-md border-2 px-2 py-1.5">
        <Lotus className="text-brand-pink w-3.5 shrink-0" />
        <span className="font-display text-offset text-brand-pink truncate text-[15px] uppercase">
          {value.title}
        </span>
        <Lotus className="text-brand-pink w-3.5 shrink-0" />
      </div>

      <div className="mt-auto mb-3 flex items-center justify-between gap-2 px-4">
        <span className="text-brand-cream/50 text-[6.5px] whitespace-nowrap">{COORDS}</span>
        <span className="flex shrink-0 items-center gap-1">
          <Crescent className="text-brand-yellow w-2.5" />
          <Seal />
          <Crescent className="text-brand-yellow w-2.5 -scale-x-100" />
        </span>
        <span className="label-caps text-brand-cream/50 text-[6.5px] whitespace-nowrap">
          Build · Hack · Ship · Repeat
        </span>
      </div>
    </div>
  );
}

const ACCESS = [
  { icon: Home, label: "Residency" },
  { icon: LaptopMinimal, label: "Workspace" },
  { icon: UtensilsCrossed, label: "Meals" },
  { icon: Wifi, label: "Wifi" },
  { icon: Presentation, label: "Demo Day" },
] as const;

const DAYS = [
  { day: "Day 01", label: "Genesis Day" },
  { day: "Day 02", label: "Problem / Solution / Market" },
  { day: "Day 03", label: "Build Day" },
  { day: "Day 04", label: "Launch Day" },
] as const;

export function PassCardBack({ className }: { className?: string }) {
  return (
    <div className={cn(FACE, className)}>
      <Hairline />
      <LanyardSlot />

      <p className="label-caps text-brand-yellow mt-1.5 text-center text-[9px]">HH Goa</p>

      <div className="border-brand-yellow mx-4 mt-1.5 rounded-md border-2 py-1 text-center">
        <span className="font-display text-brand-yellow text-[13px] uppercase">
          Builder Pass <span className="text-brand-pink">{"// Backside"}</span>
        </span>
      </div>

      <p className="label-caps text-brand-yellow mt-2 flex items-center justify-center gap-2 text-[8px]">
        <Waves className="text-brand-cream/30 w-7 shrink-0" />
        <Sparkle className="text-brand-pink w-1.5 shrink-0" />
        {EVENT.location}
        <Sparkle className="text-brand-pink w-1.5 shrink-0" />
        <Waves className="text-brand-cream/30 w-7 shrink-0" />
      </p>
      <p className="label-caps text-brand-cream/80 mt-1 text-center text-[8px]">{EVENT.dates}</p>

      <div className="border-brand-yellow mx-4 mt-2 rounded-md border-2 px-2 pt-1.5 pb-2">
        <p className="flex items-center justify-center gap-2">
          <Lotus className="text-brand-pink w-3 shrink-0" />
          <span className="font-display text-offset text-brand-pink text-[13px] uppercase">
            Access
          </span>
          <Lotus className="text-brand-pink w-3 shrink-0" />
        </p>
        <div className="border-brand-yellow/25 divide-brand-yellow/25 mt-1.5 grid grid-cols-5 divide-x divide-dotted border-t pt-2">
          {ACCESS.map(({ icon: Icon, label }) => (
            <span key={label} className="flex flex-col items-center gap-1 px-0.5">
              <Icon className="text-brand-yellow size-4" aria-hidden="true" />
              <span className="label-caps text-brand-cream/80 text-center text-[5.5px] leading-tight">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <p className="label-caps text-brand-cream/85 mt-2 text-center text-[7.5px]">
        4 days. <span className="text-brand-pink">One rhythm.</span> Everything intentional.
      </p>

      <div className="mx-4 mt-1">
        {DAYS.map(({ day, label }) => (
          <p
            key={day}
            className="border-brand-yellow/15 flex items-center gap-2 border-b py-[4.5px] last:border-b-0"
          >
            <Sparkle className="text-brand-pink w-2 shrink-0" />
            <span className="text-brand-cream truncate text-[9px]">
              <span className="text-brand-yellow">{day}</span> — {label}
            </span>
          </p>
        ))}
      </div>

      <p className="label-caps text-brand-yellow mt-1.5 flex items-center justify-center gap-1.5 text-[7.5px]">
        <Sparkle className="text-brand-pink w-1.5 shrink-0" />
        247 builders · Build · Hack · Ship · Repeat
        <Sparkle className="text-brand-pink w-1.5 shrink-0" />
      </p>

      <div className="mx-4 mt-2 flex items-center gap-2.5">
        {/* The back's code is the event itself, not the pass — the front
            already carries the personal link, and a badge's reverse is where
            you look for "what is this thing". `hhgoa.com` is 18 characters, so
            it fits a smaller symbol and stays readable at 72px. */}
        <QrCode value={EVENT.site} className="w-18 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <Fingerprint className="text-brand-yellow size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-brand-cream/80 text-[8px] leading-tight">
              This pass is non-transferable.
            </span>
          </p>
          <p className="mt-1 text-[8px]">
            <span className="text-brand-cream">Less noise.</span>{" "}
            <span className="text-brand-pink">More signal.</span>
          </p>
          <Barcode className="text-brand-yellow mt-1.5" />
        </div>
      </div>

      <div className="border-brand-yellow mx-4 mt-auto mb-3 flex items-center justify-center gap-2 rounded-md border-2 px-2 py-1.5">
        <Lotus className="text-brand-pink w-3.5 shrink-0" />
        <span className="font-display text-offset text-brand-pink truncate text-[13px] uppercase">
          Valid Builder Access
        </span>
        <Lotus className="text-brand-pink w-3.5 shrink-0" />
      </div>
    </div>
  );
}
