# 03 — User Flows

Screen by screen, including the paths that go wrong. Wireframes are intentionally crude — the visual design comes from the brand kit ([T-003](tasks/T-003-brand-asset-intake.md)).

---

## The happy path (5 steps)

```
   1 LAND ──► 2 UPLOAD ──► 3 ADJUST ──► 4 GET ──► 5 SHARE
     │           │            │           │          │
   no login   HEIC ok     optional     real PNG   X caption
                          (auto-fit                prefilled
                           is good)
```

Step 3 is skippable by design. A user who accepts the automatic crop goes from land to download in **two taps**.

---

## Step 1 — Landing

```
   ┌──────────────────────────────────────┐
   │                                      │
   │            HH GOA 2026               │
   │                                      │
   │       Frame yourself for Goa.        │
   │                                      │
   │   ┌──────────────────────────────┐   │
   │   │                              │   │
   │   │    ⬆  Upload your photo      │   │  ← single primary CTA
   │   │                              │   │     (also the drop zone)
   │   └──────────────────────────────┘   │
   │                                      │
   │      JPG · PNG · HEIC · up to 25 MB  │
   │   Your photo stays on your device.   │  ← privacy, stated early
   │                                      │
   │   ── or pick a format ──             │
   │   ┌────────────┐  ┌────────────┐     │
   │   │ PFP FRAME  │  │ BUILDER ID │     │  ← Format B may be hidden
   │   │  [sample]  │  │  [sample]  │     │     until it exists
   │   └────────────┘  └────────────┘     │
   └──────────────────────────────────────┘
```

Rules:

- One primary action. Format choice is secondary and defaults to **PFP Frame**.
- Sample thumbnails do the explaining; no instructional paragraph.
- Nothing blocks the CTA — no cookie wall, no modal, no email gate.

Task: [T-026](tasks/T-026-landing-and-format-selector.md)

---

## Step 2 — Upload

Three entry points, one handler:

```
   ┌ file picker ─┐
   │ drag & drop  ├──► same ingest pipeline ──► normalized bitmap
   │ camera capture┘
```

What happens between "user picked a file" and "we have something drawable":

```
   File
    │
    ├─ 1. validate      type allow-list, size cap, magic-bytes sniff   T-006
    │                   └─ fail ► inline recoverable error, keep zone active
    │
    ├─ 2. decode        createImageBitmap(file, {imageOrientation:      T-008
    │                   'from-image'})
    │                   └─ throws & file is HEIC? ► step 3
    │
    ├─ 3. HEIC path     lazy-load libheif/heic2any ► JPEG blob ► decode T-007
    │                   └─ show determinate "Converting…" only if >400 ms
    │
    ├─ 4. downscale     cap longest edge at ~4096 px to bound memory    T-008
    │
    └─► ImageBitmap ready ──► hand to renderer
```

The user sees: tap → (brief, honest state if HEIC) → their photo already inside the frame. Not a separate "uploaded, now click generate" step. **Generation is automatic.**

Tasks: [T-005](tasks/T-005-photo-uploader.md), [T-006](tasks/T-006-file-validation.md), [T-007](tasks/T-007-heic-conversion.md), [T-008](tasks/T-008-exif-and-downscale.md), [T-009](tasks/T-009-ingest-orchestration.md)

---

## Step 3 — Adjust (optional)

### Format A

```
   ┌──────────────────────────────────────┐
   │   ┌────────────────────────┐         │
   │   │                        │         │
   │   │   [ LIVE PREVIEW ]     │         │  ← already correct on arrival
   │   │   photo inside frame   │         │
   │   │                        │         │
   │   └────────────────────────┘         │
   │                                      │
   │   Zoom  ▁▂▃▄▅▆▇  ──────●──────       │  ← only if they want it
   │   (drag the photo to reposition)     │
   │                                      │
   │   Style:  ● Sunset  ○ Palm  ○ Night  │  ← P3, if brand kit offers
   │                                      │      variants
   │   [ Download ]   [ Share on X ]      │
   └──────────────────────────────────────┘
```

### Format B — one extra step

```
   ┌──────────────────────────────────────┐
   │   Name       [ Hitesh Solanki      ] │  required, ≤ 28 chars
   │   Role       [ Software Engineer   ] │  required, ≤ 32 chars
   │   Stack      [ Next.js · TS · AWS  ] │  optional, ≤ 40 chars
   │                                      │
   │   Builder title                      │
   │   ┌──────────────────────────────┐   │
   │   │ AI PRODUCT BUILDER      ⟳    │   │  derived from Role,
   │   └──────────────────────────────┘   │  reroll or edit
   │                                      │
   │   ┌────────────────────────┐         │
   │   │   [ LIVE PREVIEW ]     │         │  repaints as they type
   │   └────────────────────────┘         │  (debounced ~80 ms)
   │                                      │
   │   [ Download ]   [ Share on X ]      │
   └──────────────────────────────────────┘
```

Design rules:

- The preview is never empty. Before the user types, it shows placeholder text so the layout is legible.
- Long input shrinks/wraps automatically; it never overflows the card and never gets silently truncated without an ellipsis. ([T-014](tasks/T-014-text-layout-engine.md))
- No "Generate" button. The preview _is_ the generated artwork.

Tasks: [T-012](tasks/T-012-manual-crop-control.md), [T-017](tasks/T-017-builder-title-generator.md), [T-018](tasks/T-018-builder-form.md), [T-021](tasks/T-021-live-preview-surface.md)

---

## Step 4 — Get the file

```
   [ Download ]
        │
        ├─ desktop ──► <a download> + object URL ──► lands in ~/Downloads
        │
        └─ mobile ──► navigator.share({files:[png]})  ← preferred
                      │   └─ "Save Image" / "Copy" / app targets
                      └─ unsupported? ► open blob in new tab +
                                        "press and hold to save"
```

The iOS nuance is real and is the reason FR-4.3 exists as a P0. Details and fallbacks: [T-020](tasks/T-020-download-action.md).

---

## Step 5 — Share to X

Two mechanisms, chosen by capability, presented as one button.

### Path 1 — Native share (mobile, preferred)

```
   Tap "Share on X"
        │
        ▼
   navigator.canShare({files}) === true
        │
        ▼
   OS share sheet with the actual PNG attached
        │
        ▼
   User taps X ──► X composer opens with the image already attached
```

The caption cannot ride along reliably through the share sheet on every OS, so we also copy it to the clipboard and tell the user we did. Honest and it works.

### Path 2 — Intent link (desktop, or no file share)

```
   Tap "Share on X"
        │
        ├─ upload PNG to storage ──► https://cdn.../g/abc123.png     T-023
        │  (explicit: button label says "Share via link")
        │
        ├─ open https://x.com/intent/post?text=...&url=
        │        https://ourapp.com/share/abc123                     T-022
        │
        └─ X crawls /share/abc123 ──► reads og:image ──► renders     T-024
           the generated graphic as a large summary card
```

Composer shows:

```
   ┌────────────────────────────────────────┐
   │ I'm framed for HH Goa 2026 🌴          │
   │ #FrameInGoa                            │
   │                                        │
   │ ┌────────────────────────────────────┐ │
   │ │  [ the generated graphic ]         │ │ ← via OG image
   │ │  hhgoa.app                         │ │
   │ └────────────────────────────────────┘ │
   └────────────────────────────────────────┘
```

**The honest limitation:** a web intent URL cannot force-attach a local image to someone's post. Anyone who claims otherwise is describing the OG-preview trick above, which shows the image as a _link card_, not as a native attachment. We implement both paths and let the capable device use the better one. Full write-up: [Sharing & OG](08-sharing-and-og.md).

Tasks: [T-022](tasks/T-022-x-intent-share.md), [T-023](tasks/T-023-storage-presigned-upload.md), [T-024](tasks/T-024-share-page-og.md), [T-025](tasks/T-025-native-share-sheet.md)

---

## Unhappy paths

Every one must be recoverable without a page reload. Owned by [T-027](tasks/T-027-states-loading-error.md).

| #    | What happens                             | What the user sees                                                    | Recovery                                  |
| ---- | ---------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| U-1  | Picks a PDF / video / .txt               | "That's not a photo. Try a JPG, PNG, or HEIC."                        | Drop zone stays live                      |
| U-2  | Picks a 60 MB RAW file                   | "That file's too big (max 25 MB)."                                    | Pick another                              |
| U-3  | HEIC decode fails                        | "We couldn't read that photo. Try saving it as JPEG." + how-to on iOS | Pick another                              |
| U-4  | Image is 40 × 40 px                      | "That photo's too small to look good — 600 px or larger works best."  | Warn, allow override                      |
| U-5  | Auto-crop cuts the face                  | — (no error)                                                          | Zoom / drag control is visible by default |
| U-6  | Fonts fail to load                       | Render proceeds with a metric-compatible fallback; never blank text   | Silent, logged                            |
| U-7  | Share upload fails                       | "Couldn't create a share link. You can still download and post it."   | Download still works                      |
| U-8  | Offline mid-session                      | Download works (all local); share link disabled with a reason         | Retry when back                           |
| U-9  | In-app browser blocks the file picker    | "Open in Safari/Chrome to upload" + copy-link button                  | Escape hatch                              |
| U-10 | Rotates phone mid-edit                   | Layout reflows; crop state preserved                                  | Automatic                                 |
| U-11 | Name field is 90 characters              | Auto-shrink, then wrap, then ellipsis — never overflow                | Automatic                                 |
| U-12 | Opens `/share/[id]` for an expired image | Friendly page: "This one's expired — make your own" + CTA             | CTA to home                               |

## State machine

The whole app is one small machine. Implementing it explicitly (rather than with scattered booleans) is what makes U-1…U-12 tractable.

```
                 ┌──────┐
                 │ IDLE │◄────────────────────┐
                 └──┬───┘                     │
              file selected                   │ reset / replace photo
                    ▼                         │
              ┌───────────┐   invalid   ┌─────┴─────┐
              │ VALIDATING├────────────►│   ERROR   │
              └─────┬─────┘             └─────┬─────┘
                    │ ok                      │ retry
                    ▼                         │
              ┌───────────┐   fail            │
              │ DECODING  ├───────────────────┘
              └─────┬─────┘
                    │ bitmap
                    ▼
              ┌───────────┐  edit (crop/text)
              │   READY   │◄──────────┐
              └─────┬─────┘           │
                    │ any change      │
                    ▼                 │
              ┌───────────┐           │
              │ RENDERING ├───────────┘
              └─────┬─────┘
                    │ export
        ┌───────────┴────────────┐
        ▼                        ▼
  ┌───────────┐           ┌───────────┐
  │DOWNLOADED │           │ UPLOADING │──► SHARED
  └───────────┘           └───────────┘
```

Note `RENDERING` returns to `READY` and is usually too fast to show a spinner — which is the point. Only `DECODING` on the HEIC path earns visible feedback.
