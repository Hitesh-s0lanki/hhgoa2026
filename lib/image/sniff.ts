/**
 * What a file actually is, read from its first bytes (T-006).
 *
 * `File.type` is whatever the OS guessed from the extension, and on the one
 * path this app cares about most it guesses wrong: iOS hands a HEIC picked
 * through Files an empty MIME type, and a `.jpg` renamed from `.exe` claims to
 * be an image. The container's own magic bytes are the only thing that cannot
 * be renamed, so the accept check reads those instead of taking the browser's
 * word for it.
 *
 * Sixteen bytes is enough for every signature below, and `Blob.slice()` reads
 * only that much — a 25 MB photo is never pulled into memory to be classified.
 */

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "heic" | "unknown";

/** How much of the file the longest signature below needs. */
const HEADER_BYTES = 16;

/**
 * ISO-BMFF brands that mean "this box holds a still image we can decode".
 *
 * `mif1`/`msf1` are the generic HEIF brands an iPhone writes for some captures
 * (notably burst and portrait-mode frames), so matching only `heic` misses real
 * camera-roll files. AVIF shares the container and is included because Chrome
 * and Safari both decode it natively — it costs nothing to accept.
 */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Classify by content. Never throws — an unreadable blob is `"unknown"`. */
export async function sniffImage(blob: Blob): Promise<ImageKind> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer());
  } catch {
    return "unknown";
  }

  if (bytes.length < 12) return "unknown";

  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, PNG)) return "png";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";

  // RIFF....WEBP — the four bytes between are the chunk length, not a marker.
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";

  // ISO base media: [4-byte box size]["ftyp"][4-byte major brand].
  if (ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 12))) return "heic";

  return "unknown";
}

/** Everything the generator will accept. GIF is decodable but not a portrait. */
export const SUPPORTED_KINDS: readonly ImageKind[] = ["jpeg", "png", "webp", "heic"];

export function isSupportedKind(kind: ImageKind): boolean {
  return SUPPORTED_KINDS.includes(kind);
}
