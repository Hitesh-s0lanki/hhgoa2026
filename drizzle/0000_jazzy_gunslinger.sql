CREATE TABLE "passes" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"name" varchar(28) NOT NULL,
	"role" varchar(32),
	"stack" varchar(40),
	"title" varchar(24) NOT NULL,
	"pass_number" varchar(24) NOT NULL,
	"photo_url" text,
	"photo_key" text,
	"card_url" text NOT NULL,
	"card_key" text,
	"og_url" text,
	"og_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "passes_session_id_idx" ON "passes" USING btree ("session_id");