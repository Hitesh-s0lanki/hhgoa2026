# T-028 — Performance budget & instrumentation

|                |                                        |
| -------------- | -------------------------------------- |
| **Phase**      | 6 — Ship                               |
| **Status**     | ☐ Not started                          |
| **Estimate**   | 2 h                                    |
| **Depends on** | [T-021](T-021-live-preview-surface.md) |
| **Blocks**     | —                                      |
| **Satisfies**  | NFR-1                                  |

## Why this exists

"Near-instant" is in the brief. Without measurement it is an opinion, and opinions drift — a lazy chunk becomes eager, a dependency creeps into the entry bundle, and nobody notices until it is slow on the device that matters.

This task turns the requirement into numbers that can fail.

## The budget

Measured on a **mid-tier Android with 4× CPU throttling and Slow 4G**, using a 12 MP photo. Not on a MacBook Pro on office wifi — that measurement tells you nothing about the venue.

| Metric                                  | Budget        | Owner                                         |
| --------------------------------------- | ------------- | --------------------------------------------- |
| LCP (landing)                           | ≤ 1.5 s       | [T-026](T-026-landing-and-format-selector.md) |
| Initial JS transfer                     | ≤ 200 KB gzip | this task                                     |
| File selected → bitmap ready (JPEG/PNG) | ≤ 600 ms      | [T-008](T-008-exif-and-downscale.md)          |
| File selected → bitmap ready (HEIC)     | ≤ 2.5 s       | [T-007](T-007-heic-conversion.md)             |
| Bitmap → first preview painted          | ≤ 300 ms      | [T-013](T-013-canvas-renderer-core.md)        |
| Adjustment → repaint                    | ≤ 100 ms      | [T-013](T-013-canvas-renderer-core.md)        |
| Export blob (2160 px)                   | ≤ 500 ms      | [T-019](T-019-export-and-variants.md)         |
| Drag frame rate                         | 60 fps        | [T-012](T-012-manual-crop-control.md)         |
| Lighthouse mobile performance           | ≥ 90          | this task                                     |

## Implementation notes

### Bundle enforcement

The rule is simple and worth stating as a rule: **any dependency over 50 KB must be behind a dynamic `import()`.**

```bash
npx next build   # read the route-level First Load JS in the output
ANALYZE=true npx next build   # with @next/bundle-analyzer for the treemap
```

What must **not** be in the entry chunk:

```
   ✗ heic-to / heic2any          ~1 MB wasm    → dynamic, on HEIC only
   ✗ @mediapipe/tasks-vision     ~1.5 MB       → dynamic, after first paint
   ✗ @aws-sdk/*                  ~500 KB       → server-only, never client
   ✗ zod                         ~60 KB        → only where actually needed
   ✗ the render worker           —             → loaded on first file select
```

The AWS SDK is the one that catches people: import it from a shared `lib/` module used by a client component and it silently ships to the browser. Keep it inside `app/api/share/route.ts`.

A CI check is worth the fifteen minutes:

```js
// scripts/check-bundle.mjs — fail the build if the entry chunk grows
const LIMIT = 200 * 1024;
// read .next/app-build-manifest.json, sum the entry chunks, compare, exit 1
```

### Field instrumentation

Measure the pipeline, not just the page. Web Vitals tell you about the landing; they tell you nothing about how long a HEIC took on a real phone at the venue.

```ts
// lib/perf.ts
const marks = new Map<string, number>();

export function begin(name: string) {
  marks.set(name, performance.now());
}
export function end(name: string) {
  const t0 = marks.get(name);
  if (t0 == null) return;
  marks.delete(name);
  const ms = Math.round(performance.now() - t0);
  if (process.env.NODE_ENV === "development") console.debug(`[perf] ${name} ${ms}ms`);
  track("timing", { name, ms }); // no image data, no field text — NFR-3.5
}
```

Instrument exactly these spans:

```
   ingest.validate     ingest.decode      ingest.heic
   render.first        render.update      export.encode
   share.upload
```

Enough to answer "what is slow for real users" and no more. Every event carries a name and a duration — never a filename, never image bytes, never the user's typed text.

### Funnel events

```
   page_view → upload_started → upload_ok → render_ok
             → download → share_native | share_link
```

These answer the question that actually matters after launch: where do people drop off? If `upload_started` greatly exceeds `upload_ok`, ingest is failing on real devices in a way testing missed — which is exactly the kind of thing you cannot discover any other way.

Cookieless, no PII (NFR-3.5).

### Rendering performance

Three things carry the 60 fps requirement, all already built:

1. Worker + OffscreenCanvas ([T-013](T-013-canvas-renderer-core.md)) — the heavy work is off the main thread.
2. `requestAnimationFrame` coalescing — at most one render per frame no matter how fast state changes.
3. The asset cache — a drag must never re-fetch or re-decode a brand asset.

If the drag stutters, check those three in that order before optimizing anything else.

### Image weight

```
   branding assets total     < 250 KB    (T-003)
   sample previews           < 60 KB each, 2 files
   fonts (2 subset woff2)    < 60 KB total
```

These load on the landing page or the first render, so they are on the critical path in a way a lazy chunk is not.

### Lighthouse CI

```bash
npx lighthouse https://hhgoa.app \
  --preset=perf --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=./lh.json
```

Run it against the deployed preview, not localhost — localhost has no network latency and will always pass.

## Acceptance criteria

- [ ] Initial JS transfer ≤ 200 KB gzip, verified in the build output
- [ ] HEIC decoder is absent from the entry chunk
- [ ] Face detector is absent from the entry chunk
- [ ] `@aws-sdk/*` is absent from the **client** bundle entirely
- [ ] Lighthouse mobile performance ≥ 90 on the deployed preview
- [ ] LCP ≤ 1.5 s on throttled 4G
- [ ] Every budget row above is measured on a real mid-tier device and recorded
- [ ] Drag stays at 60 fps under 4× CPU throttle
- [ ] Timing marks exist for all seven named spans
- [ ] Funnel events fire once each, in order
- [ ] No analytics event contains image data, filenames, or user-typed text
- [ ] A CI check fails the build if the entry chunk exceeds the limit
- [ ] Branding assets total under 250 KB

## Files touched

```
lib/perf.ts
lib/analytics.ts
scripts/check-bundle.mjs
next.config.ts             (bundle analyzer, when ANALYZE=true)
package.json               (scripts)
```

## How to test

Get a real mid-tier Android phone — not an emulator, not a flagship. Connect it to Chrome remote debugging, throttle CPU 4× and network to Slow 4G, and walk the whole flow while watching the performance panel. Record every number in the budget table.

Then do the same on an iPhone via Safari Web Inspector, where the numbers will differ (better HEIC, different canvas performance).

Write the measured numbers into this file. A budget with no recorded measurements is aspirational, and the point of this task is that it stops being aspirational.

## Gotchas

- **Do not measure on your laptop.** A MacBook on office wifi will pass every budget here while the app is unusable at the venue. This is the single most common way performance work becomes theatre.
- **`@aws-sdk` leaking into the client** is easy: one shared import from a `lib/` file that a client component also imports. Check the client bundle explicitly, do not assume.
- **A dynamic `import()` at the top of a component body is not lazy** if the component is in the entry chunk and the import is unconditional. It must be inside a function that runs on demand.
- **Lighthouse on localhost is meaningless** for network metrics.
- **`performance.now()` is fine; `Date.now()` is not** for measuring durations — it is subject to clock adjustments.
- **Do not instrument everything.** Seven spans answer the questions that matter. Fifty spans produce a dashboard nobody reads and a measurable overhead of their own.
- **Privacy applies to telemetry too.** A filename can contain a person's name; a timing event should carry a span name and a number, nothing more.
- **The budget is a gate, not a report.** If a row fails, that is a bug in the owning task, not a note for later.

## References

- [02 — Requirements, NFR-1](../02-requirements.md#nfr-1--performance-near-instant)
- [05 — Tech Stack, bundle budget](../05-tech-stack.md#bundle-budget)
