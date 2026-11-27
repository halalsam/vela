CREATE TABLE "upload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"driver" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"original_name" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "upload_key_idx" ON "upload" USING btree ("key");--> statement-breakpoint
CREATE INDEX "upload_created_idx" ON "upload" USING btree ("created_at");