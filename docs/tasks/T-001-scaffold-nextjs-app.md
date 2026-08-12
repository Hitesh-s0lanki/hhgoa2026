# T-001 — Scaffold Next.js + TypeScript app

|                |                |
| -------------- | -------------- |
| **Phase**      | 0 — Foundation |
| **Status**     | ☐ Not started  |
| **Estimate**   | 1.5 h          |
| **Depends on** | —              |
| **Blocks**     | everything     |
| **Satisfies**  | NFR-5.1        |

## Why this exists

Get a deployable, strictly-typed shell in place so no later task has to make setup decisions mid-flow. The goal is a boring, correct foundation — not a starting point that needs unpicking in week two.

## Scope

**In:** app creation, TypeScript strict config, path aliases, lint/format, Vitest + Playwright wiring, folder skeleton, `.env.example`, first Vercel deploy of an empty page.

**Out:** any UI, any brand styling (that is [T-002](T-002-design-tokens-and-ui.md)), any storage config (that is [T-023](T-023-storage-presigned-upload.md)).

## Implementation notes

```bash
npx create-next-app@latest . \
  --ts --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --no-turbopack
```

Then create the folder skeleton from [09 — Project Structure](../09-project-structure.md) with `.gitkeep` files, so the layout is visible from commit one rather than emerging by accident.

### `tsconfig.json` — the parts that matter

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true, // template layer arrays, title tables
    "noUnusedLocals": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./*"] },
  },
}
```

`noUncheckedIndexedAccess` is deliberate. This codebase indexes into arrays of layers and tables of titles constantly, and it catches exactly the class of bug that renders a blank layer with no error.

### Scripts

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run typecheck && npm run lint && npm run test",
  },
}
```

### `next.config.ts`

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Brand assets are static files in public/ — no next/image loader needed for
  // canvas drawing, and Image Optimization would be pointless for them.
  images: { unoptimized: true },
};

export default config;
```

### `.env.example`

Commit this; never commit `.env.local`.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CDN_BASE=
NEXT_PUBLIC_SHARE_HASHTAG=FrameInGoa

# server-only — leave blank locally; share-via-link degrades gracefully
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

### Test wiring

```bash
npm i -D vitest @vitest/coverage-v8 @playwright/test
npx playwright install --with-deps chromium webkit
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`environment: 'node'` is correct — the unit-tested code (geometry, titles, validation, caption) is deliberately DOM-free. Anything needing a DOM belongs in Playwright.

## Acceptance criteria

- [ ] `npm run dev` serves a page at `localhost:3000` with no console errors
- [ ] `npm run build` completes clean
- [ ] `npm run typecheck` passes with `strict` and `noUncheckedIndexedAccess` on
- [ ] `npm run lint` passes
- [ ] `npm run test` runs (a single trivial passing test is fine)
- [ ] `npm run test:e2e` launches Chromium and WebKit successfully
- [ ] `@/lib/...` and `@/components/...` imports resolve in both the app and tests
- [ ] Folder skeleton from doc 09 exists
- [ ] `.env.example` is committed; `.env.local` is gitignored
- [ ] Deployed to Vercel from `main`, URL recorded in the project README

## Files touched

```
package.json  tsconfig.json  next.config.ts  vitest.config.ts
playwright.config.ts  .eslintrc.json  .prettierrc  .env.example  .gitignore
app/layout.tsx  app/page.tsx  app/globals.css
lib/.gitkeep  components/.gitkeep  public/branding/.gitkeep  tests/.gitkeep
```

## How to test

```bash
npm run check && npm run build
```

Then push to `main` and confirm the Vercel deployment succeeds. Deploying on day one — while there is nothing to break — means a deploy failure later is unambiguously caused by the change that introduced it.

## Gotchas

- **Pin versions.** Run `npm ls next react typescript` and record the resolved versions in the README. "Latest" moves, and a canvas/font behaviour change between minors is genuinely hard to diagnose later.
- **Do not add `--src-dir`.** Doc 09 assumes root-level `app/`, `lib/`, `components/`. Mixing conventions is a small permanent tax.
- **Skip Turbopack for now** if worker + WASM imports misbehave; the HEIC and face-detector chunks are dynamic imports of WASM-backed packages and bundler edge cases here cost more time than the dev-server speed saves.
- **Do not install the AWS SDK yet.** It arrives in [T-023](T-023-storage-presigned-upload.md) and must never be reachable from client code.

## References

- [09 — Project Structure](../09-project-structure.md)
- [05 — Tech Stack](../05-tech-stack.md)
