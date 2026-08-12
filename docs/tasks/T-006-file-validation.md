# T-006 — File validation & guardrails

|                |                                  |
| -------------- | -------------------------------- |
| **Phase**      | 1 — Ingest                       |
| **Status**     | ☐ Not started                    |
| **Estimate**   | 2.5 h                            |
| **Depends on** | [T-005](T-005-photo-uploader.md) |
| **Blocks**     | T-007, T-008                     |
| **Satisfies**  | FR-1.4, FR-1.6, FR-1.7           |

## Why this exists

Two jobs. Keep bad input from reaching the decoder (where failures are cryptic and expensive), and make every rejection a sentence the user can act on. "Unsupported file" is a dead end; "That's not a photo — try a JPG, PNG, or HEIC" is a next step.

Also: this is the layer that makes HEIC work at all, because it identifies files the OS mislabels.

## Scope

**In:** size limits, magic-byte sniffing, dimension checks, typed error codes with user-facing copy.

**Out:** decoding ([T-007](T-007-heic-conversion.md)), the error UI ([T-027](T-027-states-loading-error.md)) — this task produces the error _data_, not the component.

## Implementation notes

### Never trust `file.type`

It comes from the OS and is wrong often enough to matter — empty for HEIC in several Android pickers, occasionally `application/octet-stream`, and trivially spoofable. Read the bytes.

```ts
// lib/image/validate.ts
const MAX_BYTES = 25 * 1024 * 1024;
const MIN_EDGE = 320; // hard reject
const WARN_EDGE = 600; // allow, but warn

const str = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

// HEIF-family brands seen in the wild. iPhones mostly write 'heic' or 'mif1';
// burst/sequence photos can be 'msf1' or 'hevc'.
const HEIF_BRANDS = [
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
];

export type SniffResult =
  "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/avif" | null;

export async function sniff(file: File): Promise<SniffResult> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (b.length < 12) return null;

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && str(b, 1, 3) === "PNG") return "image/png";
  if (str(b, 0, 4) === "RIFF" && str(b, 8, 4) === "WEBP") return "image/webp";

  // ISO-BMFF: [4 bytes size]['ftyp'][4-byte brand]
  if (str(b, 4, 4) === "ftyp") {
    const brand = str(b, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (HEIF_BRANDS.includes(brand)) return "image/heic";
    // Some files declare the real brand in the compatible-brands list instead.
    for (let o = 16; o + 4 <= b.length; o += 4) {
      if (HEIF_BRANDS.includes(str(b, o, 4))) return "image/heic";
    }
  }
  return null;
}
```

The compatible-brands scan is not paranoia — files whose major brand is something generic while `heic` appears later in the list do occur, and missing them means telling an iPhone user their photo is not a photo.

### Typed errors

```ts
// lib/image/errors.ts
export type IngestErrorCode =
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "NOT_AN_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "TOO_SMALL"
  | "DECODE_FAILED";

export const errorCopy: Record<IngestErrorCode, { message: string; hint?: string }> = {
  EMPTY_FILE: { message: "That file looks empty. Try another photo." },
  TOO_LARGE: {
    message: "That photo's a bit big (max 25 MB).",
    hint: "A screenshot or a smaller copy will work.",
  },
  NOT_AN_IMAGE: { message: "That's not a photo.", hint: "JPG, PNG, or HEIC." },
  UNSUPPORTED_FORMAT: { message: "We can't read that photo format." },
  TOO_SMALL: {
    message: "That photo's too small to look good.",
    hint: "600 px or larger works best.",
  },
  DECODE_FAILED: {
    message: "We couldn't open that photo.",
    hint: "On iPhone: Settings → Camera → Formats → Most Compatible.",
  },
};
```

Every code carries copy, and every message names a next action. The `DECODE_FAILED` hint is the genuinely useful one — it tells an iPhone user how to stop the problem happening again.

### Two-stage validation

Some checks are only possible after decode, so validation is split:

```ts
export async function validateFile(file: File) {
  if (file.size === 0) return err("EMPTY_FILE");
  if (file.size > MAX_BYTES) return err("TOO_LARGE");
  const kind = await sniff(file);
  if (!kind) return err("NOT_AN_IMAGE");
  return ok({ kind });
}

export function validateDimensions(w: number, h: number) {
  const edge = Math.min(w, h);
  if (edge < MIN_EDGE) return err("TOO_SMALL");
  return ok({ warn: edge < WARN_EDGE ? ("LOW_RES" as const) : null });
}
```

`validateDimensions` runs after [T-008](T-008-exif-and-downscale.md) produces a bitmap. `LOW_RES` is a warning, not a rejection — the user gets a note and can proceed. Blocking someone's only photo because it is 500 px is worse than a slightly soft result.

### Order matters

Cheapest first. `file.size` is free; reading bytes needs I/O; decoding costs memory and time.

```
   size checks (free)  →  magic bytes (32-byte read)  →  decode  →  dimensions
```

## Acceptance criteria

- [ ] Every fixture in `tests/fixtures/formats/` gets the correct verdict
- [ ] `iphone.heic` sniffs as `image/heic` even with `file.type === ''`
- [ ] `iphone-hdr.heic` also sniffs correctly
- [ ] `corrupt.jpg` passes sniff (valid header) and is caught later as `DECODE_FAILED`
- [ ] `zero.jpg` → `EMPTY_FILE`
- [ ] `notaphoto.pdf` → `NOT_AN_IMAGE`
- [ ] `huge.jpg` (~30 MB) → `TOO_LARGE`
- [ ] `tiny.jpg` (40 px) → `TOO_SMALL` after decode
- [ ] A 500 px photo produces a `LOW_RES` warning but is accepted
- [ ] Every error code has user-facing copy naming a next action
- [ ] Sniffing a 25 MB file reads only the first 32 bytes (verify: it is instant)

## Files touched

```
lib/image/validate.ts
lib/image/errors.ts
tests/unit/validate.test.ts
tests/fixtures/formats/**
```

## How to test

```ts
// tests/unit/validate.test.ts
const cases: Array<[string, SniffResult]> = [
  ["photo.jpg", "image/jpeg"],
  ["photo-progressive.jpg", "image/jpeg"],
  ["photo.png", "image/png"],
  ["photo.webp", "image/webp"],
  ["iphone.heic", "image/heic"],
  ["iphone-hdr.heic", "image/heic"],
  ["notaphoto.pdf", null],
  ["zero.jpg", null],
];

for (const [name, expected] of cases) {
  it(`sniffs ${name}`, async () => {
    const buf = await readFile(`tests/fixtures/formats/${name}`);
    const file = new File([buf], name); // note: no type given, on purpose
    expect(await sniff(file)).toBe(expected);
  });
}
```

Constructing the `File` without a MIME type is deliberate — it proves the sniffing works when the OS gives us nothing, which is the real-world HEIC case.

## Gotchas

- **A rejected HEIC is the worst bug in this project.** It hits iPhone users, who are the majority, and it looks like the app simply does not work. If the brand list is incomplete, that is what happens. Test with photos from more than one iPhone.
- **AVIF also uses `ftyp`.** Distinguish it from HEIC before the brand list, or an AVIF gets routed to the HEIC decoder and fails confusingly.
- **`file.slice()` is lazy.** It does not read anything until `arrayBuffer()` is called, so sniffing a 25 MB file is genuinely cheap. Do not "optimize" this by reading the whole file.
- **25 MB is a judgement call.** iPhone HEICs are 1–4 MB; ProRAW is 25–75 MB. The cap deliberately excludes ProRAW, because decoding it in a browser is not going to end well.
- **Do not reject on `file.name` extension.** Files arrive from share sheets and clipboards with names like `image.tmp` or no name at all.
- **`String.fromCharCode(...subarray)` will blow the stack** on a large array. It is safe here only because we slice 32 bytes. Do not reuse the helper on a full buffer.

## References

- [07 — Image Pipeline, Stage 1](../07-image-pipeline.md#stage-1--validate)
- [ISO/IEC 14496-12 `ftyp` box](https://en.wikipedia.org/wiki/ISO_base_media_file_format)
