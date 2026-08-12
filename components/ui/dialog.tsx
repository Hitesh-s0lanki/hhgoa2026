"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The modal, in the site's own register.
 *
 * Radix supplies the behaviour (focus trap, scroll lock, escape, aria wiring);
 * everything visual here is the same three moves as the rest of the app — a 2px
 * black rule, zero radius, and a hard offset shadow instead of a blur. The
 * overlay is ink at 70% rather than a frosted panel: a backdrop blur under a
 * hard-edged card reads as a different design system showing through.
 */

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "bg-brand-ink/70 fixed inset-0 z-50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      {/*
       * The scroll lives on the content, not the viewport: the pass is a fixed
       * 19rem card and the details stack under it on a phone, so on a short
       * screen the sheet has to scroll inside its own rule rather than push the
       * close button off the top.
       */}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "border-brand-ink bg-brand-deep shadow-brutal-lg fixed top-1/2 left-1/2 z-50",
          // Tighter gutter and padding on a phone: the pass is a fixed-width
          // card and every rem spent on chrome is a rem it has to scale down by.
          "max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 sm:w-[calc(100%-2rem)]",
          "overflow-y-auto overscroll-contain border-2 p-4 sm:p-6",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "duration-150",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="border-brand-ink bg-brand-yellow text-brand-ink shadow-brutal-sm absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center border-2 transition-transform duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("pr-10", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("mt-6", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-offset text-brand-yellow text-2xl", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-brand-cream/70 mt-2 text-[12px] leading-relaxed", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
