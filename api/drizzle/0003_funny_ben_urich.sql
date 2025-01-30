ALTER TABLE "service_context" ALTER COLUMN "competences" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "competences" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "sous_competences" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "sous_competences" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "statuses" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "statuses" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "mec_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tet_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "recoco_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_mec_id_unique" UNIQUE("mec_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tet_id_unique" UNIQUE("tet_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_recoco_id_unique" UNIQUE("recoco_id");