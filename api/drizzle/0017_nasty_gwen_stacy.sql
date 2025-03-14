CREATE TYPE "public"."etape_statut" AS ENUM('En cours', 'En retard', 'En pause', 'Bloqué', 'Abandonné', 'Terminé');--> statement-breakpoint
CREATE TYPE "public"."projet_etapes" AS ENUM('Idée', 'Etude', 'Opération');--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "etape" "projet_etapes";--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "etapeStatut" "etape_statut";--> statement-breakpoint
ALTER TABLE "service_context" ADD COLUMN "etapes" "projet_etapes"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projets" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "service_context" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."projet_status";