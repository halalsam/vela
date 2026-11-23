ALTER TABLE "plan" ADD COLUMN "provider" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "backup_provider_ref" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "backup_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "esim" ADD COLUMN "provider" text DEFAULT '' NOT NULL;