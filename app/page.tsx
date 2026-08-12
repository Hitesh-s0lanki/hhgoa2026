import { Generator } from "@/components/editor/Generator";
import { Hero } from "@/components/marketing/Hero";
import { Marquee } from "@/components/site/Marquee";
import { EVENT, SHARE_HASHTAG } from "@/lib/site";

/**
 * The landing page: pitch, ticker, then the tool, then the footer (in the
 * root layout).
 *
 * The generator sits on the same page rather than behind a route so the trip
 * from "I read the headline" to "my photo is in the frame" is a scroll, not a
 * navigation — which is the whole point of a single-purpose tool. The ticker
 * between them is the fold line: it carries the event's facts, and crossing
 * it is how "the poster" becomes "the tool".
 */

const TICKER = [
  EVENT.tagline,
  EVENT.dates,
  EVENT.location,
  `#${SHARE_HASHTAG}`,
  "500 builders · one rhythm",
] as const;

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Marquee items={TICKER} className="mt-10 md:mt-4" />
      <Generator />
    </main>
  );
}
