"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-in reveal: a block rises 20px into place the first time it enters
 * the viewport. One-shot — the observer disconnects after firing, so nothing
 * re-animates on the way back up.
 *
 * Progressive enhancement, in the safe direction: the server renders content
 * *visible*, and the effect only hides it (a) after JS is running, (b) when
 * the block is genuinely below the fold, and (c) when the user has not asked
 * for reduced motion. No JS, old browser, or reduced motion all degrade to
 * "the page is simply there" — never to blank sections.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger, in ms — applied to the transition, not the observer. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"resting" | "hidden" | "shown">("resting");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen at mount (top of page, anchor jump): stay resting, or
    // the visitor watches the content they were already reading blink.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay && state !== "resting" ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out",
        state === "hidden" && "translate-y-5 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
