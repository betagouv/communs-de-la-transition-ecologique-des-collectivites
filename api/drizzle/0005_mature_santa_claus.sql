CREATE TABLE "service_extra_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"field_value" text
);
--> statement-breakpoint
ALTER TABLE "service_context" ADD COLUMN "extra_fields" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "service_extra_fields" ADD CONSTRAINT "service_extra_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;