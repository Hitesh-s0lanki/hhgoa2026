"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Link2 } from "lucide-react";
import { Lotus, Sparkle } from "@/components/brand/ornaments";
import { Reveal } from "@/components/site/Reveal";
import type { PassListResponse, PassSummary } from "@/lib/share/schema";

/**
 * Section 3 — the passes this browser has already published.
 *
 * The session cookie has been on every row since `proxy.ts` started minting it;
 * this is the first thing to ask it a question. Without it the id was write-only
 * — stored on every pass and read by nothing, which is precisely the "table with
 * no reader" ADR-004 refused to build.
 *
 * Fetched from the client rather than rendered on the server, for one concrete
 * reason: the landing page is statically prerendered, and a Server Component
 * reading `cookies()` would opt the whole route into per-request rendering. The
 * marketing page would stop being a CDN hit for everyone, to personalise a strip
 * that most visitors will never see. So it stays static and this island fills
 * itself in.
 *
 * It renders **nothing at all** until it has something to show. A first-time
 * visitor should not meet an empty "no passes yet" panel on their way to the
 * one button that matters.
 */

/** Short, and only ever computed in the browser, where the timezone is. */
function whenever(iso: string): string {
  const at = new Date(iso);
  const seconds = Math.round((Date.now() - at.getTime()) / 1000);

  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Pure I/O — it fetches and returns, and never touches state. Null means "could
 * not tell", which the caller treats as "leave the list as it was" rather than
 * as "there are none": a dropped refresh should not blank a list that is
 * already on screen.
 *
 * Silent by design. This section is additive — nobody came to the page to read
 * it, and an error panel where a list would be is worse than no list.
 */
async function fetchPasses(signal?: AbortSignal): Promise<PassSummary[] | null> {
  try {
    const response = await fetch("/api/passes", { cache: "no-store", signal });
    if (!response.ok) return null;
    const body = (await response.json()) as PassListResponse;
    return body.passes ?? [];
  } catch {
    return null;
  }
}

export function PassHistory() {
  const [passes, setPasses] = useState<PassSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const refresh = (signal?: AbortSignal) =>
      void fetchPasses(signal).then((rows) => {
        if (rows) setPasses(rows);
      });

    refresh(controller.signal);

    /*
     * Posting opens X in a new tab, so coming *back* to this one is the exact
     * moment a new pass exists. Refreshing on that beats polling and beats
     * threading a callback out of the share flow — the browser already knows.
     */
    const onReturn = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, []);

  if (passes.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-12">
      <Reveal>
        <header className="text-center">
          <p className="label-caps text-brand-yellow flex items-center justify-center gap-2 text-[10px]">
            <Sparkle className="animate-twinkle text-brand-pink w-2" />
            Already issued
            <Sparkle className="animate-twinkle text-brand-pink w-2 [animation-delay:1.3s]" />
          </p>
          <h2 className="text-offset text-brand-yellow mt-3 text-[clamp(1.6rem,5.5vw,2.25rem)]">
            Your passes.
          </h2>
          {/* Says plainly what "your" means here, because there is no account:
              the tie is a cookie, so clearing it or switching device loses the
              list — while the links themselves keep working forever. */}
          <p className="text-brand-cream/55 mx-auto mt-3 max-w-md text-[11px] leading-relaxed">
            Everything you have posted from this browser. No account — the links keep working even
            after this list forgets them.
          </p>
        </header>
      </Reveal>

      {/* One Reveal around the list, not one per card: `Reveal` renders a div,
          and a div between <ul> and <li> is invalid markup that screen readers
          are entitled to flatten. */}
      <Reveal delay={80}>
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {passes.map((pass) => (
            <li key={pass.id} className="min-w-0">
              <a
                href={pass.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="group border-brand-ink bg-brand-deep shadow-brutal hover:shadow-brutal-sm block h-full border-2 transition-transform duration-150 hover:translate-x-1 hover:translate-y-1"
              >
                {/* The 1200×630 crop, so the aspect is known and the row cannot
                  jump as images arrive. */}
                <span className="border-brand-ink block aspect-1200/630 w-full overflow-hidden border-b-2">
                  {/* Remote PNG from our own renderer; the app runs
                    `images.unoptimized`, so next/image would only add a wrapper.
                    eslint-disable-next-line @next/next/no-img-element */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pass.thumbnailUrl}
                    alt={`${pass.name} — ${pass.title}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </span>

                <span className="block p-3.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-brand-cream min-w-0 flex-1 truncate text-[12px]">
                      {pass.name}
                    </span>
                    <span className="text-brand-cream/40 shrink-0 text-[9px] whitespace-nowrap">
                      {whenever(pass.createdAt)}
                    </span>
                  </span>

                  <span className="mt-2 flex items-center gap-1.5">
                    <Lotus className="text-brand-pink w-2.5 shrink-0" />
                    <span className="font-display text-brand-pink min-w-0 flex-1 truncate text-[13px] uppercase">
                      {pass.title}
                    </span>
                  </span>

                  <span className="border-brand-yellow/15 mt-3 flex items-center gap-1.5 border-t pt-2.5">
                    <Link2 className="text-brand-yellow/60 size-3 shrink-0" aria-hidden="true" />
                    <span className="label-caps text-brand-yellow/70 group-hover:text-brand-yellow flex-1 text-[8px] transition-colors">
                      Open the share page
                    </span>
                    <ArrowUpRight
                      className="text-brand-yellow/60 size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
