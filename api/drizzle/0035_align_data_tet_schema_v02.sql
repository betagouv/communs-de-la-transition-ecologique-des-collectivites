-- Align data_tet schema with schema v0.2.0
-- Drop and recreate tables (no production data yet, schema just deployed)

-- Drop existing tables
DROP TABLE IF EXISTS "data_tet"."fiches_action_to_plans";
DROP TABLE IF EXISTS "data_tet"."fiches_action";
DROP TABLE IF EXISTS "data_tet"."plans_transition";

-- Create external_ids table (v0.2 recommendation)
CREATE TABLE "data_tet"."external_ids" (
  "objet_id" uuid NOT NULL,
  "service_type" text NOT NULL,
  "external_id" text NOT NULL,
  CONSTRAINT "external_ids_objet_id_service_type_pk" PRIMARY KEY("objet_id","service_type")
);
--> statement-breakpoint
CREATE INDEX "tet_external_ids_external_idx" ON "data_tet"."external_ids" USING btree ("service_type","external_id");

--> statement-breakpoint
-- Plans de transition (8 champs v0.2)
CREATE TABLE "data_tet"."plans_transition" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nom" text,
  "type" text,
  "description" text,
  "periode_debut" text,
  "periode_fin" text,
  "collectivite_responsable_siren" text,
  "territoire_communes" text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tet_plans_siren_idx" ON "data_tet"."plans_transition" USING btree ("collectivite_responsable_siren");

--> statement-breakpoint
-- Fiches action (11 champs v0.2 + classification + parent)
CREATE TABLE "data_tet"."fiches_action" (
  "id" uuid PRIMARY KEY NOT NULL,
  "nom" text NOT NULL,
  "description" text,
  "objectifs" text,
  "statut" text,
  "competences_m57" text[],
  "leviers_sgpe" text[],
  "collectivite_responsable_siren" text,
  "territoire_communes" text[],
  "classification_thematiques" text[],
  "parent_id" uuid,
  "classification_sites" text[],
  "classification_interventions" text[],
  "probabilite_te" text,
  "classification_scores" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tet_fiches_siren_idx" ON "data_tet"."fiches_action" USING btree ("collectivite_responsable_siren");
--> statement-breakpoint
CREATE INDEX "tet_fiches_parent_idx" ON "data_tet"."fiches_action" USING btree ("parent_id");

--> statement-breakpoint
-- N:N fiches_action <-> plans_transition
CREATE TABLE "data_tet"."fiches_action_to_plans" (
  "fiche_action_id" uuid NOT NULL,
  "plan_transition_id" uuid NOT NULL,
  CONSTRAINT "fiches_action_to_plans_fiche_action_id_plan_transition_id_pk" PRIMARY KEY("fiche_action_id","plan_transition_id")
);
--> statement-breakpoint
ALTER TABLE "data_tet"."fiches_action_to_plans" ADD CONSTRAINT "fiches_action_to_plans_fiche_action_id_fiches_action_id_fk" FOREIGN KEY ("fiche_action_id") REFERENCES "data_tet"."fiches_action"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "data_tet"."fiches_action_to_plans" ADD CONSTRAINT "fiches_action_to_plans_plan_transition_id_plans_transition_id_fk" FOREIGN KEY ("plan_transition_id") REFERENCES "data_tet"."plans_transition"("id") ON DELETE no action ON UPDATE no action;
