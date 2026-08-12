import { Sparkle } from "@/components/brand/ornaments";
import { cn } from "@/lib/utils";

/**
 * The ticker: a yellow band of black mono caps scrolling the event's facts —
 * the poster-wall move for a brand that is all hard edges. Two identical
 * tracks each slide their own width, so the loop never shows a seam; hovering
 * anywhere holds the band still so it can actually be read.
 *
 * Screen readers get the items once, as a static sentence. The scrolling
 * copies are `aria-hidden` — the same text announced twice, mid-slide, is
 * noise.
 */
export function Marquee({ items, className }: { items: readonly string[]; className?: string }) {
  const track = (
    <div className="animate-marquee flex w-max shrink-0 items-center group-hover:[animation-play-state:paused]">
      {/* Three repeats per track keep the track wider than any viewport the
          layout supports, which is what hides the wrap-around. */}
      {Array.from({ length: 3 }, () => items)
        .flat()
        .map((item, index) => (
          <span key={index} className="flex items-center">
            <span className="px-5 whitespace-nowrap">{item}</span>
            <Sparkle className="text-brand-pink w-2.5 shrink-0" />
          </span>
        ))}
    </div>
  );

  return (
    <div
      className={cn(
        "group border-brand-ink bg-brand-yellow text-brand-ink label-caps overflow-hidden border-y-2 py-3 text-[11px]",
        className,
      )}
    >
      <p className="sr-only">{items.join(" · ")}</p>
      <div aria-hidden="true" className="flex">
        {track}
        {track}
      </div>
    </div>
  );
}
