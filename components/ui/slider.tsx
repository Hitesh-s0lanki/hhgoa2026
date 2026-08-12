"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": label,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="border-brand-ink bg-brand-deep relative grow overflow-hidden border-2 data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="bg-brand-pink absolute select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          /*
           * The label belongs on the *thumb*, which is where Radix puts
           * `role="slider"`. On the Root it names a group nobody focuses, and
           * the control a screen reader actually lands on is left unnamed —
           * announced as "slider, 1" with no clue what it adjusts.
           *
           * Numbered only when there is more than one, so the common case does
           * not read as "Zoom 1" for a single-thumb control.
           */
          aria-label={label && _values.length > 1 ? `${label} ${index + 1}` : label}
          // A square yellow knob with the same 2px rule, sitting on its own
          // offset shadow — the track is a rail and this is a block on it.
          className="border-brand-ink bg-brand-yellow shadow-brutal-sm relative block size-5 shrink-0 border-2 transition-shadow select-none after:absolute after:-inset-2 hover:shadow-none active:shadow-none disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
