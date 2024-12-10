ALTER TABLE "public"."projects" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."project_status";--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('IDEE', 'FAISABILITE', 'EN_COURS', 'IMPACTE', 'ABANDONNE', 'TERMINE');--> statement-breakpoint
ALTER TABLE "public"."projects" ALTER COLUMN "status" SET DATA TYPE "public"."project_status" USING "status"::"public"."project_status";