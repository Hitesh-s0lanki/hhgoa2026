"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitHubMark } from "@/components/site/social-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUILDER, EVENT } from "@/lib/site";

/**
 * The site bar. Two destinations and one outbound link — anything more would be
 * navigation for a tool that has exactly one job.
 *
 * No hamburger: a menu that hides two links behind a tap costs more than it
 * saves. Everything survives to 360px; only the year chip drops.
 *
 * The bar sits on `brand-deep` rather than the page green so it reads as a
 * separate sheet laid over the poster instead of a slice of the same field, and
 * the one real action in it — the pass builder — is a button, not a word.
 */

export function SiteHeader() {
  const pathname = usePathname();
  const onAbout = pathname === "/about";

  return (
    // Solid, not translucent: a backdrop blur under a 2px black rule reads as
    // a soft-UI header wearing a hard border. The yellow strip below the rule is
    // the printed edge of the sheet — the same move as the offset shadow, laid flat.
    <header className="border-brand-ink bg-brand-deep after:bg-brand-yellow sticky top-0 z-50 border-b-2 after:absolute after:inset-x-0 after:top-full after:h-0.5">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link
          href="/"
          className="group/mark flex items-center gap-2.5"
          aria-label={`${EVENT.name} home`}
        >
          {/* The tile is a physical object: it rests on its own shadow and gets
              pressed into it on hover, exactly like the buttons do. */}
          <Image
            src="/branding/wordmark-tile.png"
            alt=""
            width={256}
            height={256}
            priority
            className="border-brand-ink shadow-brutal-sm size-9 border-2 transition-transform duration-150 group-hover/mark:translate-x-0.5 group-hover/mark:translate-y-0.5 group-hover/mark:shadow-none"
          />
          <span className="flex items-center gap-2">
            <span className="label-caps text-brand-yellow text-[13px] leading-none">HH Goa</span>
            {/* Pink is the highest-energy colour in the palette and structural
                nowhere else, so the year can carry it without competing. */}
            <span className="label-caps border-brand-ink bg-brand-pink text-brand-ink hidden border-2 px-1.5 py-0.5 text-[9px] leading-none transition-[rotate] duration-200 group-hover/mark:-rotate-6 sm:inline-block">
              2026
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5" aria-label="Main">
          <Link
            href="/about"
            aria-current={onAbout ? "page" : undefined}
            className={cn(
              "label-caps text-[10px] transition-colors",
              // 10px caps give a 30×15 box, under the 24px minimum in WCAG 2.2
              // SC 2.5.8 — and this is standalone navigation, so the "inline
              // text" exemption does not cover it. The padding grows the target
              // without moving the type: the row is centred in a 64px bar, so
              // there is height to spend and nothing shifts.
              "inline-flex min-h-11 items-center px-1",
              // The reference's nav underline: a 2px rule that grows out
              // from the left rather than fading in under the word. Pinned to
              // the text's own baseline rather than the padded box, so the
              // bigger hit area does not drag the rule away from the word.
              "relative after:absolute after:bottom-[calc(50%-1rem)] after:left-1 after:h-0.5 after:w-0 after:bg-current after:transition-[width] after:duration-200 hover:after:w-[calc(100%-0.5rem)]",
              onAbout
                ? "text-brand-yellow after:w-[calc(100%-0.5rem)]"
                : "text-brand-cream/70 hover:text-brand-yellow",
            )}
          >
            About
          </Link>

          {/* The builder is the site's only action, so it is the only thing in
              the bar shaped like one. */}
          <Button asChild size="xs" variant="secondary">
            <Link href="/#generate">Builder Pass</Link>
          </Button>

          <a
            href={BUILDER.github}
            target="_blank"
            rel="noreferrer"
            aria-label="Source on GitHub"
            // A 16px glyph is a 16px target. The flex box around it is the hit
            // area (44px, the comfortable touch size) while the mark stays the
            // size it was drawn for.
            className="text-brand-cream/70 hover:text-brand-yellow hidden size-11 items-center justify-center transition-colors sm:flex"
          >
            <GitHubMark className="size-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
