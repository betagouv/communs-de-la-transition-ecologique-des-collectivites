-- Lecture en masse des labels au seuil provisoire : même contenu que la vue
-- labels_seuil_provisoire (sans le détail `scores`), mais calculé une fois pour toutes.
-- La vue décode ligne à ligne (~2 ms par projet) : correcte pour une page, trop lente
-- pour une synthèse par collectivité ou un export. Ici le décodage est ensembliste.
--
-- Créée VIDE : le calcul sur ~1 M de lignes prend plusieurs minutes et n'a pas sa place
-- dans une migration de déploiement. À remplir puis à rafraîchir après chaque chargement :
--   REFRESH MATERIALIZED VIEW data_projets_consolides.labels_seuil_provisoire_materialise;
-- (CONCURRENTLY possible une fois remplie, grâce à l'index unique.)
-- Le seuil de 0,5 est figé dans la définition : le changer = nouvelle migration.
CREATE MATERIALIZED VIEW "data_projets_consolides"."labels_seuil_provisoire_materialise" AS
WITH par_texte AS (
  SELECT
    s."source_projet_id",
    s."methode_id",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'thematiques' AND u.score >= 50), '{}'::text[]) AS "classification_thematiques",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'sites' AND u.score >= 50), '{}'::text[]) AS "classification_sites",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'interventions' AND u.score >= 50), '{}'::text[]) AS "classification_interventions",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'leviers' AND u.score >= 50), '{}'::text[]) AS "leviers",
    coalesce(array_agg(ref."label" ORDER BY u.score DESC, ref."label") FILTER (WHERE ref."famille" = 'competences' AND u.score >= 50), '{}'::text[]) AS "competences_m57",
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
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "labels_seuil_provisoire_materialise_pk"
  ON "data_projets_consolides"."labels_seuil_provisoire_materialise" ("projet_id", "methode");
