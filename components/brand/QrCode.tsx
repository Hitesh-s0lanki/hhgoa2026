import { qrSymbol } from "@/lib/share/qr-symbol";
import { cn } from "@/lib/utils";

/**
 * A real, scannable QR code — the kind a phone camera resolves into a URL.
 *
 * The pass used to carry a hash-shaped stand-in that only *read* as a code.
 * That is fine as artwork and indefensible on a thing people photograph and
 * post: a code on a badge is a promise that it goes somewhere.
 *
 * The geometry is [[qrSymbol]]'s job. What this adds is the two presentation
 * decisions that decide whether it scans:
 *
 *   - **Dark modules on light.** The card's ground is deep green, so the code
 *     gets its own cream plate. An inverted code (light on dark) is legal in
 *     the spec and read reliably by almost nothing — iOS in particular is
 *     inconsistent about it.
 *   - **The quiet zone is drawn, not implied.** The four clear modules come
 *     out of `qrSymbol` inside the viewBox, and the light rect under them is
 *     part of the SVG — so the symbol stays valid wherever it is placed, and
 *     no amount of restyling the plate can eat its margin.
 *
 * Encoding is deterministic, so server and client render identical markup and
 * there is no hydration drift.
 */
export function QrCode({
  value,
  className,
}: {
  /** The URL to encode. Kept short — every character can cost a version. */
  value: string;
  className?: string;
}) {
  const { size, path } = qrSymbol(value);

  return (
    <span
      className={cn(
        "border-brand-yellow bg-brand-cream block overflow-hidden rounded-sm border-2",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        // The modules are axis-aligned squares on a whole-number grid, and
        // antialiasing them greys every module edge at the ~2.5px they occupy
        // on the card — which is exactly the contrast a scanner looks for.
        shapeRendering="crispEdges"
        className="block h-auto w-full"
        role="img"
        // The destination, read out. This is the one thing on the card that
        // exists nowhere else in the text, and it is deliberately not the
        // builder's name: the accessible name of a graphic that appears on
        // every copy of the card should not collide with the form field
        // beside it, and a screen reader cannot scan a code anyway — the URL
        // is the useful part.
        aria-label={`QR code linking to ${value}`}
      >
        <rect width={size} height={size} fill="var(--color-brand-cream)" />
        <path d={path} fill="var(--color-brand-ink)" />
      </svg>
    </span>
  );
}
