# Branding assets

Provenance for everything in `public/branding/`. These are the event's own
assets, used for a submission to the event's own task — but re-exported at the
sizes we need rather than shipped at source resolution.

| File                | Source                        | Transform                    | Size  |
| ------------------- | ----------------------------- | ---------------------------- | ----- |
| `wordmark-tile.png` | `public/logo.png` (1440×1440) | `sips -Z 256`, displayed @36 px | 32 KB |

Fonts are **not** here: Imbue and Victor Mono are both Google Fonts under the
SIL OFL, and `next/font/google` self-hosts them at build time. The canvas
renderer needs WOFF2 subsets of the same two faces under `fonts/` — that is
[T-003](../../docs/tasks/T-003-brand-asset-intake.md).

Still to harvest for the templates (T-003): `palms.png` and `flowers.png`
cropped from `hhgoa.com/assets/footer trees.png`, and the transparent wordmark
strip from `Hacker house.png`.
