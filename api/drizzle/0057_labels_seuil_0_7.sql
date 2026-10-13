-- Seuil de lecture relevé de 0,5 à 0,7 pour les thématiques, les leviers et les compétences,
-- après arbitrage du jeu de référence humain (180 cas, 13/10) : à 0,5 la passe Jev
-- sur-labellise (précision 0,25 sur les listes de l'arbitre) ; 0,7 donne le meilleur
-- compromis mesuré (précision 0,42, rappel 0,46).
-- Repli : si aucune thématique n'atteint 0,7, on garde la meilleure si elle atteint 0,5
-- (évite de vider des projets correctement repérés mais avec un score modeste).
-- Sites et interventions (familles à choix unique) restent à 0,5.
--
-- La vue matérialisée est lue par l'API de consultation : elle est reconstruite REMPLIE
-- sous un autre nom puis substituée, pour que l'ancienne reste lisible pendant le calcul
-- (~1 min en prod) et qu'aucune lecture ne tombe sur une vue vide.
SET LOCAL work_mem = '256MB';
--> statement-breakpoint
CREATE OR REPLACE VIEW "data_projets_consolides"."labels_seuil_provisoire" AS
SELECT
  r."projet_id",
  m."methode",
  r."source_projet_id",
  l."scores",
  CASE
    WHEN cardinality("data_projets_consolides"."labels_au_seuil"(l."scores" -> 'thematiques', 0.7)) > 0
      THEN "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'thematiques', 0.7)
    ELSE ("data_projets_consolides"."labels_au_seuil"(l."scores" -> 'thematiques', 0.5))[1:1]
  END AS "classification_thematiques",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'sites', 0.5) AS "classification_sites",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'interventions', 0.5) AS "classification_interventions",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'leviers', 0.7) AS "leviers",
  "data_projets_consolides"."labels_au_seuil"(l."scores" -> 'competences', 0.7) AS "competences_m57",
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
--> statement-breakpoint
CREATE MATERIALIZED VIEW "data_projets_consolides"."labels_seuil_provisoire_materialise_0_7" AS
WITH par_texte AS (
  SELECT
    s."source_projet_id",
    s."methode_id",
    coalesce(
      array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'thematiques' AND u.score >= 70),
      (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'thematiques' AND u.score >= 50))[1:1],
      '{}'::text[]
    ) AS "classification_thematiques",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'sites' AND u.score >= 50), '{}'::text[]) AS "classification_sites",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'interventions' AND u.score >= 50), '{}'::text[]) AS "classification_interventions",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'leviers' AND u.score >= 70), '{}'::text[]) AS "leviers",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'competences' AND u.score >= 70), '{}'::text[]) AS "competences_m57",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'nature'))[1] AS "nature",
    (max(u.score) FILTER (WHERE ref."famille" = 'nature') / 100.0)::real AS "nature_confiance",
    (max(u.score) FILTER (WHERE ref."famille" = 'te' AND ref."label" = 'global') / 100.0)::real AS "te_global",
    (max(u.score) FILTER (WHERE ref."famille" = 'te' AND ref."label" = 'attenuation') / 100.0)::real AS "te_attenuation",
    (max(u.score) FILTER (WHERE ref."famille" = 'te' AND ref."label" = 'adaptation') / 100.0)::real AS "te_adaptation",
    (max(u.score) FILTER (WHERE ref."famille" = 'te' AND ref."label" = 'biodiversite') / 100.0)::real AS "te_biodiversite",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_attenuation'))[1] AS "bv_attenuation_cotation",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_adaptation'))[1] AS "bv_adaptation_cotation",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_eau'))[1] AS "bv_eau_cotation",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_circulaire'))[1] AS "bv_circulaire_cotation",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_pollution'))[1] AS "bv_pollution_cotation",
    (array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'bv_biodiversite'))[1] AS "bv_biodiversite_cotation"
  FROM "data_projets_consolides"."labels_scores" s
  LEFT JOIN LATERAL unnest(s."codes", s."scores") AS u(code, score) ON true
  LEFT JOIN "data_projets_consolides"."labels_referentiel" ref
    ON ref."methode_id" = s."methode_id" AND ref."code" = u.code
  GROUP BY s."source_projet_id", s."methode_id"
)
SELECT
  r."projet_id",
  m."methode",
  r."source_projet_id",
  t."classification_thematiques",
  t."classification_sites",
  t."classification_interventions",
  t."leviers",
  t."competences_m57",
  t."nature",
  t."nature_confiance",
  t."te_global",
  t."te_attenuation",
  t."te_adaptation",
  t."te_biodiversite",
  t."bv_attenuation_cotation",
  t."bv_adaptation_cotation",
  t."bv_eau_cotation",
  t."bv_circulaire_cotation",
  t."bv_pollution_cotation",
  t."bv_biodiversite_cotation"
FROM "data_projets_consolides"."labels_rattachements" r
JOIN par_texte t ON t."source_projet_id" = r."source_projet_id" AND t."methode_id" = r."methode_id"
JOIN "data_projets_consolides"."labels_methodes" m ON m."id" = r."methode_id"
WITH DATA;
--> statement-breakpoint
DROP MATERIALIZED VIEW "data_projets_consolides"."labels_seuil_provisoire_materialise";
--> statement-breakpoint
ALTER MATERIALIZED VIEW "data_projets_consolides"."labels_seuil_provisoire_materialise_0_7"
  RENAME TO "labels_seuil_provisoire_materialise";
--> statement-breakpoint
CREATE UNIQUE INDEX "labels_seuil_provisoire_materialise_pk"
  ON "data_projets_consolides"."labels_seuil_provisoire_materialise" ("projet_id", "methode");
