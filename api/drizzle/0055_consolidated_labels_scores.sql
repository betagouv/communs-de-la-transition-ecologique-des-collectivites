-- Scores de classification de la base consolidée, versionnés par méthode.
-- Écrit À CÔTÉ de data_projets_consolides.projets (jamais dedans) : un chargement se
-- retire par `DELETE ... WHERE methode_id = <id>`, sans toucher l'existant.
-- Les seuils sont appliqués à la LECTURE (labels_au_seuil), donc ajustables sans rechargement.
--
-- Stockage compact (≈ 1 M de lignes sur une base à l'espace compté) : les labels sont
-- des codes smallint résolus par labels_referentiel, les scores des centièmes. Un jsonb
-- {label: score} par ligne pèserait trois à quatre fois plus.
CREATE SCHEMA IF NOT EXISTS "data_projets_consolides";
--> statement-breakpoint
CREATE TABLE "data_projets_consolides"."labels_methodes" (
  "id" smallint PRIMARY KEY NOT NULL,
  "methode" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "labels_methodes_methode_unique" UNIQUE ("methode")
);
--> statement-breakpoint
-- Nomenclature d'une méthode : code → (famille, label). Familles : thematiques, sites,
-- interventions, nature, leviers, competences (label = code M57, detail = libellé),
-- te (label = global | attenuation | adaptation | biodiversite), bv_<axe> (label = cotation).
CREATE TABLE "data_projets_consolides"."labels_referentiel" (
  "methode_id" smallint NOT NULL REFERENCES "data_projets_consolides"."labels_methodes" ("id") ON DELETE CASCADE,
  "code" smallint NOT NULL,
  "famille" text NOT NULL,
  "label" text NOT NULL,
  "detail" text,
  CONSTRAINT "labels_referentiel_pk" PRIMARY KEY ("methode_id", "code")
);
--> statement-breakpoint
-- Une ligne par texte réellement classifié (les doublons exacts titre + SIREN partagent
-- la même ligne, cf. labels_rattachements). codes[i] a pour score scores[i] / 100.
CREATE TABLE "data_projets_consolides"."labels_scores" (
  "source_projet_id" uuid NOT NULL,
  "methode_id" smallint NOT NULL REFERENCES "data_projets_consolides"."labels_methodes" ("id") ON DELETE CASCADE,
  "codes" smallint[] NOT NULL,
  "scores" smallint[] NOT NULL,
  CONSTRAINT "labels_scores_pk" PRIMARY KEY ("source_projet_id", "methode_id"),
  CONSTRAINT "labels_scores_longueurs_ok" CHECK (cardinality("codes") = cardinality("scores"))
);
--> statement-breakpoint
-- Chaque projet de la base → la ligne classifiée dont il partage le texte.
CREATE TABLE "data_projets_consolides"."labels_rattachements" (
  "projet_id" uuid NOT NULL,
  "methode_id" smallint NOT NULL REFERENCES "data_projets_consolides"."labels_methodes" ("id") ON DELETE CASCADE,
  "source_projet_id" uuid NOT NULL,
  CONSTRAINT "labels_rattachements_pk" PRIMARY KEY ("projet_id", "methode_id")
);
--> statement-breakpoint
-- Scores d'une ligne sous forme lisible : {famille: {label: score}}.
CREATE FUNCTION "data_projets_consolides"."labels_scores_lisibles"(p_methode_id smallint, p_codes smallint[], p_scores smallint[])
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_object_agg(f.famille, f.labels), '{}'::jsonb)
  FROM (
    SELECT r.famille, jsonb_object_agg(r.label, round(u.score / 100.0, 2)) AS labels
    FROM unnest(p_codes, p_scores) AS u(code, score)
    JOIN "data_projets_consolides"."labels_referentiel" r ON r.methode_id = p_methode_id AND r.code = u.code
    GROUP BY r.famille
  ) f
$$;
--> statement-breakpoint
-- Labels d'un objet {label: score} au-dessus d'un seuil, du plus fort au plus faible.
CREATE FUNCTION "data_projets_consolides"."labels_au_seuil"(scores jsonb, seuil double precision)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(e.key ORDER BY e.value::double precision DESC, e.key), '{}'::text[])
  FROM jsonb_each_text(coalesce(scores, '{}'::jsonb)) AS e
  WHERE e.value::double precision >= seuil
$$;
--> statement-breakpoint
-- Label de plus fort score d'un objet {label: score} (familles à choix unique).
CREATE FUNCTION "data_projets_consolides"."label_dominant"(scores jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT e.key
  FROM jsonb_each_text(coalesce(scores, '{}'::jsonb)) AS e
  ORDER BY e.value::double precision DESC, e.key
  LIMIT 1
$$;
--> statement-breakpoint
-- Lecture au seuil PROVISOIRE de 0,5 (non calibré : à réviser une fois le jeu de
-- référence humain figé). Colonnes alignées sur celles de data_projets_consolides.projets ;
-- `scores` donne le détail pour qui veut appliquer un autre seuil.
CREATE VIEW "data_projets_consolides"."labels_seuil_provisoire" AS
SELECT
  r."projet_id",
  m."methode",
  r."source_projet_id",
  l."scores",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'thematiques', 0.5) AS "classification_thematiques",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'sites', 0.5) AS "classification_sites",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'interventions', 0.5) AS "classification_interventions",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'leviers', 0.5) AS "leviers",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'competences', 0.5) AS "competences_m57",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'nature') AS "nature",
  (l."scores" -> 'nature' ->> "data_projets_consolides"."label_dominant"(l."scores" -> 'nature'))::real AS "nature_confiance",
  (l."scores" -> 'te' ->> 'global')::real AS "te_global",
  (l."scores" -> 'te' ->> 'attenuation')::real AS "te_attenuation",
  (l."scores" -> 'te' ->> 'adaptation')::real AS "te_adaptation",
  (l."scores" -> 'te' ->> 'biodiversite')::real AS "te_biodiversite",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_attenuation') AS "bv_attenuation_cotation",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_adaptation') AS "bv_adaptation_cotation",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_eau') AS "bv_eau_cotation",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_circulaire') AS "bv_circulaire_cotation",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_pollution') AS "bv_pollution_cotation",
  "data_projets_consolides"."label_dominant"(l."scores" -> 'bv_biodiversite') AS "bv_biodiversite_cotation"
FROM "data_projets_consolides"."labels_rattachements" r
JOIN "data_projets_consolides"."labels_scores" s
  ON s."source_projet_id" = r."source_projet_id" AND s."methode_id" = r."methode_id"
JOIN "data_projets_consolides"."labels_methodes" m ON m."id" = r."methode_id"
CROSS JOIN LATERAL (
  SELECT "data_projets_consolides"."labels_scores_lisibles"(s."methode_id", s."codes", s."scores") AS "scores"
) l;
