import Link from "next/link";
import { ArrowRight, Crop, ShieldCheck, Zap } from "lucide-react";
import { Sparkle, Waves } from "@/components/brand/ornaments";
import { Gulls, PalmTree, Sun } from "@/components/brand/scenery";
import { PassPreview } from "@/components/editor/PassPreview";
import { Button } from "@/components/ui/button";
import { EVENT } from "@/lib/site";

/**
 * Section 1 — the pitch.
 *
 * Three promises, because they are the three things a person actually worries
 * about before handing a photo to a website: will it work with *my* photo, how
 * long will it take, and where does my face end up. Each one is a requirement
 * elsewhere in the docs (FR-2.5, NFR-1, NFR-3.1), not a marketing claim.
 */

const PROMISES = [
  { icon: Crop, text: "Any photo works — portrait, landscape, HEIC. Never crop it first." },
  { icon: Zap, text: "Seconds from upload to a shareable image. Not a loading screen." },
  // Was "your photo stays on your device" — that stopped being true when the
  // card started being uploaded so a posted link has something to unfurl. A
  // privacy promise the product does not keep is worse than no promise.
  { icon: ShieldCheck, text: "No signup, no account. Nothing is posted without you." },
] as const;

export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-4xl items-center gap-12 px-5 pt-12 pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:pt-20 md:pb-10">
      <div className="relative text-center md:text-left">
        {/* A pair of gulls over the headline — the one piece of sky the text
            column gets. Decorative, so it hides rather than squeezes at 360px. */}
        <Gulls className="text-brand-cream/40 absolute -top-6 right-[6%] hidden w-14 sm:block md:right-[12%]" />

        <p className="label-caps text-brand-yellow flex items-center justify-center gap-2 text-[10px] md:justify-start">
          <Sparkle className="animate-twinkle text-brand-pink w-2" />
          {EVENT.location} · {EVENT.dates}
          <Sparkle className="animate-twinkle text-brand-pink w-2 [animation-delay:1.3s]" />
        </p>

        {/* Bowlby is a wide face where the old serif was condensed, so the same
            headline needs roughly a third less size to clear a 390 px screen —
            "YOURSELF" is the line that sets the ceiling. Family, caps and
            leading come from the h1 rule in globals.css. */}
        {/* The floor was 2.1rem, which is wider than a 320px screen can hold:
            Bowlby is a very wide face, and at 33.6px the word "YOURSELF" alone
            set the column's min-content width to 304px — dragging the whole
            grid past the viewport and giving the page a horizontal scroll.
            8.5vw keeps the size on real phones and lets the smallest ones
            shrink instead of overflowing. */}
        <h1 className="text-offset text-brand-yellow mt-4 text-[clamp(1.7rem,8.5vw,3.6rem)] leading-[0.9]">
          Frame yourself for Goa.
        </h1>

        <p className="text-brand-cream/80 mx-auto mt-5 max-w-md text-[13px] leading-relaxed md:mx-0">
          Upload one photo and get an HH Goa 2026 builder pass back — yours to download and post
          with <span className="text-brand-yellow">#FrameInGoa</span>.
        </p>

        {/* `gap-5` rather than `gap-3`: the buttons carry a 5px offset shadow
            now, so a 12px gutter puts the primary's shadow under the secondary. */}
        <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center md:justify-start">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/#generate">
              Make your frame
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/about">How it works</Link>
          </Button>
        </div>

        <ul className="mx-auto mt-9 max-w-md space-y-3 text-left md:mx-0">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <Icon className="text-brand-yellow mt-px size-4 shrink-0" aria-hidden="true" />
              <span className="text-brand-cream/70 text-[12px] leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Decorative: the live one lives in the generator section below. The tilt
          is the reference's move for anything that should read as a physical
          object dropped on the page rather than a panel in a layout — and the
          scenery behind it makes the drop point a beach. The whole scene bobs
          as one piece; hovering straightens the card like picking it up. */}
      {/*
       * `min-w-0`: this is the grid *item*, and a grid track sized `auto` takes
       * its minimum from the item's min-content — which is the card's fixed
       * 304px. On a 320px screen that sized the whole single-column track to
       * 304px, and because grid items stretch, it dragged the *text* column out
       * with it: the headline, the body copy and both buttons were all being
       * laid out 4px past the section's own padding and clipped. The card
       * scales to fit now, so letting the track shrink costs nothing.
       */}
      <div className="relative min-w-0 justify-self-center" aria-hidden="true">
        <Sun className="text-brand-yellow absolute -top-12 -right-10 w-28 sm:-right-14 sm:w-32" />
        <PalmTree className="animate-sway text-brand-deep absolute -bottom-2 -left-12 w-28 origin-bottom sm:-left-16 sm:w-32" />
        <Waves className="text-brand-cream/30 absolute -right-10 -bottom-7 w-24" />

        {/* Inert (`interactive={false}`): this copy sits in an aria-hidden
            scene, and a focusable flip control inside aria-hidden is a trap.
            The card people actually handle is the one in the generator. */}
        <div className="animate-bob relative">
          <PassPreview
            interactive={false}
            className="rotate-2 transition-[rotate] duration-300 hover:rotate-0"
          />
        </div>
      </div>
    </section>
  );
}
