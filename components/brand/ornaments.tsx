/**
 * The event's recurring marks, drawn as inline SVG.
 *
 * These are the cues that make a surface read as *this* event rather than a
 * dark-green page with a logo on it: the lotus, the wave rule, the four-point
 * sparkle, the dotted hairline. All are decorative, so every one is
 * `aria-hidden` and carries no accessible name.
 *
 * Drawn rather than shipped: the source assets on hhgoa.com are 2–3 MB PNGs,
 * and each of these is a few hundred bytes of markup. Photographic frame
 * overlays (palms, flower band) still come from T-003.
 */

type MarkProps = { className?: string };

/**
 * Pink petals, yellow heart — the footer flower, reduced to its essentials.
 * Five petals, because at 16 px three read as a crown and seven read as mush.
 * The right half is the left half mirrored, so the silhouette stays symmetric.
 */
export function Lotus({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 14" aria-hidden="true" focusable="false" className={className}>
      <g fill="currentColor">
        <path d="M12 .5c1.7 2.9 2.1 5.8 0 8.6-2.1-2.8-1.7-5.7 0-8.6Z" />
        <g>
          <path d="M11.4 9.4C8.5 8.9 6.2 7 4.9 3.9c3 .3 5.4 2 6.5 5.5Z" />
          <path d="M11.2 10.3C8.4 11 5.3 10.4 2.5 8.3c2.8-1.3 6-.9 8.7 2Z" />
        </g>
        <g transform="matrix(-1 0 0 1 24 0)">
          <path d="M11.4 9.4C8.5 8.9 6.2 7 4.9 3.9c3 .3 5.4 2 6.5 5.5Z" />
          <path d="M11.2 10.3C8.4 11 5.3 10.4 2.5 8.3c2.8-1.3 6-.9 8.7 2Z" />
        </g>
      </g>
      <path
        d="M12 8.2c1.9 0 3.4 1.3 3.4 2.9H8.6c0-1.6 1.5-2.9 3.4-2.9Z"
        fill="var(--color-brand-yellow)"
      />
    </svg>
  );
}

/** Three line-art swells. The sea, at the resolution of a signature. */
export function Waves({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 64 18" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 4c4-3.2 8-3.2 12 0s8 3.2 12 0 8-3.2 12 0 8 3.2 12 0 8-3.2 12 0" />
        <path d="M2 10c4-3.2 8-3.2 12 0s8 3.2 12 0 8-3.2 12 0 8 3.2 12 0 8-3.2 12 0" />
        <path d="M2 16c4-3.2 8-3.2 12 0s8 3.2 12 0 8-3.2 12 0 8 3.2 12 0 8-3.2 12 0" />
      </g>
    </svg>
  );
}

/** The four-point star used as a separator throughout the event's collateral. */
export function Sparkle({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M6 0c.5 3.4 2.1 5 5.5 6-3.4 1-5 2.6-5.5 6-.5-3.4-2.1-5-5.5-6C3.9 5 5.5 3.4 6 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Head and shoulders, occupying the photo well until a real photo does.
 * Deliberately low-contrast: it is a hint about what goes here, not artwork.
 */
export function SubjectSilhouette({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <g fill="currentColor">
        <circle cx="32" cy="24" r="12" />
        <path d="M32 40c11 0 20 7.6 20 17v7H12v-7c0-9.4 9-17 20-17Z" />
      </g>
    </svg>
  );
}

/** A dotted hairline. The event's collateral rules everything off with these. */
export function DottedRule({ className }: MarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`block h-px bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-size-[6px_1px] bg-repeat-x ${className ?? ""}`}
    />
  );
}
