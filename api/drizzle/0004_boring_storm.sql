ALTER TABLE "projects" ALTER COLUMN "competences" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "competences" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "sous_competences";--> statement-breakpoint
ALTER TABLE "service_context" DROP COLUMN "sous_competences";