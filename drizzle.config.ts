import { defineConfig } from "drizzle-kit";

/**
 * Migrations live in `drizzle/` and are generated from `lib/db/schema.ts`.
 *
 *   npm run db:generate   # schema.ts -> drizzle/*.sql
 *   npm run db:migrate    # apply to the Neon database in DATABASE_URL
 *   npm run db:studio     # browse rows
 *
 * `drizzle-kit` reads `.env` itself; nothing here imports the app's runtime
 * database client, so a missing `DATABASE_URL` fails the CLI rather than the app.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
