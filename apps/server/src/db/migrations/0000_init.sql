CREATE TYPE "public"."activation_policy" AS ENUM('on_install', 'on_first_connection');--> statement-breakpoint
CREATE TYPE "public"."area" AS ENUM('asia', 'europe', 'gulf', 'americas', 'africa', 'oceania');--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('INR', 'AED', 'SAR', 'QAR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."esim_status" AS ENUM('not_started', 'active', 'expired', 'depleted');--> statement-breakpoint
CREATE TYPE "public"."order_kind" AS ENUM('esim', 'top_up');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'awaiting_payment', 'expired', 'paid', 'provisioning', 'fulfilled', 'provisioning_failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('razorpay', 'gulf');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('country', 'regional', 'global');--> statement-breakpoint
CREATE TYPE "public"."region_type" AS ENUM('regional', 'global');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'support', 'admin');--> statement-breakpoint
CREATE TYPE "public"."webhook_source" AS ENUM('razorpay', 'gulf', 'esim');--> statement-breakpoint
CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"push_token" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	"currency" "currency" DEFAULT 'INR' NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"area" "area" NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" text PRIMARY KEY NOT NULL,
	"title_en" text NOT NULL,
	"title_ar" text NOT NULL,
	"body_en" text NOT NULL,
	"body_ar" text NOT NULL,
	"tag_en" text NOT NULL,
	"tag_ar" text NOT NULL,
	"coupon_code" text,
	"discount_pct" integer,
	"country_codes" text[] DEFAULT '{}' NOT NULL,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_plan_ref" text NOT NULL,
	"type" "plan_type" NOT NULL,
	"region_id" text,
	"country_codes" text[] NOT NULL,
	"data_mb" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"is5g" boolean DEFAULT false NOT NULL,
	"hotspot" boolean DEFAULT true NOT NULL,
	"activation" "activation_policy" DEFAULT 'on_first_connection' NOT NULL,
	"networks" text[] DEFAULT '{}' NOT NULL,
	"cost_minor" integer NOT NULL,
	"cost_currency" "currency" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_price" (
	"plan_id" text NOT NULL,
	"currency" "currency" NOT NULL,
	"amount_minor" integer NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_price_plan_id_currency_pk" PRIMARY KEY("plan_id","currency")
);
--> statement-breakpoint
CREATE TABLE "region" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "region_type" NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_country" (
	"region_id" text NOT NULL,
	"country_code" text NOT NULL,
	CONSTRAINT "region_country_region_id_country_code_pk" PRIMARY KEY("region_id","country_code")
);
--> statement-breakpoint
CREATE TABLE "top_up_pack" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_pack_ref" text NOT NULL,
	"plan_id" text NOT NULL,
	"data_mb" integer NOT NULL,
	"extra_days" integer DEFAULT 0 NOT NULL,
	"cost_minor" integer NOT NULL,
	"cost_currency" "currency" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "top_up_pack_providerPackRef_unique" UNIQUE("provider_pack_ref")
);
--> statement-breakpoint
CREATE TABLE "top_up_price" (
	"pack_id" text NOT NULL,
	"currency" "currency" NOT NULL,
	"amount_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "top_up_price_pack_id_currency_pk" PRIMARY KEY("pack_id","currency")
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" integer NOT NULL,
	"currency" "currency",
	"max_redemptions" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"country_codes" text[] DEFAULT '{}' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_value_positive" CHECK ("coupon"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "coupon_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_code" text NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"reason" text NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"number" text NOT NULL,
	"gstin" text,
	"place_of_supply" text,
	"pdf_key" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" "order_kind" NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"plan_id" text,
	"top_up_pack_id" text,
	"esim_id" uuid,
	"currency" "currency" NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"credit_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"coupon_code" text,
	"idempotency_key" text NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_total_non_negative" CHECK ("order"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_payment_id" text,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"iccid" text NOT NULL,
	"plan_id" text NOT NULL,
	"provider_ref" text NOT NULL,
	"status" "esim_status" DEFAULT 'not_started' NOT NULL,
	"label" text NOT NULL,
	"data_used_mb" integer DEFAULT 0 NOT NULL,
	"data_total_mb" integer NOT NULL,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"smdp" text NOT NULL,
	"lpa_enc" text NOT NULL,
	"activation_code_enc" text NOT NULL,
	"usage_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"esim_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"push_token" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_snapshot" (
	"esim_id" uuid NOT NULL,
	"day" date NOT NULL,
	"used_mb" integer NOT NULL,
	CONSTRAINT "usage_snapshot_esim_id_day_pk" PRIMARY KEY("esim_id","day")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "webhook_source" NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_country" ADD CONSTRAINT "region_country_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_country" ADD CONSTRAINT "region_country_country_code_country_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."country"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up_pack" ADD CONSTRAINT "top_up_pack_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up_price" ADD CONSTRAINT "top_up_price_pack_id_top_up_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."top_up_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_coupon_code_coupon_code_fk" FOREIGN KEY ("coupon_code") REFERENCES "public"."coupon"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_coupon_code_coupon_code_fk" FOREIGN KEY ("coupon_code") REFERENCES "public"."coupon"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esim" ADD CONSTRAINT "esim_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_activity" ADD CONSTRAINT "live_activity_esim_id_esim_id_fk" FOREIGN KEY ("esim_id") REFERENCES "public"."esim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_activity" ADD CONSTRAINT "live_activity_device_id_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_snapshot" ADD CONSTRAINT "usage_snapshot_esim_id_esim_id_fk" FOREIGN KEY ("esim_id") REFERENCES "public"."esim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_push_token_idx" ON "device" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "device_user_idx" ON "device" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_referral_code_idx" ON "profile" USING btree ("referral_code");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_provider_ref_idx" ON "plan" USING btree ("provider_plan_ref");--> statement-breakpoint
CREATE INDEX "plan_country_codes_idx" ON "plan" USING gin ("country_codes");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemption_order_idx" ON "coupon_redemption" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "coupon_redemption_user_idx" ON "coupon_redemption" USING btree ("coupon_code","user_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_idx" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_idx" ON "invoice" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_order_idx" ON "invoice" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_number_idx" ON "order" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "order_user_idempotency_idx" ON "order" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "order_user_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_order_idx" ON "payment" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "esim_iccid_idx" ON "esim" USING btree ("iccid");--> statement-breakpoint
CREATE INDEX "esim_user_idx" ON "esim" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "esim_status_idx" ON "esim" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "live_activity_token_idx" ON "live_activity" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "live_activity_esim_idx" ON "live_activity" USING btree ("esim_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_source_id_idx" ON "webhook_event" USING btree ("source","event_id");