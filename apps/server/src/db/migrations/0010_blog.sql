CREATE TYPE "public"."blog_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."content_locale" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TABLE "blog_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale" "content_locale" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"cover_image" text,
	"cover_alt" text DEFAULT '' NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"country_codes" text[] DEFAULT '{}' NOT NULL,
	"status" "blog_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"alternate_slug" text,
	"meta_title" text,
	"meta_description" text,
	"canonical_url" text,
	"og_image" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"noindex" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_locale_slug_idx" ON "blog_post" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "blog_post_feed_idx" ON "blog_post" USING btree ("locale","status","published_at");