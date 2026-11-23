CREATE TABLE "invoice_counter" (
	"financial_year" text PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_contact" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"conversation_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sender" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "data" jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "support_message_user_idx" ON "support_message" USING btree ("user_id","created_at");