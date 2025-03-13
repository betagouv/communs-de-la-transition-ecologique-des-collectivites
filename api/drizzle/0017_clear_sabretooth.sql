CREATE TYPE "public"."etape_status" AS ENUM('En cours', 'En retard', 'En pause', 'Bloquée', 'Abandonnée', 'Terminée');--> statement-breakpoint
CREATE TYPE "public"."projet_etapes" AS ENUM('Idée', 'Etudes', 'Opération');--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "etapes" "projet_etapes";--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "etapeStatus" "etape_status";--> statement-breakpoint
ALTER TABLE "service_context" ADD COLUMN "etapes" "projet_etapes"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projets" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "service_context" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."projet_status";