# T-009 — Ingest orchestration + capability detection

|                |                                                                         |
| -------------- | ----------------------------------------------------------------------- |
| **Phase**      | 1 — Ingest                                                              |
| **Status**     | ☐ Not started                                                           |
| **Estimate**   | 2 h                                                                     |
| **Depends on** | [T-007](T-007-heic-conversion.md), [T-008](T-008-exif-and-downscale.md) |
| **Blocks**     | T-010, T-027                                                            |
| **Satisfies**  | FR-1.7, FR-6.4                                                          |

## Why this exists

Validate, decode, convert, and normalize are four modules. Something has to sequence them, own the state transitions, decide when to show feedback, and turn every possible failure into a recoverable error. Left implicit, this logic scatters across the uploader component and becomes untestable — which is exactly how the twelve unhappy paths in [03](../03-user-flows.md#unhappy-paths) turn into emergent behaviour instead of designed behaviour.

This task also centralizes feature detection, so there is exactly one place that knows what this browser can do.

## Scope

**In:** the `ingest()` orchestrator, the state machine transitions, `lib/capabilities.ts`, and the store wiring.

**Out:** the error UI ([T-027](T-027-states-loading-error.md)), rendering ([T-013](T-013-canvas-renderer-core.md)).

## Implementation notes

### The orchestrator

```ts
// lib/image/ingest.ts
import { validateFile, validateDimensions } from "./validate";
import { decodeToBitmap } from "./decode";
import { normalize } from "./normalize";
import { IngestError } from "./errors";

export type IngestResult =
  | { ok: true; image: NormalizedImage; warn: "LOW_RES" | null }
  | { ok: false; code: IngestErrorCode };

export async function ingest(
  file: File,
  hooks: { onSlow?: () => void; onStage?: (s: "validating" | "decoding") => void } = {},
): Promise<IngestResult> {
  hooks.onStage?.("validating");
  const v = await validateFile(file);
  if (!v.ok) return { ok: false, code: v.code };

  hooks.onStage?.("decoding");
  const slowTimer = setTimeout(() => hooks.onSlow?.(), 400);
  try {
    const image = await normalize(file); // decode + orient + cap
    const d = validateDimensions(image.width, image.height);
    if (!d.ok) {
      image.bitmap.close();
      return { ok: false, code: d.code };
    }
    return { ok: true, image, warn: d.warn };
  } catch (e) {
    return { ok: false, code: e instanceof IngestError ? e.code : "DECODE_FAILED" };
  } finally {
    clearTimeout(slowTimer);
  }
}
```

Three properties worth noting:

- **It never throws.** Every outcome is a value. Callers cannot forget a `catch`, and the UI has a total function from result to state.
- **It closes the bitmap on the late-rejection path.** A photo that decodes but is too small must not leak.
- **The slow-feedback timer lives here**, not in the decoder, so the 400 ms rule is applied once and consistently.

### Wiring to the state machine

```ts
// lib/store.ts
async function selectFile(file: File) {
  const prev = get().image;
  set({ status: "validating", error: null });

  const result = await ingest(file, {
    onStage: (s) => set({ status: s }),
    onSlow: () => set({ status: "decoding", slow: true }),
  });

  if (!result.ok) {
    set({ status: "error", error: { code: result.code, ...errorCopy[result.code] }, slow: false });
    return; // ← prev image intentionally preserved
  }

  prev?.bitmap.close(); // only replace after success
  set({
    status: "ready",
    slow: false,
    image: result.image,
    transform: { scale: 1, offsetX: 0, offsetY: 0 }, // reset crop for a new photo
    warn: result.warn,
  });
}
```

Two decisions embedded here that are easy to get wrong:

1. **Keep the previous image on failure.** If someone has a working preview and then picks a PDF by mistake, throwing away their good result as well is gratuitous. Show the error, keep the preview.
2. **Reset `transform` on success.** A crop tuned for a portrait makes no sense applied to a new landscape photo.

### Capability detection, in one place

```ts
// lib/capabilities.ts
export const caps = {
  offscreenCanvas: typeof OffscreenCanvas !== "undefined",
  createImageBitmapOrientation: (() => {
    try {
      return "imageOrientation" in ({} as ImageBitmapOptions) || true;
    } catch {
      return false;
    }
  })(),
  webShareFiles: typeof navigator !== "undefined" && "canShare" in navigator,
  downloadAttr: typeof document !== "undefined" && "download" in document.createElement("a"),
  clipboardWrite: typeof navigator !== "undefined" && !!navigator.clipboard?.writeText,
  touch:
    typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches,
  inAppBrowser:
    typeof navigator !== "undefined" &&
    /FBAN|FBAV|Instagram|Twitter|Line|MicroMessenger/i.test(navigator.userAgent),
} as const;
```

Rules:

- Every detect is **behavioural**, not user-agent-based, except `inAppBrowser` — where UA sniffing is genuinely the only signal available, and the consequence of a false positive is merely an extra hint being shown.
- Guard every `typeof` for SSR. This module gets imported into components that render on the server.
- No component may re-implement a detect inline. One place, so a wrong assumption is fixed once.

### Status flow

```
   idle ──selectFile──► validating ──ok──► decoding ──ok──► ready
                            │                  │
                          fail               fail
                            └────────► error ◄─┘
                                        │
                                    selectFile
                                        └──► validating (retry)
```

`error` is never terminal. There is always a path back, which is FR-6.4 expressed as a state machine property rather than a UI promise.

## Acceptance criteria

- [ ] `ingest()` never throws — every path returns a result object
- [ ] Every `IngestErrorCode` is reachable and produces its copy
- [ ] A failed ingest leaves any previously-loaded image intact
- [ ] A successful ingest closes the previous bitmap
- [ ] `transform` resets on a new photo
- [ ] The slow-feedback hook fires only after 400 ms
- [ ] The late `TOO_SMALL` rejection closes the decoded bitmap (no leak)
- [ ] `lib/capabilities.ts` imports cleanly during SSR with no `window`/`navigator` errors
- [ ] Every capability is detected by behaviour, not UA (except `inAppBrowser`, documented)
- [ ] `status` is a single union field; no parallel booleans anywhere in the store

## Files touched

```
lib/image/ingest.ts
lib/capabilities.ts
lib/store.ts
```

## How to test

Unit-test `ingest()` against every fixture, asserting the exact result shape. It is a pure-ish async function over a `File`, so this is straightforward in Vitest with `node:fs` reads — no DOM needed beyond a `createImageBitmap` polyfill or a thin stub.

Then, in the browser, walk the state machine manually: good photo → PDF → good photo → 0-byte file → good photo. The preview should survive every failure, and no error state should require a reload.

## Gotchas

- **Do not `set()` the image before validating dimensions.** A too-small photo would flash on screen and then be rejected, which looks like a glitch.
- **`finally` with `clearTimeout` matters.** Miss it and a stale "Converting…" appears 400 ms after a fast success.
- **Race on rapid re-selection.** If a user picks two files quickly, the first ingest can resolve _after_ the second and overwrite it. Guard with a monotonically increasing token:
  ```ts
  const token = ++get().ingestToken;
  // … after await …
  if (token !== get().ingestToken) {
    result.image?.bitmap.close();
    return;
  }
  ```
  Easy to skip and genuinely confusing to debug — the symptom is "sometimes the wrong photo appears".
- **SSR will bite you.** `matchMedia` and `navigator` do not exist during the server render. A single unguarded access at module scope breaks the whole page build.
- **Do not let `caps` be evaluated at import time on the server and then reused on the client.** Because `capabilities.ts` is evaluated per-environment this is fine as written, but be careful if you ever memoize it into a shared module-level cache used by a server component.

## References

- [03 — User Flows, state machine](../03-user-flows.md#state-machine)
- [09 — Project Structure, the store](../09-project-structure.md#the-store)
