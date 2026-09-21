-- snapshot_tet_api : snapshot des plans publics de TeT, reconstruit par nous
-- (script scripts/rebuild-tet-snapshot). Les tables préexistent en prod (créées hors
-- migrations) ; en test (migrations seules) elles n'existent pas. On rend donc la
-- migration idempotente : CREATE IF NOT EXISTS (no-op en prod, crée en test) puis
-- ajout des colonnes de résolution SIREN dans les deux environnements.

CREATE SCHEMA IF NOT EXISTS "snapshot_tet_api";--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "snapshot_tet_api"."plans" (
	"plan_id" integer PRIMARY KEY NOT NULL,
	"plan_nom" text,
	"plan_type" text,
	"collectivite_id" integer,
	"collectivite_nom" text,
	"contacts" jsonb,
	"fetched_at" timestamp
);--> statement-breakpoint

-- Résolution SIREN du porteur (l'API TeT ne fournit pas le SIREN).
ALTER TABLE "snapshot_tet_api"."plans" ADD COLUMN IF NOT EXISTS "siren" text;--> statement-breakpoint
ALTER TABLE "snapshot_tet_api"."plans" ADD COLUMN IF NOT EXISTS "siren_source" text;--> statement-breakpoint
ALTER TABLE "snapshot_tet_api"."plans" ADD COLUMN IF NOT EXISTS "siren_resolved_at" timestamp with time zone;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "snapshot_tet_plans_siren_idx" ON "snapshot_tet_api"."plans" ("siren");
