CREATE TABLE "credit_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"number" text NOT NULL,
	"data" jsonb NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_note_number_idx" ON "credit_note" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_note_order_idx" ON "credit_note" USING btree ("order_id");