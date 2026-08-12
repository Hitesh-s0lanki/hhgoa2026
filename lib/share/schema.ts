import { z } from "zod";
import { passIdPattern } from "@/lib/share/pass-id";

/**
 * The wire contract for `POST /api/pass`, shared by the route that validates it
 * and the client that builds it — one definition, so a field renamed on one
 * side fails to compile on the other rather than 400-ing at runtime.
 *
 * Lengths mirror `FIELD_LIMITS` (components/editor/BuilderForm.tsx) and the
 * column widths in `lib/db/schema.ts`. The three have to agree: a value the
 * form allows must fit the card and must fit the column.
 */

/**
 * Image URLs arrive from the browser, so they are input — and they are about to
 * be published as this domain's `og:image`. Left unchecked, anyone could POST a
 * URL pointing anywhere and get `hhgoa.app/share/<id>` to unfurl *their* image
 * under our name, which is a defacement primitive with our brand attached.
 *
 * So a stored URL must be one UploadThing actually issued: `https`, on
 * UploadThing's own hosts, nothing else.
 */
const UPLOADTHING_HOSTS = /(^|\.)(ufs\.sh|utfs\.io)$/;

export const uploadedUrl = z
  .url()
  .max(512)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && UPLOADTHING_HOSTS.test(url.hostname);
  }, "Image URLs must be UploadThing URLs.");

const uploadKey = z.string().max(256).optional();

/** Trims, then treats an emptied field as absent rather than as `""`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

export const createPassSchema = z.object({
  /**
   * Minted by the browser, because the QR code on the card has to encode
   * `/share/<id>` before the card is rasterised — see [[lib/share/pass-id]].
   * Anchored to the exact alphabet and length the generator produces: this is
   * a value from the client that becomes a URL on this domain, so "looks like
   * an id" is not good enough.
   */
  id: z.string().regex(passIdPattern, "Malformed pass id."),

  name: z.string().trim().min(1, "A name is required.").max(28),
  role: optionalText(32),
  stack: optionalText(40),
  title: z.string().trim().min(1).max(24),
  passNumber: z.string().trim().min(1).max(24),

  photoUrl: uploadedUrl.optional(),
  photoKey: uploadKey,

  cardUrl: uploadedUrl,
  cardKey: uploadKey,

  ogUrl: uploadedUrl.optional(),
  ogKey: uploadKey,
});

export type CreatePassInput = z.infer<typeof createPassSchema>;

export type CreatePassResponse = {
  id: string;
  /** `/share/[id]` — the page carrying `og:image`. What X should unfurl. */
  shareUrl: string;
  /**
   * The card image on UploadThing's CDN, publicly readable with no app in
   * front of it. Shown next to the share link, and used *as* the posted link
   * when the deployment has no public origin to point at.
   */
  imageUrl: string;
};

/**
 * One row of "your passes", as `GET /api/passes` returns it.
 *
 * Deliberately not the whole `Pass`: the row also carries `sessionId` and the
 * storage keys, and neither has any business being sent to a browser. This is
 * the projection of it that is safe to render.
 */
export type PassSummary = {
  id: string;
  name: string;
  title: string;
  role: string | null;
  stack: string | null;
  /** The 1200×630 crop where there is one, else the both-faces sheet. */
  thumbnailUrl: string;
  /** The sheet — the full card, front and back. */
  cardUrl: string;
  shareUrl: string;
  /** ISO 8601. Formatted in the browser, which is where the timezone is. */
  createdAt: string;
};

export type PassListResponse = { passes: PassSummary[] };
