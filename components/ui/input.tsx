import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        /*
         * A cream field on the green ground, not a darker well. The style has no
         * depth to recess into — an input reads as writable because it is the
         * one patch of paper on the page, the same way the reference fills its
         * chips and tags rather than outlining them.
         *
         * `text-base` on mobile is deliberate: anything under 16px makes iOS
         * Safari zoom the viewport on focus.
         */
        "border-brand-ink bg-brand-cream text-brand-ink placeholder:text-brand-ink/35 shadow-brutal-sm",
        "focus-visible:shadow-brutal h-12 w-full min-w-0 border-2 px-3 py-2 text-base transition-shadow md:text-[13px]",
        "file:text-brand-ink file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-brand-pink aria-invalid:bg-brand-pink/10",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
