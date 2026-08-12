import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, ImageUp, Sparkles } from "lucide-react";
import { DottedRule, Lotus, Sparkle } from "@/components/brand/ornaments";
import { Gulls, Sun } from "@/components/brand/scenery";
import { Reveal } from "@/components/site/Reveal";
import { GitHubMark, LinkedInMark } from "@/components/site/social-icons";
import { Button } from "@/components/ui/button";
import { AFFILIATION, BUILDER, EVENT, SHARE_HASHTAG } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "What this frame generator does, what it deliberately does not do, and who built it for HH Goa 2026.",
};

const STEPS = [
  {
    icon: ImageUp,
    title: "Upload one photo",
    body: "Straight from the camera roll. JPG, PNG, or the HEIC an iPhone actually gives you. Portrait, landscape, off-centre — none of it needs cropping first.",
  },
  {
    icon: Sparkles,
    title: "It gets framed",
    body: "Your photo is placed inside the HH Goa 2026 pass — composited, never altered. No filters, no face edits, no generated pixels. The face that goes in is the face that comes out.",
  },
  {
    icon: Download,
    title: "Download and post",
    body: `A real image file, not a screenshot of a web page. Then straight to X with the caption and #${SHARE_HASHTAG} already written.`,
  },
] as const;

const NOT_THIS = [
  "No login, no signup, no email capture — there is nothing between you and the tool.",
  "No upload by default: the photo is read in your browser and never sent to a server.",
  "No AI face edits or background removal. Compositing is faster and never looks uncanny.",
  "No gallery, no profiles, no feed. It makes one image and gets out of the way.",
] as const;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-brand-yellow text-[1.5rem] sm:text-[1.75rem]">{children}</h2>;
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
      <header className="relative text-center">
        {/* The same sky as the landing hero, quieter: one sun, one gull pass.
            Decorative, and clipped by the body's overflow-x rule on phones. */}
        <Sun className="text-brand-yellow/90 absolute -top-6 -right-8 hidden w-20 sm:block" />
        <Gulls className="text-brand-cream/40 absolute top-0 left-[4%] hidden w-12 sm:block" />

        <p className="label-caps text-brand-yellow flex items-center justify-center gap-2 text-[10px]">
          <Sparkle className="animate-twinkle text-brand-pink w-2" />
          About this build
          <Sparkle className="animate-twinkle text-brand-pink w-2 [animation-delay:1.3s]" />
        </p>
        <h1 className="text-offset text-brand-yellow mt-4 text-[clamp(1.9rem,7vw,3rem)] leading-[0.92]">
          One photo in.
          <br />
          One pass out.
        </h1>
        <p className="text-brand-cream/75 mx-auto mt-5 max-w-lg text-[13px] leading-relaxed">
          A single-purpose tool for {EVENT.name} {EVENT.dates.slice(-4)}. It puts your photo inside
          the event&rsquo;s own design and hands you back an image you can post. That is the whole
          product — closer to a one-template Canva than to a social app.
        </p>
      </header>

      <div className="text-brand-yellow/25 my-12 flex items-center gap-3">
        <DottedRule className="flex-1" />
        <Lotus className="text-brand-pink w-4 shrink-0" />
        <DottedRule className="flex-1" />
      </div>

      <Reveal>
        <section>
          <SectionHeading>How it works</SectionHeading>
          <ol className="mt-6 space-y-6">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="border-brand-ink bg-brand-yellow text-brand-ink label-caps shadow-brutal-sm flex size-8 shrink-0 items-center justify-center border-2 text-[12px]"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="label-caps text-brand-yellow flex items-center gap-2 text-[11px]">
                    <Icon className="size-4" aria-hidden="true" />
                    {title}
                  </h3>
                  <p className="text-brand-cream/70 mt-2 text-[12px] leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-14">
          <SectionHeading>What it deliberately isn&rsquo;t</SectionHeading>
          <ul className="mt-6 space-y-3">
            {NOT_THIS.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <Lotus className="text-brand-pink mt-1 w-3.5 shrink-0" />
                <span className="text-brand-cream/70 text-[12px] leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section className="border-brand-ink bg-brand-deep shadow-brutal border-2 p-6">
          <SectionHeading>The event</SectionHeading>
          <p className="text-brand-cream/75 mt-4 text-[12px] leading-relaxed">
            <span className="text-brand-yellow">{EVENT.name}</span> — {EVENT.dates},{" "}
            {EVENT.location}. {EVENT.subline} A four-day build station for 500 builders, run by{" "}
            {EVENT.organizer}.
          </p>
          <p className="label-caps text-brand-cream/60 mt-4 text-[10px]">{EVENT.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-x-5">
            <a
              href={EVENT.site}
              target="_blank"
              rel="noreferrer"
              className="text-brand-yellow/85 hover:text-brand-yellow inline-flex min-h-8 items-center text-[11px] underline-offset-4 hover:underline"
            >
              hhgoa.com
            </a>
            <a
              href={EVENT.apply}
              target="_blank"
              rel="noreferrer"
              className="text-brand-yellow/85 hover:text-brand-yellow inline-flex min-h-8 items-center text-[11px] underline-offset-4 hover:underline"
            >
              Apply on Devfolio
            </a>
            <a
              href={EVENT.x}
              target="_blank"
              rel="noreferrer"
              className="text-brand-yellow/85 hover:text-brand-yellow inline-flex min-h-8 items-center text-[11px] underline-offset-4 hover:underline"
            >
              @247pmstudio
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-14">
          <SectionHeading>Who built it</SectionHeading>
          <p className="text-brand-cream/75 mt-4 text-[12px] leading-relaxed">
            {BUILDER.name}. {AFFILIATION}
          </p>
          <div className="mt-5 flex flex-wrap gap-5">
            <Button asChild variant="outline" size="sm">
              <a href={BUILDER.github} target="_blank" rel="noreferrer">
                <GitHubMark className="size-4" />
                GitHub
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={BUILDER.linkedin} target="_blank" rel="noreferrer">
                <LinkedInMark className="size-4" />
                LinkedIn
              </a>
            </Button>
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14 text-center">
        <Button asChild size="lg">
          <Link href="/#generate">
            Make your frame
            <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </main>
  );
}
