ALTER TABLE "services" RENAME COLUMN "logoUrl" TO "logo_url";--> statement-breakpoint
ALTER TABLE "service_context" ADD COLUMN "iframe_url" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "iframe_url" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "extend_label" text;