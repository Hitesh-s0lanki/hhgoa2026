import qrcode from "qrcode-generator";

/**
 * The QR symbol, as geometry — everything about the code that is not styling.
 *
 * Kept apart from the component that draws it because this is the half that can
 * be *proved*: `tests/unit/qr.test.ts` rasterises what comes out of here and
 * decodes it with a real scanner implementation, which is the only way to know
 * a QR code works without pointing a phone at it.
 */

/**
 * Error correction level M — ~15% of the symbol can be lost and still decode.
 * For the URLs this card carries it is free: L and M land on the same symbol
 * version, so the weaker level would buy no extra pixels per module and only
 * lose resilience to a thumb over the corner of a printed pass.
 */
const ECC = "M";

/** The spec's four-module margin. Below it, scanners start missing the code. */
const QUIET_ZONE = 4;

/** `0` lets the encoder pick the smallest symbol version the data fits in. */
const AUTO_VERSION = 0;

export type QrSymbol = {
  /** Module count including the quiet zone — the SVG's viewBox is this square. */
  size: number;
  /** Every dark module as one unit square, in a single path. */
  path: string;
};

/**
 * One path rather than one `<rect>` per module: the card is exported through a
 * DOM-to-image pass that serializes every node it walks, and a version-3 symbol
 * is ~400 modules. One node instead of four hundred, twice per card, on every
 * capture.
 */
export function qrSymbol(value: string): QrSymbol {
  const qr = qrcode(AUTO_VERSION, ECC);
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  let path = "";

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }

  return { size: count + QUIET_ZONE * 2, path };
}
