"use client";

import { PassActions } from "@/components/actions/PassActions";
import { PassPreview, type PassFields } from "@/components/editor/PassPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { usePassShare } from "@/lib/share/use-pass-share";

/**
 * The pass, presented as a finished thing.
 *
 * The section below it is a workbench — a compact panel of controls with a
 * thumbnail-sized preview. This is the other half of that trade: pressing
 * *Generate* lifts the card out of the page at full size, on its own ground,
 * where the card itself carries every value it was built from — so a typo is
 * catchable before anyone posts it.
 *
 * Download and Share live here and are real: the card that appears above them
 * is the same DOM that gets rasterised into the PNG they produce, which is what
 * makes "the preview is the output" (FR-3.6) true by construction rather than
 * by two implementations agreeing.
 */

export function PassDialog({
  open,
  onOpenChange,
  fields,
  photoUrl,
  shareId,
  share,
  canExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: PassFields;
  photoUrl?: string | null;
  /** So the dialog shows the same QR code the export will carry. */
  shareId?: string | null;
  share: ReturnType<typeof usePassShare>;
  /** False until the pass has a name — the one field the card cannot invent. */
  canExport: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" aria-describedby="pass-dialog-description">
        <DialogHeader>
          <DialogTitle>Your pass.</DialogTitle>
          <DialogDescription id="pass-dialog-description">
            Check the details, then download it or post it — close to keep editing.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex justify-center">
          <PassPreview fields={fields} photoUrl={photoUrl} shareId={shareId} />
        </div>

        <DialogFooter>
          <PassActions
            share={share}
            disabled={!canExport}
            disabledReason="Add your name to download or post your pass."
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
