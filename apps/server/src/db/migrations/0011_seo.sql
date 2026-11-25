CREATE TABLE "seo_page" (
	"key" text NOT NULL,
	"locale" "content_locale" NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"og_title" text,
	"og_description" text,
	"og_image" text,
	"og_image_alt" text,
	"canonical_url" text,
	"noindex" boolean DEFAULT false NOT NULL,
	"nofollow" boolean DEFAULT false NOT NULL,
	"sitemap_priority" real,
	"change_frequency" text,
	"structured_data" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_page_key_locale_pk" PRIMARY KEY("key","locale")
);
--> statement-breakpoint
CREATE TABLE "seo_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
