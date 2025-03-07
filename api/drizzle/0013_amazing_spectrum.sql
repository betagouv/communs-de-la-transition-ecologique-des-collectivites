ALTER TYPE "public"."project_status" RENAME TO "projet_status";--> statement-breakpoint
ALTER TABLE "projects" RENAME TO "projets";--> statement-breakpoint
ALTER TABLE "projects_to_collectivites" RENAME TO "projets_to_collectivites";--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" RENAME COLUMN "project_id" TO "projet_id";--> statement-breakpoint
ALTER TABLE "service_extra_fields" RENAME COLUMN "project_id" TO "projet_id";--> statement-breakpoint
ALTER TABLE "projets" DROP CONSTRAINT "projects_mec_id_unique";--> statement-breakpoint
ALTER TABLE "projets" DROP CONSTRAINT "projects_tet_id_unique";--> statement-breakpoint
ALTER TABLE "projets" DROP CONSTRAINT "projects_recoco_id_unique";--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" DROP CONSTRAINT "projects_to_collectivites_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" DROP CONSTRAINT "projects_to_collectivites_collectivite_id_collectivites_id_fk";
--> statement-breakpoint
ALTER TABLE "service_extra_fields" DROP CONSTRAINT "service_extra_fields_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "collectivite_project_idx";--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" DROP CONSTRAINT "projects_to_collectivites_project_id_collectivite_id_pk";--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "status" SET DATA TYPE projet_status[];--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" ADD CONSTRAINT "projets_to_collectivites_projet_id_collectivite_id_pk" PRIMARY KEY("projet_id","collectivite_id");--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" ADD CONSTRAINT "projets_to_collectivites_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projets_to_collectivites" ADD CONSTRAINT "projets_to_collectivites_collectivite_id_collectivites_id_fk" FOREIGN KEY ("collectivite_id") REFERENCES "public"."collectivites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_extra_fields" ADD CONSTRAINT "service_extra_fields_projet_id_projets_id_fk" FOREIGN KEY ("projet_id") REFERENCES "public"."projets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collectivite_projet_idx" ON "projets_to_collectivites" USING btree ("collectivite_id","projet_id");--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_mec_id_unique" UNIQUE("mec_id");--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_tet_id_unique" UNIQUE("tet_id");--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_recoco_id_unique" UNIQUE("recoco_id");