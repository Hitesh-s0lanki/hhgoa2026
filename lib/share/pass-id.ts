import { customAlphabet } from "nanoid";

/**
 * The share id, minted in the *browser* rather than by the route that stores
 * the row.
 *
 * This looks backwards until you look at the QR code on the card. The QR has to
 * encode the pass's own URL, and the card is rasterised and uploaded *before*
 * `POST /api/pass` is ever called — so an id minted server-side arrives one
 * step too late to be drawn on the thing being saved. The client mints it,
 * draws it, then tells the server which id it just published.
 *
 * That makes the id client-supplied input, which is why the route validates it
 * against [[passIdPattern]] and scopes the write to the caller's session.
 */

/**
 * No `-` or `_`: the id ends up in a URL that people read aloud and paste into
 * chat clients that eat a trailing underscore out of an auto-link. 12 chars of
 * this alphabet is ~62 bits — not a secret, just not enumerable.
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const LENGTH = 12;

export const newPassId = customAlphabet(ALPHABET, LENGTH);

/** The same shape as a regex, for the wire schema. Anchored: this is a check. */
export const passIdPattern = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);
