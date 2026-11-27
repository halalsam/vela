CREATE TYPE "public"."broadcast_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'resolved');--> statement-breakpoint
CREATE TABLE "broadcast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"title_ar" text,
	"body_ar" text,
	"segment" jsonb NOT NULL,
	"status" "broadcast_status" DEFAULT 'queued' NOT NULL,
	"audience" integer DEFAULT 0 NOT NULL,
	"reached" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "customer_tag" (
	"user_id" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tag_user_id_tag_pk" PRIMARY KEY("user_id","tag")
);
--> statement-breakpoint
CREATE TABLE "saved_reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversation" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"assignee_id" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_customer_at" timestamp with time zone,
	"staff_read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"rating_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_rating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"score" smallint NOT NULL,
	"comment" text,
	"staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_message" ADD COLUMN "staff_id" text;--> statement-breakpoint
ALTER TABLE "support_message" ADD COLUMN "internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_tag_tag_idx" ON "customer_tag" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "support_conversation_status_idx" ON "support_conversation" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "support_rating_created_idx" ON "support_rating" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "support_conversation" ("user_id", "status", "last_message_at", "last_customer_at", "created_at")
SELECT "user_id", 'open', max("created_at"), max("created_at") FILTER (WHERE "sender" = 'user'), min("created_at")
FROM "support_message" GROUP BY "user_id"
ON CONFLICT DO NOTHING;
