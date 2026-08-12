import { Sparkle, Waves } from "@/components/brand/ornaments";
import { cn } from "@/lib/utils";

/**
 * Goa, drawn flat — the scenery that turns the green ground into a place.
 *
 * Same contract as ornaments.tsx: inline SVG, brand colours only, everything
 * `aria-hidden`. These are bigger set pieces (a sun, a palm, a shoreline)
 * where the ornaments are punctuation, but the rules hold: flat fills, no
 * gradients, hard edges. Motion comes from the `animate-*` utilities in
 * globals.css and dies wholesale under `prefers-reduced-motion`.
 */

type MarkProps = { className?: string };

/**
 * The sun from the event's poster: a yellow disc wearing a black rule, with a
 * crown of rays that turns once every 40 seconds — slow enough to read as
 * shimmer, not as a spinner. The rays sit in their own group so the rotation
 * never moves the disc.
 */
export function Sun({ className }: MarkProps) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false" className={className}>
      <g className="animate-ray-turn origin-center">
        {rays.map((angle) => (
          <path
            key={angle}
            d="M56 4 L60.5 20 L51.5 20 Z"
            fill="currentColor"
            transform={`rotate(${angle} 56 56)`}
          />
        ))}
      </g>
      <circle
        cx="56"
        cy="56"
        r="26"
        fill="currentColor"
        stroke="var(--color-brand-ink)"
        strokeWidth="3"
      />
    </svg>
  );
}

/**
 * A coconut palm as a single-colour silhouette: six fronds and a leaning
 * trunk. One `currentColor` so a caller can set it as deep-green scenery or
 * an ink cutout. Sway it with `animate-sway origin-bottom` — the keyframes
 * rotate around the base, so the trunk bends and the roots stay put.
 */
export function PalmTree({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 72 88" aria-hidden="true" focusable="false" className={className}>
      <g fill="currentColor">
        {/* Trunk: tapered, leaning into the fronds. */}
        <path d="M27 88 C30 64 33 46 40 28 L46 30 C38 48 36 64 37 88 Z" />
        {/* Fronds, clockwise from upper-left. */}
        <path d="M43 28 C36 15 24 9 11 11 C22 15 33 21 41 30 Z" />
        <path d="M43 27 C42 17 44 8 51 3 C47 11 46 19 46 28 Z" />
        <path d="M43 28 C50 15 61 10 70 14 C60 17 50 23 45 31 Z" />
        <path d="M43 29 C54 24 65 26 71 33 C61 32 51 33 45 34 Z" />
        <path d="M43 29 C32 24 18 24 7 31 C19 32 32 33 41 34 Z" />
        <path d="M42 30 C34 34 28 42 26 53 C32 45 38 38 44 34 Z" />
        <path d="M44 30 C52 34 58 42 60 53 C54 45 48 38 43 34 Z" />
      </g>
    </svg>
  );
}

/** Two-stroke gulls, the way every postcard draws them. Three, receding. */
export function Gulls({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 64 26" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 14 C6 8 11 8 13 12 C15 8 20 8 24 14" />
        <g transform="translate(32 2) scale(0.75)">
          <path d="M2 14 C6 8 11 8 13 12 C15 8 20 8 24 14" />
        </g>
        <g transform="translate(46 12) scale(0.55)">
          <path d="M2 14 C6 8 11 8 13 12 C15 8 20 8 24 14" />
        </g>
      </g>
    </svg>
  );
}

/**
 * An endless drifting sea: two identical tracks, each sliding its own width,
 * so the second is always entering as the first leaves. The marquee trick,
 * pointed at water.
 */
export function WaveBand({ className }: MarkProps) {
  const track = (
    <div className="animate-drift flex w-max shrink-0">
      {Array.from({ length: 24 }, (_, i) => (
        <Waves key={i} className="w-24 shrink-0" />
      ))}
    </div>
  );
  return (
    <div aria-hidden="true" className={cn("flex overflow-hidden", className)}>
      {track}
      {track}
    </div>
  );
}

/**
 * The shoreline: sun low over a drifting sea, palms leaning in from the
 * wings, gulls overhead. The footer's establishing shot, and the one place
 * the scenery assembles into a scene rather than punctuating a layout.
 *
 * The sun's disc is deliberately clipped by the container so it reads as
 * setting into the band, not pasted onto it.
 */
export function GoaHorizon({ className }: MarkProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-brand-deep relative h-32 overflow-hidden sm:h-36", className)}
    >
      <Sun className="text-brand-yellow absolute -bottom-9 left-1/2 w-32 -translate-x-1/2 sm:w-36" />

      <Gulls className="text-brand-cream/50 absolute top-5 left-[16%] w-12" />
      <Gulls className="text-brand-cream/35 absolute top-9 right-[18%] w-9 -scale-x-100" />

      <Sparkle className="animate-twinkle text-brand-pink absolute top-6 left-[38%] w-2" />
      <Sparkle className="animate-twinkle text-brand-yellow absolute top-10 right-[34%] w-1.5 [animation-delay:0.9s]" />
      <Sparkle className="animate-twinkle text-brand-cream/70 absolute top-4 right-[8%] w-2 [animation-delay:1.6s]" />

      <PalmTree className="animate-sway text-brand-ink/85 absolute -bottom-1 -left-3 w-24 origin-bottom sm:left-[4%] sm:w-28" />
      <PalmTree className="animate-sway text-brand-ink/85 absolute -right-3 -bottom-1 w-20 origin-bottom -scale-x-100 [animation-delay:1.2s] sm:right-[4%] sm:w-24" />

      <WaveBand className="text-brand-cream/30 absolute inset-x-0 bottom-0 h-6" />
    </div>
  );
}
