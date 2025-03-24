ALTER TYPE "public"."etape_statut" RENAME TO "phase_statut";--> statement-breakpoint
ALTER TYPE "public"."projet_etapes" RENAME TO "projet_phases";--> statement-breakpoint
ALTER TABLE "projets" RENAME COLUMN "etape" TO "phase";--> statement-breakpoint
ALTER TABLE "projets" RENAME COLUMN "etapeStatut" TO "phaseStatut";--> statement-breakpoint
ALTER TABLE "service_context" RENAME COLUMN "etapes" TO "phases";--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "is_listed" SET NOT NULL;