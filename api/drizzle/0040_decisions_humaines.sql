-- Schéma decisions_humaines : journal append-only des décisions humaines (MEC, TeT, DDT, interne)
-- sur les objets du schéma commun. Vit HORS du cycle blue-green de rebuild de schema_commun_v2 :
-- les décisions survivent aux re-runs de l'ETL.
--
-- Invariants applicatifs (non contraints en base) :
--   - append-only : jamais d'UPDATE/DELETE ; une révocation = NOUVEL événement dont
--     la colonne `supersedes` pointe vers l'événement révoqué (le pointeur est sur la
--     nouvelle ligne → aucune ligne existante n'est mutée)
--   - objet_*_id = IDs objets STABLES (UUID sources, cop_*…), JAMAIS un cluster_id
CREATE SCHEMA IF NOT EXISTS "decisions_humaines";

CREATE TABLE "decisions_humaines"."decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "type_decision" text NOT NULL,
  "objet_a_type" text NOT NULL,
  "objet_a_id" text NOT NULL,
  "objet_b_type" text,
  "objet_b_id" text,
  "verdict" text,
  "auteur" text,
  "plateforme_source" text NOT NULL,
  "commentaire" text,
  "payload" jsonb,
  "supersedes" uuid REFERENCES "decisions_humaines"."decisions"("id")
);

CREATE INDEX "decisions_objet_a_idx" ON "decisions_humaines"."decisions" ("objet_a_id");
CREATE INDEX "decisions_objet_b_idx" ON "decisions_humaines"."decisions" ("objet_b_id");
CREATE INDEX "decisions_type_created_idx" ON "decisions_humaines"."decisions" ("type_decision", "created_at");

-- Lecture pour le user readonly de prod (absent des bases locales/e2e → garde conditionnelle)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonlyuser') THEN
    GRANT USAGE ON SCHEMA "decisions_humaines" TO readonlyuser;
    GRANT SELECT ON ALL TABLES IN SCHEMA "decisions_humaines" TO readonlyuser;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "decisions_humaines" GRANT SELECT ON TABLES TO readonlyuser;
  END IF;
END $$;
