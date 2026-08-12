"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // `--popover` was never declared in the theme — the toast was resolving to
      // an empty custom property and rendering on sonner's own default. These
      // are the brand equivalents: a cream card, black rule, square.
      style={
        {
          "--normal-bg": "var(--color-brand-cream)",
          "--normal-text": "var(--color-brand-ink)",
          "--normal-border": "var(--color-brand-ink)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast border-2 shadow-brutal font-body",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
