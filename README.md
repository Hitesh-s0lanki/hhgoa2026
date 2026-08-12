# HH Goa 2026 — Frame

A single-purpose web tool: upload a photo, get it composited into an HH Goa 2026 branded
builder pass, download it or post it to X. The card is rendered in the browser; it is
uploaded only when the user chooses to share.

Full specification lives in [`docs/`](docs/README.md). Start with
[01 — Project Overview](docs/01-project-overview.md) and
[09 — Project Structure](docs/09-project-structure.md).

## Getting started

```bash
npm install
cp .env.example .env
npm run dev                    # http://localhost:3002
```

Both services are optional for local work — with neither configured, the generator and
**Download** still work, because rendering the card touches no server at all.

| Variable               | Needed for                              | Without it                          |
| ---------------------- | --------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | the link X unfurls into a preview card  | posts link to the image, no preview |
| `UPLOADTHING_TOKEN`    | storing the photo and the rendered card | uploads fail; download unaffected   |
| `DATABASE_URL`         | resolving `/share/[id]` to a card image | **Post on X** returns a clear 503   |

**`NEXT_PUBLIC_SITE_URL` must be the deployed origin before anyone shares.** X
builds the image preview by fetching `/share/[id]` and reading its `og:image` —
a link straight to the PNG has no meta tags, so X shows it as plain text with no
picture. Left at `localhost`, the app detects that the origin is not publicly
reachable and posts the card image URL instead, rather than a link that is dead
for everyone but the machine that made it.

```bash
# Neon: create a project at console.neon.tech, copy the pooled connection string
npm run db:migrate             # applies drizzle/*.sql to that database
npm run db:studio              # browse the passes table
```

## Scripts

| Script                            | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Dev server (Turbopack)                                      |
| `npm run build`                   | Production build                                            |
| `npm run start`                   | Serve the production build                                  |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                             |
| `npm run lint` / `lint:fix`       | ESLint (flat config)                                        |
| `npm run format` / `format:check` | Prettier                                                    |
| `npm run test` / `test:watch`     | Vitest unit tests (`tests/unit`)                            |
| `npm run test:coverage`           | Vitest with v8 coverage over `lib/`                         |
| `npm run test:e2e`                | Playwright (`tests/e2e`), Chromium + WebKit + Mobile Safari |
| `npm run check`                   | typecheck → lint → unit tests                               |
| `npm run db:generate`             | `lib/db/schema.ts` → a new SQL migration in `drizzle/`      |
| `npm run db:migrate`              | Apply pending migrations to `DATABASE_URL`                  |
| `npm run db:studio`               | Drizzle Studio against `DATABASE_URL`                       |

Run the e2e suite against a **production build** (`npm run build && CI=1 npm run test:e2e`)
when touching the export path. The dev server is slow enough under three parallel browser
projects to trip hydration assertions, and `Secure`-cookie behaviour only differs from dev
in a real build.

## Resolved versions

Pinned deliberately — a canvas or font behaviour change between minors is hard to
diagnose later. See [T-001](docs/tasks/T-001-scaffold-nextjs-app.md).

| Package           | Version |
| ----------------- | ------- |
| next              | 16.3.0  |
| react / react-dom | 19.2.8  |
| typescript        | 5.9.3   |
| tailwindcss       | 4.3.3   |
| vitest            | 4.1.10  |
| @playwright/test  | 1.62.1  |
| eslint            | 9.39.5  |
| node (dev)        | 22.22.0 |

Playwright browsers are a separate download: `npx playwright install chromium webkit`.

Ranges in `package.json` must be ones that actually resolve. A range for a version that
was never published (`eslint@^9.42.0`) does not fail fast — npm's resolver retries the
metadata thousands of times and the install appears to hang indefinitely rather than
erroring. If an install stalls, check that first: `npm view <pkg> versions`.

## shadcn/ui

Set up per [doc 05](docs/05-tech-stack.md) — copy-in components, Radix base, `nova` preset.
Config in [components.json](components.json). Installed: `button`, `input`, `label`,
`slider`, `tabs`, `sonner` (`sonner` replaces the deprecated `toast`).

```bash
npx shadcn@latest add <component>
```

Two things differ from a stock shadcn install, both in `app/globals.css`:

- **The brand theme owns the file.** `shadcn init` overwrites `globals.css` with its
  neutral palette, which would wipe the `@theme` brand block and fail
  `tests/unit/brand-tokens.test.ts`. The shadcn `:root` contract was merged into the
  brand theme by hand instead, and the `@theme inline` block maps it so `bg-primary` and
  friends resolve to brand values. **Re-running `shadcn init` will clobber this** — only
  ever run `shadcn add`.
- **`dark:` is deliberately inert.** `@custom-variant dark (&:is(.dark *))` binds the dark
  variant to a class that is never applied, because the app ships one fixed palette. Left
  at Tailwind's default, `prefers-color-scheme` would repaint the shadcn components on a
  dark-mode OS.

`--destructive` maps to brand pink: the palette has no red, and there are no destructive
actions in the product (errors render as inline notices, T-027).

## Deviations from the docs

The specification was written against Next 15 / Tailwind 3. This scaffold is on the
current latest instead:

- **Next 16 + Turbopack.** Turbopack is the default bundler in Next 16 and webpack is no
  longer the supported path, so the "skip Turbopack" note in T-001 does not apply. If the
  HEIC or face-detector WASM chunks misbehave later, that is the point to revisit.
- **Tailwind 4.** CSS-first configuration — there is no `tailwind.config.ts`. Brand tokens
  go in `app/globals.css` under `@theme` (T-002), not in a JS config file.
- **`next lint` is removed.** `npm run lint` calls `eslint` directly.

## Layout

```
proxy.ts     mints the session cookie on every request (Next 16's middleware)
app/         routes — landing, /share/[id], /api/pass, /api/uploadthing
components/  React only; no image math (doc 09, rule 2)
lib/         db, render, share, upload, brand — render/ never imports React
drizzle/     generated SQL migrations (npm run db:generate)
public/      branding assets + self-hosted fonts
tests/       unit (Vitest, node env) + e2e (Playwright)
docs/        the specification
```

## Environment

Copy `.env.example` to `.env`. Storage and database credentials are server-only and never
reach the client — the browser only ever receives a presigned URL. The app builds and runs
with both absent: sharing degrades with a stated reason, and **Download** is unaffected
because it touches no server at all.

## Deployment

Vercel, zero-config. Deployment URL: _to be recorded on first deploy (T-032)._
