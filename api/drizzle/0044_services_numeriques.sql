-- Catalogue des services numériques (benchmark DINUM « API Projets »).
--
-- Table DISTINCTE de public.services à dessein : `services` est le catalogue du widget, mais
-- elle porte AUSSI `data_scopes`, et la doctrine d'accès aux données y résout les droits d'une
-- plateforme appelante par `services.name = serviceType` (cf. TerritoiresService.getServiceScopes
-- et docs/api/DOCTRINE_ACCES_DONNEES.md). Y verser le catalogue DINUM casserait ce mécanisme.
--
-- `classification` : les 3 axes du schéma commun (thématiques/sites/interventions), dans les
-- mêmes taxonomies fermées que les projets, les aides et les questionnaires — c'est ce qui
-- permet de réutiliser le même moteur de score.
-- `phases` : poids de pertinence par phase projet, dérivé des colonnes « Phase : … » du
-- benchmark (Oui=1, Un peu=0.5, Non=0). Une phase absente ne pénalise pas le service.
--
-- Alimentée par scripts/import-benchmark-dinum (ré-exécutable : upsert sur `slug`).
CREATE TABLE IF NOT EXISTS "services_numeriques" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,

  "nom" text NOT NULL,
  "baseline" text,
  "description" text,
  "description_longue" text,
  "logo_url" text,
  "operateur" text,
  "redirection_url" text,
  "redirection_libelle" text,
  "iframe_url" text,
  "iframe_libelle" text,

  "categories" text[] DEFAULT '{}' NOT NULL,
  "niveau_expertise" text,
  "thematique_principale" text,

  "a_integrer_mec" text,
  "presentation_generique" text,

  "classification" jsonb NOT NULL,
  "phases" jsonb DEFAULT '{}'::jsonb NOT NULL,

  "nature" text,
  "beta" boolean,
  "ecosysteme_public" boolean,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "services_numeriques_slug_unique" UNIQUE ("slug")
);

CREATE INDEX IF NOT EXISTS "services_numeriques_a_integrer_mec_idx"
  ON "services_numeriques" ("a_integrer_mec");
