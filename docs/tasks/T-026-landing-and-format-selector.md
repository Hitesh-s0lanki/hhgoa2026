# T-026 — Landing page & format selector

|                |                                                                          |
| -------------- | ------------------------------------------------------------------------ |
| **Phase**      | 6 — Ship                                                                 |
| **Status**     | ☐ Not started                                                            |
| **Estimate**   | 3 h                                                                      |
| **Depends on** | [T-002](T-002-design-tokens-and-ui.md), [T-005](T-005-photo-uploader.md) |
| **Blocks**     | T-030                                                                    |
| **Satisfies**  | FR-6.2, FR-6.3                                                           |

## Why this exists

The landing page has one job: get someone from arrival to uploading a photo without reading anything. Most visitors arrive from a link in a tweet, on a phone, mid-scroll. If the CTA is not obvious in a second, they leave.

It is also where the "no login" requirement (FR-6.1) is visible as a _feature_ — there is nothing between arrival and using the tool.

## Scope

**In:** the landing layout, hero copy, the format selector, sample previews, the privacy line, the editor transition, SEO/OG for the site itself.

**Out:** the uploader component ([T-005](T-005-photo-uploader.md)), the editor ([T-021](T-021-live-preview-surface.md)), error states ([T-027](T-027-states-loading-error.md)).

## Layout

```
   MOBILE (primary)                    DESKTOP
   ┌──────────────────────┐            ┌─────────────────────────────────────┐
   │      HH GOA 2026     │            │  HH GOA 2026                        │
   │                      │            │                                     │
   │  Frame yourself      │            │  Frame yourself       ┌───────────┐  │
   │  for Goa.            │            │  for Goa.             │  sample   │  │
   │                      │            │                       │  output   │  │
   │  ┌────────────────┐  │            │  ┌─────────────────┐  │           │  │
   │  │  ⬆ Upload your │  │            │  │ ⬆ Upload photo  │  └───────────┘  │
   │  │     photo      │  │            │  └─────────────────┘                 │
   │  └────────────────┘  │            │  JPG · PNG · HEIC                    │
   │                      │            │  Stays on your device.               │
   │  JPG · PNG · HEIC    │            │                                     │
   │  Stays on your       │            │  ┌──────────┐  ┌──────────┐         │
   │  device.             │            │  │PFP FRAME │  │BUILDER ID│         │
   │                      │            │  └──────────┘  └──────────┘         │
   │  ┌───────┐ ┌───────┐ │            └─────────────────────────────────────┘
   │  │ PFP   │ │BUILDER│ │
   │  └───────┘ └───────┘ │
   └──────────────────────┘
```

Rules:

- **One primary action.** The upload zone is the hero, and it is also the drop target.
- **The format selector is secondary** and defaults to PFP Frame. A user who ignores it entirely gets the right thing.
- **Sample thumbnails do the explaining.** No instructional paragraph — showing the output is faster to read than describing it.
- **Nothing blocks the CTA.** No cookie banner, no modal, no email gate. That is a requirement, not a preference.

## Implementation notes

### Copy

| Element      | Text                                      | Why                                         |
| ------------ | ----------------------------------------- | ------------------------------------------- |
| Wordmark     | HH GOA 2026                               | brand asset, not type                       |
| Headline     | _Frame yourself for Goa._                 | five words, action-oriented                 |
| CTA          | _Upload your photo_                       | says exactly what to do                     |
| Formats line | _JPG · PNG · HEIC · up to 25 MB_          | pre-empts the "will my photo work" question |
| Privacy      | _Your photo stays on your device._        | true, and it is a differentiator            |
| No-login     | _No signup. No account. Just your photo._ | turns the constraint into a selling point   |

Get the headline signed off with the caption ([Q-5](../11-open-questions.md)) — it is event voice, not product copy.

### Format selector

```tsx
// components/FormatSelector.tsx
export function FormatSelector() {
  const { templateId, setTemplate } = useStore();
  return (
    <div role="radiogroup" aria-label="Choose a format" className="grid grid-cols-2 gap-3">
      {templateList.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={templateId === t.id}
          onClick={() => setTemplate(t.id)}
          className="aria-checked:ring-primary aria-checked:ring-2 …"
        >
          <img src={`/branding/sample-${t.id}.jpg`} alt="" width={240} height={300} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
```

`role="radiogroup"` with `aria-checked` rather than a `<Tabs>` component: this is a single choice among alternatives, which is what a radio group means. Tabs imply switching views, and screen reader users get the wrong mental model.

Switching format after a photo is loaded must **keep the photo and the fields** and just re-render at the new aspect ([T-021](T-021-live-preview-surface.md)).

If Format B is not built yet, hide the selector entirely rather than showing a disabled option. A disabled option advertises something that does not exist.

### Sample previews

Pre-render one sample per format with a stock or team photo, export at ~480 px, and commit as JPEGs. Do not generate them at runtime — they are above the fold on the landing page and must not wait for the render engine to initialize.

Use a photo you have clear permission to use. A colleague's face on a public landing page needs their explicit agreement.

### The transition to the editor

Single page, no navigation:

```
   status: 'idle'                    status: 'ready'
   ┌──────────────────┐              ┌──────────────────┐
   │  hero + upload   │  ──fade──►   │  preview + tools │
   └──────────────────┘              └──────────────────┘
```

No route change, no page load. The upload zone becomes the editor in place, which keeps the whole thing feeling like one instant action rather than a multi-step flow.

Consider updating the URL with `history.replaceState` (`/#edit`) so the browser back button returns to the landing state rather than leaving the site. Small touch, prevents an accidental exit.

### Site-level OG

```tsx
// app/opengraph-image.tsx — a static card for the site itself
export const size = { width: 1200, height: 630 };
```

Distinct from the per-share cards in [T-024](T-024-share-page-og.md). When the organizers post the tool's own link, this is what appears.

### Performance

The landing page is what the LCP budget (≤ 1.5 s on 4G) is measured against:

- Sample images: explicit `width`/`height`, `loading="eager"` for the first, `lazy` for the rest.
- Fonts: `preload` the display face; it is in the headline.
- No render-engine code in the landing chunk — the worker and templates load when a file is selected.
- The upload zone must be interactive before anything else finishes.

## Acceptance criteria

- [ ] The CTA is visible without scrolling on a 375 × 667 viewport
- [ ] Nothing blocks the CTA — no modal, banner, or gate
- [ ] Tapping the CTA opens the file picker
- [ ] The whole page is also a drop target on desktop
- [ ] The format selector defaults to PFP Frame
- [ ] Format B is hidden (not disabled) if unbuilt
- [ ] Switching format preserves the photo and fields
- [ ] Sample previews are real outputs of the actual templates
- [ ] Samples are pre-rendered static files, not runtime renders
- [ ] The privacy line and the no-login line are both visible
- [ ] Landing → editor is a single-page transition, no navigation
- [ ] The back button returns to the landing state
- [ ] LCP ≤ 1.5 s on throttled 4G
- [ ] Site-level OG card renders when the site URL is shared
- [ ] Keyboard: CTA and selector are reachable with visible focus
- [ ] Selector is announced as a radio group with the current selection
- [ ] Renders correctly at 320 px width

## Files touched

```
app/page.tsx
app/opengraph-image.tsx
components/FormatSelector.tsx
components/uploader/UploadHint.tsx
public/branding/sample-pfp-frame.jpg
public/branding/sample-builder-card.jpg
```

## How to test

Open it on a real phone at 375 px and at 320 px. The CTA must be reachable without scrolling at both. Then throttle to Slow 4G and watch what appears first — if the samples arrive before the button is interactive, the priorities are wrong.

Show it to someone who has not seen the project and time how long before they tap upload. If they read anything first, the page is doing too much talking.

## Gotchas

- **Do not gate the CTA behind format choice.** Requiring a format selection before uploading adds a step for no benefit; the default handles it.
- **A disabled Format B is worse than a hidden one.** It advertises something the user cannot have.
- **Runtime-generated samples hurt LCP.** Pre-render and commit them.
- **`role="radiogroup"` needs arrow-key navigation** to be genuinely correct. Either implement it or use native `<input type="radio">` with styled labels, which gets it for free. The native route is usually the better trade.
- **`alt=""` on the sample images is right** — they are decorative, and the adjacent label carries the meaning. A verbose alt here just adds noise for screen reader users.
- **Get permission for any face** in the sample images.
- **Test in the X in-app browser.** It is the most common arrival path, and its viewport chrome eats vertical space, which can push the CTA below the fold even when it is fine in Safari.

## References

- [03 — User Flows, Step 1](../03-user-flows.md#step-1--landing)
- [02 — Requirements, FR-6](../02-requirements.md#fr-6--shell--ux)
