# T-012 — Manual pan/zoom crop control

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Phase**      | 2 — Framing                                                                  |
| **Status**     | ☐ Not started                                                                |
| **Estimate**   | 2.5 h                                                                        |
| **Depends on** | [T-010](T-010-cover-fit-geometry.md), [T-021](T-021-live-preview-surface.md) |
| **Blocks**     | —                                                                            |
| **Satisfies**  | FR-2.4                                                                       |

## Why this exists

No automatic framing is right every time. Without an override, "the crop is wrong" is a bug report you cannot fix; with one, it is a two-second gesture.

It is also the accessibility floor for [T-011](T-011-smart-subject-positioning.md): a face detector that performs unevenly across faces is only acceptable when the manual path is equally good for everyone.

## Scope

**In:** drag-to-pan, pinch and slider zoom, edge clamping, a reset control, keyboard operation, `userAdjusted` tracking.

**Out:** the geometry itself ([T-010](T-010-cover-fit-geometry.md)), rotation and straightening (not requested), filters (out of scope entirely).

## Implementation notes

### Pointer Events, not mouse/touch

One code path for mouse, touch, and pen:

```tsx
// components/editor/CropControl.tsx
export function CropControl({ children }: { children: React.ReactNode }) {
  const { transform, setTransform, markAdjusted } = useStore();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ t: Transform; dist: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { t: transform, dist: spread(pointers.current) };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && start.current) {
      // Pinch: ratio of current spread to the spread at gesture start.
      const d = spread(pointers.current);
      const scale = clamp(start.current.t.scale * (d / start.current.dist), 1, 4);
      setTransform({ ...transform, scale });
    } else {
      // Pan: pixel delta → normalized offset delta, scaled by the slack.
      const box = e.currentTarget.getBoundingClientRect();
      setTransform({
        ...transform,
        offsetX: clamp(transform.offsetX - ((e.clientX - prev.x) / box.width) * 2, -1, 1),
        offsetY: clamp(transform.offsetY - ((e.clientY - prev.y) / box.height) * 2, -1, 1),
      });
    }
    markAdjusted();
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    start.current = null;
  };

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="cursor-grab touch-none active:cursor-grabbing"
      role="application"
      aria-label="Adjust photo position. Arrow keys to move, plus and minus to zoom."
      tabIndex={0}
      onKeyDown={onKey}
    >
      {children}
    </div>
  );
}
```

Two details that are easy to miss and both break the feature:

- **`touch-none`** (`touch-action: none`) — without it, the browser scrolls the page instead of letting you drag, and on iOS it also triggers pull-to-refresh. The gesture simply will not work.
- **`setPointerCapture`** — without it, dragging outside the element drops the gesture mid-motion.

### Sign convention

Dragging the photo right should move the _view_ left, so the offset is **subtracted**. Getting this backwards produces a control that feels immediately, viscerally wrong, and it is a one-character fix — worth a moment's care.

### Keyboard operation

```ts
const STEP = 0.05;
function onKey(e: React.KeyboardEvent) {
  const t = transform;
  const map: Record<string, Partial<Transform>> = {
    ArrowLeft: { offsetX: clamp(t.offsetX - STEP, -1, 1) },
    ArrowRight: { offsetX: clamp(t.offsetX + STEP, -1, 1) },
    ArrowUp: { offsetY: clamp(t.offsetY - STEP, -1, 1) },
    ArrowDown: { offsetY: clamp(t.offsetY + STEP, -1, 1) },
    "+": { scale: clamp(t.scale + 0.1, 1, 4) },
    "-": { scale: clamp(t.scale - 0.1, 1, 4) },
  };
  const next = map[e.key];
  if (!next) return;
  e.preventDefault();
  setTransform({ ...t, ...next });
  markAdjusted();
}
```

### Zoom bounds

```ts
scale ∈ [1, 4]
```

`1` is minimal cover — zooming out further would letterboxing, which FR-2.1 forbids. `4` is generous; beyond that a 1080 px export from a phone photo starts to look soft. The slider should be labelled and show the current value for screen readers.

### Reset

```tsx
<Button variant="ghost" onClick={resetTransform}>
  Reset
</Button>
```

Restores `{ scale: 1, offsetX: 0, offsetY: 0 }` **and** clears `userAdjusted`, which re-enables the automatic bias and lets [T-011](T-011-smart-subject-positioning.md) refine again. That is the intended escape hatch when someone experiments and wants the smart default back.

### Discoverability

Users do not know they can drag. Two cheap affordances:

1. A `cursor: grab` on desktop and a one-line hint under the preview: _"Drag to reposition · pinch to zoom"_.
2. Show the zoom slider by default rather than behind a disclosure. It is the visual signal that the photo is adjustable at all.

## Acceptance criteria

- [ ] Drag pans the photo on desktop (mouse) and mobile (touch)
- [ ] The photo moves in the same direction as the finger
- [ ] Pinch zooms on mobile; the slider zooms everywhere
- [ ] Dragging never scrolls the page or triggers pull-to-refresh on iOS
- [ ] Dragging outside the element keeps the gesture (pointer capture)
- [ ] Offsets clamp at the edges with **no transparent gaps at any zoom**
- [ ] `scale` is bounded to [1, 4]
- [ ] Dragging stays at 60 fps under 4× CPU throttle
- [ ] Reset restores defaults and clears `userAdjusted`
- [ ] Keyboard: arrows pan, +/− zoom, with a visible focus ring
- [ ] Screen reader announces purpose and current zoom
- [ ] `userAdjusted` becomes true on the first interaction and suppresses auto-refinement
- [ ] Two-finger gesture ending with one finger still down does not jump

## Files touched

```
components/editor/CropControl.tsx
components/editor/ZoomSlider.tsx
lib/store.ts               (transform, userAdjusted, resetTransform)
```

## How to test

On a real phone: drag in all four directions to each edge and watch for gaps or rubber-banding; pinch to maximum and back; lift one finger mid-pinch and confirm no jump. Then throttle the CPU 4× in DevTools and drag — if it stutters, the render is on the main thread and [T-013](T-013-canvas-renderer-core.md) needs revisiting.

Keyboard: tab to the control, pan to each edge with arrows, zoom in and out, then Reset — all without a mouse.

## Gotchas

- **`touch-action: none` is mandatory.** This is the number one reason drag-to-pan "doesn't work on mobile".
- **Do not `preventDefault()` on `pointerdown` indiscriminately** — it can suppress the focus that keyboard users need. Use `touch-action` for scroll suppression instead.
- **Multi-touch bookkeeping.** Track pointers in a `Map` keyed by `pointerId`, and recompute the gesture baseline when the pointer count changes, or lifting one finger mid-pinch causes a violent jump.
- **Throttle to animation frames, not to a timer.** `requestAnimationFrame`-coalesce the transform updates; a `setTimeout` throttle makes the drag feel laggy in a way users describe as "cheap".
- **Clamping belongs in `coverFit`, not here.** The UI can send any offset in [−1, 1]; the geometry decides what is reachable. Duplicating the clamp in both places means fixing edge bugs twice.
- **Reset must clear `userAdjusted`.** Otherwise reset leaves the framing worse than a fresh upload, because the automatic bias stays disabled.
- **`role="application"`** is deliberate: it tells screen readers to pass arrow keys through rather than intercepting them for navigation. Pair it with a clear `aria-label` describing the keys.

## References

- [03 — User Flows, Step 3](../03-user-flows.md#step-3--adjust-optional)
- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
