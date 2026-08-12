import Image from "next/image";
import { DottedRule, Lotus } from "@/components/brand/ornaments";
import { GoaHorizon } from "@/components/brand/scenery";
import { GitHubMark, LinkedInMark } from "@/components/site/social-icons";
import { AFFILIATION, BUILDER, EVENT, SHARE_HASHTAG } from "@/lib/site";

const EVENT_LINKS = [
  { href: EVENT.site, label: "hhgoa.com" },
  { href: EVENT.apply, label: "Apply on Devfolio" },
  { href: EVENT.x, label: "@247pmstudio on X" },
  { href: EVENT.telegram, label: "Telegram" },
] as const;

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="label-caps text-brand-yellow mb-3 text-[10px]">{children}</h2>;
}

export function SiteFooter() {
  return (
    <footer className="mt-16">
      {/* The shoreline carries the footer's top rule on both of its edges, so
          the scene reads as a printed band between page and footer rather than
          a picture pasted above a line. */}
      <GoaHorizon className="border-brand-ink border-y-2" />
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="grid gap-9 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/branding/wordmark-tile.png"
                alt=""
                width={256}
                height={256}
                className="border-brand-ink shadow-brutal-sm size-9 border-2"
              />
              <span className="label-caps text-brand-yellow text-[11px]">HH Goa 2026</span>
            </div>
            <p className="text-brand-cream/70 mt-3 text-[11px] leading-relaxed">
              {EVENT.tagline}
              <br />
              {EVENT.dates} · {EVENT.location}
            </p>
          </div>

          <div>
            <ColumnHeading>The event</ColumnHeading>
            <ul className="space-y-0.5">
              {EVENT_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-cream/70 hover:text-brand-yellow inline-flex min-h-8 items-center text-[11px] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ColumnHeading>Built by</ColumnHeading>
            <ul className="space-y-1">
              <li>
                <a
                  href={BUILDER.github}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-cream/70 hover:text-brand-yellow inline-flex min-h-8 items-center gap-2.5 text-[11px] transition-colors"
                >
                  <GitHubMark className="size-4 shrink-0" />
                  GitHub — Hitesh-s0lanki
                </a>
              </li>
              <li>
                <a
                  href={BUILDER.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-cream/70 hover:text-brand-yellow inline-flex min-h-8 items-center gap-2.5 text-[11px] transition-colors"
                >
                  <LinkedInMark className="size-4 shrink-0" />
                  LinkedIn — {BUILDER.name}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-brand-yellow/25 mt-10 flex items-center gap-3">
          <DottedRule className="flex-1" />
          <Lotus className="text-brand-pink w-4 shrink-0" />
          <DottedRule className="flex-1" />
        </div>

        <div className="mt-5 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-brand-cream/45 text-[10px] leading-relaxed">{AFFILIATION}</p>
          <p className="label-caps text-brand-yellow/80 text-[10px] whitespace-nowrap">
            #{SHARE_HASHTAG}
          </p>
        </div>
      </div>
    </footer>
  );
}
