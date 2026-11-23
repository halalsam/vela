CREATE TABLE "esim_notice" (
	"esim_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "esim_notice_esim_id_kind_pk" PRIMARY KEY("esim_id","kind")
);
--> statement-breakpoint
ALTER TABLE "live_activity" DROP CONSTRAINT "live_activity_device_id_device_id_fk";
--> statement-breakpoint
ALTER TABLE "live_activity" ALTER COLUMN "device_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "live_activity" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "live_activity" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "esim_notice" ADD CONSTRAINT "esim_notice_esim_id_esim_id_fk" FOREIGN KEY ("esim_id") REFERENCES "public"."esim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_activity" ADD CONSTRAINT "live_activity_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE set null ON UPDATE no action;