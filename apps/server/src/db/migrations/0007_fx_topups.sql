CREATE TABLE "fx_rate" (
	"currency" "currency" PRIMARY KEY NOT NULL,
	"per_usd" double precision NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "top_up_pack" DROP CONSTRAINT "top_up_pack_providerPackRef_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "top_up_pack_plan_ref_idx" ON "top_up_pack" USING btree ("plan_id","provider_pack_ref");