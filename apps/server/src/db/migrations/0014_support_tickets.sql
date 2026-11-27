ALTER TABLE "support_conversation" DROP CONSTRAINT "support_conversation_pkey";--> statement-breakpoint
ALTER TABLE "support_conversation" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "support_conversation" ADD COLUMN "number" serial NOT NULL;--> statement-breakpoint
UPDATE "support_conversation" SET "number" = "number" + 1000;--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('support_conversation', 'number'), (SELECT coalesce(max("number"), 1000) FROM "support_conversation"));--> statement-breakpoint
ALTER TABLE "support_conversation" ADD COLUMN "iccid" text;--> statement-breakpoint
ALTER TABLE "support_message" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
UPDATE "support_message" SET "conversation_id" = c."id" FROM "support_conversation" c WHERE c."user_id" = "support_message"."user_id";--> statement-breakpoint
ALTER TABLE "support_rating" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
UPDATE "support_rating" SET "conversation_id" = c."id" FROM "support_conversation" c WHERE c."user_id" = "support_rating"."user_id";--> statement-breakpoint
CREATE INDEX "support_message_conversation_idx" ON "support_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "support_conversation_user_idx" ON "support_conversation" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_conversation_number_idx" ON "support_conversation" USING btree ("number");
