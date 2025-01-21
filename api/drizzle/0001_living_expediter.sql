CREATE TABLE "service_context" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid NOT NULL,
	"competences" "competences"[],
	"sous_competences" "sous_competences"[],
	"statuses" "project_status"[],
	"description" text,
	"logo_url" text,
	"redirection_url" text,
	"redirection_label" text,
	"extend_label" text
);
--> statement-breakpoint
ALTER TABLE "services" RENAME COLUMN "url" TO "redirection_url";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "redirection_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "service_context" ADD CONSTRAINT "service_context_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."permission_type";