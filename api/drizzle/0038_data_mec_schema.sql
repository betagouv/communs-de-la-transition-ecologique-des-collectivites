-- Create data_mec schema tables for dedicated MEC ingestion
-- Note: data_mec schema already exists with a VIEW called 'projets' — drop it first

DROP VIEW IF EXISTS "data_mec"."projets";

-- External IDs (same pattern as data_tet)
CREATE TABLE "data_mec"."external_ids" (
  "objet_id" uuid NOT NULL,
  "service_type" text NOT NULL,
  "external_id" text NOT NULL,
  CONSTRAINT "data_mec_external_ids_pk" PRIMARY KEY ("objet_id", "service_type")
);
CREATE INDEX "mec_external_ids_external_idx" ON "data_mec"."external_ids" ("service_type", "external_id");

-- Plans de transition (schema v0.2)
CREATE TABLE "data_mec"."plans_transition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX "mec_plans_siren_idx" ON "data_mec"."plans_transition" ("collectivite_responsable_siren");

-- Projets opérationnels (schema v0.2 + classification LLM + CRTE + MEC-specific)
CREATE TABLE "data_mec"."projets_operationnels" (
  "id" uuid PRIMARY KEY,
  -- Schema v0.2 fields
  "nom" text NOT NULL,
  "description" text,
  "budget_previsionnel" integer,
  "date_debut" text,
  "date_fin" text,
  "phase" text,
  "phase_statut" text,
  "collectivite_responsable_siren" text,
  "porteur_operationnel_siret" text,
  "territoire_communes" text[],
  "competences_m57" text[],
  "leviers_sgpe" text[],
  "programmes_rattachement" text[],
  "localisation_latitude" double precision,
  "localisation_longitude" double precision,
  "localisation_adresse" text,
  "localisation_ban_id" text,
  -- Classification v0.2
  "classification_thematiques" text[],
  "classification_sites" text[],
  "classification_interventions" text[],
  -- Classification LLM
  "classification_scores" jsonb,
  "probabilite_te" double precision,
  -- CRTE first-class
  "crte_id" text,
  "crte_annee_inscription" integer,
  "crte_orientation_strategique" text,
  -- MEC-specific
  "source_mec" text,
  "pcaet_operation_inscrite" boolean,
  "fnv_thematiques" text,
  "mots_cles" text,
  "besoins" text,
  "plan_rattachement" text,
  "source_metadata" jsonb,
  -- Lifecycle
  "content_hash" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "mec_projets_siren_idx" ON "data_mec"."projets_operationnels" ("collectivite_responsable_siren");
CREATE INDEX "mec_projets_crte_idx" ON "data_mec"."projets_operationnels" ("crte_id");
CREATE INDEX "mec_projets_source_mec_idx" ON "data_mec"."projets_operationnels" ("source_mec");

-- Junction N:N projets <-> plans
CREATE TABLE "data_mec"."projets_to_plans" (
  "projet_id" uuid NOT NULL REFERENCES "data_mec"."projets_operationnels"("id"),
  "plan_transition_id" uuid NOT NULL REFERENCES "data_mec"."plans_transition"("id"),
  CONSTRAINT "data_mec_projets_to_plans_pk" PRIMARY KEY ("projet_id", "plan_transition_id")
);
