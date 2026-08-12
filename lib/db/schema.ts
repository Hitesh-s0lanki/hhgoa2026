import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * One table: a row per pass someone actually generated.
 *
 * This reverses ADR-004 ("no database in v1") on purpose — the share id is no
 * longer a pure function of the storage key now that the card image lives at an
 * opaque UploadThing URL, so `/share/[id]` needs somewhere to look that URL up.
 * The row also carries the fields the pass was built from, which is what makes
 * "whoever filled the form" a real record rather than a filename.
 *
 * Everything here is user-supplied display text plus URLs to images the user
 * chose to publish. No contact details, no account, nothing that needs a
 * deletion flow beyond dropping the row.
 */
export const passes = pgTable(
  "passes",
  {
    /** nanoid(12) — url-safe, unguessable enough for a non-secret share link. */
    id: varchar("id", { length: 16 }).primaryKey(),

    /** The cookie minted in proxy.ts. Groups every pass one browser made. */
    sessionId: varchar("session_id", { length: 64 }).notNull(),

    // The form. Lengths mirror FIELD_LIMITS in components/editor/BuilderForm.tsx
    // — the card is what sets them, and the column should not accept text the
    // pass cannot draw.
    name: varchar("name", { length: 28 }).notNull(),
    role: varchar("role", { length: 32 }),
    stack: varchar("stack", { length: 40 }),
    title: varchar("title", { length: 24 }).notNull(),

    /** The printed pass number, stored so it survives a change to the hash. */
    passNumber: varchar("pass_number", { length: 24 }).notNull(),

    // The source photo — the "ID image". Nullable because the upload runs in
    // the background and a share must not block on it having landed.
    photoUrl: text("photo_url"),
    photoKey: text("photo_key"),

    /** Both faces on one sheet — what Download hands back and /share shows. */
    cardUrl: text("card_url").notNull(),
    cardKey: text("card_key"),

    /** 1200×630 crop for og:image; X will not render the tall sheet well. */
    ogUrl: text("og_url"),
    ogKey: text("og_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("passes_session_id_idx").on(table.sessionId)],
);

export type Pass = typeof passes.$inferSelect;
export type NewPass = typeof passes.$inferInsert;
