# T-033 — Team / combined frame

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Phase**      | 3 — Render engine                                                            |
| **Status**     | ☐ Not started                                                                |
| **Estimate**   | 3 h                                                                          |
| **Depends on** | [T-013](T-013-canvas-renderer-core.md), [T-015](T-015-format-a-pfp-frame.md) |
| **Blocks**     | submission                                                                   |
| **Satisfies**  | FR-3.8 (new)                                                                 |

## Why this exists

The Task #1 card on hhgoa.com says:

> Use that same generator to **bring your teammates into one combined frame**.

This is not in the PDF brief, but it is on the live site and it describes what the _submitted post_ should show. Since the post is half the submission ([14 — Official Brief](../14-official-brief.md#what-to-submit)), this is effectively required.

It is also cheap: the render engine already draws a `photo` layer into a rect. A team frame is _n_ photo layers in one spec.

## Scope

**In:** multi-image state, a `photoIndex` field on the photo layer, 2–4 photo team templates, a multi-file uploader, per-slot crop.

**Out:** real-time collaboration, invite links, accounts — none of that is implied, and all of it would violate FR-6.1.

## Composition

```
   1080 × 1080, same green ground and framing as Format A
   ┌───────────────────────────────────┐
   │ 🌴   HACKER HOUSE · GOA 26    🌴  │
   │    ╭──────────╮ ╭──────────╮      │
   │    │ photo 1  │ │ photo 2  │      │   2-up: side by side
   │    ╰──────────╯ ╰──────────╯      │
   │    ╭──────────╮ ╭──────────╮      │   3-up: 2 top, 1 centered
   │    │ photo 3  │ │ photo 4  │      │   4-up: 2 × 2 grid
   │    ╰──────────╯ ╰──────────╯      │
   │  ✿✿  TEAM NAME · #FrameInGoa  ✿✿  │
   └───────────────────────────────────┘
```

Three specs — `team-2`, `team-3`, `team-4` — selected automatically by how many photos were uploaded. No format picker for this; the count decides.

## Implementation notes

### One declarative extension, no engine special-casing

```ts
// lib/templates/types.ts — add ONE optional field
| { kind: 'photo'; rect: Rect; radius?: Norm; shape?: 'rect' | 'circle';
    ring?: { width: Norm; color: string };
    photoIndex?: number }        // ← defaults to 0
```

```ts
// lib/render/render.ts — the only change
case 'photo': {
  const img = images[layer.photoIndex ?? 0];
  if (!img) break;                    // fewer photos than slots → skip, don't crash
  drawPhoto(ctx, layer, img, transforms[layer.photoIndex ?? 0]!, px);
  break;
}
```

That is the whole engine change. `RenderRequest.image` becomes `images: NormalizedImage[]` and `transform` becomes `transforms: Transform[]`; single-photo templates use index 0 and are unaffected. This is the ADR-003 abstraction paying off — verify it stays this small, and if it does not, the extension is wrong.

### Template

```ts
// lib/templates/team-4.ts
const slot = (i: number, x: Norm, y: Norm): Layer => ({
  kind: "photo",
  photoIndex: i,
  rect: { x, y, w: 0.36, h: 0.36 },
  radius: 0.03,
  ring: { width: 0.008, color: brand.color.accent },
});

export const team4: TemplateSpec = {
  id: "team-4",
  label: "Team (4)",
  size: { w: 1080, h: 1080 },
  background: brand.color.primary,
  fields: ["teamName"],
  layers: [
    { kind: "fill", color: brand.color.primary },
    slot(0, 0.1, 0.22),
    slot(1, 0.54, 0.22),
    slot(2, 0.1, 0.6),
    slot(3, 0.54, 0.6),
    { kind: "image", src: "/branding/palms.png", rect: { x: 0, y: 0, w: 1, h: 1 } },
    { kind: "image", src: "/branding/wordmark.png", rect: { x: 0.2, y: 0.07, w: 0.6, h: 0.09 } },
    {
      kind: "text",
      box: { x: 0.08, y: 0.925, w: 0.84, h: 0.05 },
      token: "teamName",
      font: "display",
      size: 0.038,
      minSize: 0.026,
      color: brand.color.accent,
      align: "center",
      transform: "upper",
      maxLines: 1,
    },
  ],
};
```

### Multi-upload

```tsx
<input
  type="file"
  multiple
  accept={ACCEPT}
  onChange={(e) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    void ingestMany(files);
    e.target.value = "";
  }}
/>
```

`ingestMany` runs the existing [T-009](T-009-ingest-orchestration.md) pipeline per file **sequentially**, not in parallel — four concurrent 12 MP HEIC decodes will exhaust memory on a phone. Sequential also gives honest progress ("2 of 4").

Auto-select the template by count:

```ts
const teamTemplate = { 2: "team-2", 3: "team-3", 4: "team-4" }[images.length];
```

One photo keeps the normal Format A flow — the team mode should not appear until a second photo exists.

### Per-slot crop

Each photo needs its own `Transform`. Tapping a slot selects it, and the existing [T-012](T-012-manual-crop-control.md) control edits `transforms[selectedIndex]`. Show a ring on the selected slot so it is obvious which one the gesture affects.

### Memory

Four full-size bitmaps is the heaviest state in the app. Lower the cap for team mode:

```ts
const MAX_EDGE = images.length > 1 ? 2048 : 4096;
```

A slot is at most 0.36 of a 2160 px export (~780 px), so 2048 is still generous, and it roughly quarters peak memory versus four 4096 px bitmaps.

## Acceptance criteria

- [ ] 2, 3, and 4 photos each render in the correct layout
- [ ] Uploading a 2nd photo switches to team mode automatically
- [ ] Removing photos back to 1 returns to Format A
- [ ] Engine change is limited to `photoIndex` resolution — no per-template branching
- [ ] Single-photo templates are unaffected (index 0 default)
- [ ] Fewer photos than slots skips the slot instead of crashing
- [ ] Each slot has an independent crop transform
- [ ] Tapping a slot selects it; the selection is visible
- [ ] Decoding is sequential, with "n of m" feedback
- [ ] `MAX_EDGE` drops to 2048 in team mode
- [ ] Four 12 MP photos do not crash iOS Safari
- [ ] Team name renders and shrinks/ellipsizes like any text layer
- [ ] Export and share work identically to single-photo mode
- [ ] Mixed aspect ratios across slots all cover correctly

## Files touched

```
lib/templates/types.ts          (photoIndex)
lib/templates/team-2.ts  team-3.ts  team-4.ts
lib/templates/index.ts
lib/render/render.ts            (images[] / transforms[])
lib/types.ts                    (RenderRequest)
lib/image/ingest.ts             (ingestMany)
lib/store.ts                    (images[], transforms[], selectedIndex)
components/uploader/PhotoUploader.tsx   (multiple)
components/editor/SlotSelector.tsx
```

## How to test

Upload four photos of deliberately different aspect ratios — a portrait, a landscape, a square, and a panorama — and confirm every slot covers without distortion and each crops independently.

Then the memory test, on a real iPhone: four 12 MP HEICs in sequence. If the tab reloads, the `MAX_EDGE` reduction is not being applied or bitmaps are leaking ([T-008](T-008-exif-and-downscale.md)).

Finally, produce the actual submission image with real teammate photos — that is the artefact the post needs.

## Gotchas

- **Do not parallelize the decodes.** Four concurrent HEIC decodes is the fastest way to kill a mobile tab, and the WASM decoder is not cheap.
- **Reduce `MAX_EDGE` in team mode.** Four 4096 px bitmaps is ~200 MB of live data.
- **Keep the engine change to one line.** If a team template needs renderer branching, the extension is wrong — express it in the spec instead ([ADR-003](../04-architecture.md#adr-003--templates-are-declarative-data-not-code)).
- **Photos will have wildly different lighting.** Four faces in one frame look mismatched in a way one face never does. A consistent ring and equal slot sizes do most of the work of unifying them.
- **Get consent for teammates' photos** before posting the result publicly. It is their face on a public tweet.
- **Do not build invites or collaboration.** The requirement is one person assembling a combined image, not a multi-user session.

## References

- [14 — Official Brief](../14-official-brief.md#discrepancy-the-website-adds-requirements)
- [13 — Brand Identity](../13-brand-identity.md)
