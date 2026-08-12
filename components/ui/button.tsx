import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The button carries the whole style, so call sites can stay `<Button>`.
 *
 * Three things define it and none of them are colour:
 *
 *  1. **A 2px black rule and zero radius.** Every edge on the site is the same
 *     rule, so a button is a rectangle of colour with the same outline as a
 *     card or an input.
 *  2. **A hard offset shadow, not a blur.** `shadow-brutal` is a second black
 *     rectangle 5px down and right. It is the button's resting height.
 *  3. **A press, not a tint.** Hover slides the face 3px into its own shadow
 *     and shrinks the shadow to match, so the button visibly travels; `active`
 *     seats it flush against the page. A hover that only changes background
 *     does nothing in a flat palette with no gradients to slide.
 *
 * `ghost` and `link` opt out of 1–3 entirely: they are text, and text that
 * casts a shadow and moves under the cursor reads as a mis-styled button.
 */
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "border-brand-ink label-caps border-2 bg-clip-padding select-none",
    "shadow-brutal transition-[transform,box-shadow,background-color,color] duration-150",
    "hover:shadow-brutal-sm hover:translate-x-0.75 hover:translate-y-0.75",
    "active:translate-x-1.25 active:translate-y-1.25 active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-brand-pink",
    // No ring and no `outline-none`: the yellow focus outline in the base layer
    // is already the site's focus treatment, and a soft ring on a hard edge is
    // the one thing that would look borrowed from somewhere else.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        // Black on pink is 5.6:1 — the reason the primary CTA is not white on
        // pink. Yellow on hover because the palette has no darker pink to go to.
        default: "bg-brand-pink text-brand-ink hover:bg-brand-yellow",
        secondary: "bg-brand-yellow text-brand-ink hover:bg-brand-pink",
        // The reference's filter chip: transparent until you touch it.
        outline: "text-brand-cream bg-transparent hover:bg-brand-yellow hover:text-brand-ink",
        ghost:
          "text-brand-cream hover:text-brand-yellow border-transparent shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none active:translate-x-0 active:translate-y-0",
        // Pink is the alarm register (the palette has no red) — see globals.css.
        destructive: "bg-brand-pink text-brand-ink hover:bg-brand-cream",
        link: "text-brand-yellow border-transparent shadow-none underline-offset-4 hover:translate-x-0 hover:translate-y-0 hover:underline hover:shadow-none active:translate-x-0 active:translate-y-0",
      },
      // Chunky by default. A 32px button under a 3.5rem poster headline reads as
      // a link someone forgot to style; the reference's floor is a 48px face.
      size: {
        default: "h-12 px-5 text-[12px]",
        xs: "h-8 px-3 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 px-4 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-14 px-7 text-[13px]",
        icon: "size-12",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
