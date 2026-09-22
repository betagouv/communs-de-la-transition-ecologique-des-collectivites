-- Vue de référence PCAET POSSÉDÉE (étape 2 du découplage ETL du pont).
-- Remplace schema_commun_v2.pcaet_reference (matview ETL, hors de notre contrôle, périmée)
-- par une vue non-matérialisée bâtie sur NOS schémas :
--   - live     = data_tet.plans_transition        (webhook TeT ; SIREN + tet_collectivite_id + plan external_id)
--   - snapshot = snapshot_tet_api.plans           (SIREN résolu + collectivite_id + plan_id — deep-link)
--   - opendata = data_tc_plans.plans_transition   (SIREN ; pas d'ids de deep-link)
-- + api_referentiel pour l'expansion en communes.
--
-- Dédup par SIREN porteur, priorité live > snapshot > opendata. On expose un couple deep-link
-- COHÉRENT (plan_id + collectivite_id du MÊME plan représentatif = le plus prioritaire), pour
-- construire /collectivite/:collectiviteId/plans/:planId.

CREATE SCHEMA IF NOT EXISTS "pcaet";--> statement-breakpoint

CREATE OR REPLACE VIEW "pcaet"."reference" AS
WITH src AS (
  -- live : webhook TeT (data_tet). plan_id = external_id TeT ; collectivite_id = tet_collectivite_id.
  SELECT
    p.collectivite_responsable_siren AS siren,
    p.nom AS nom,
    'live'::text AS canal,
    ei.external_id AS plan_id,
    p.tet_collectivite_id AS collectivite_id,
    p.territoire_communes AS tc
  FROM data_tet.plans_transition p
  LEFT JOIN data_tet.external_ids ei
    ON ei.objet_id = p.id AND ei.service_type = 'TeT' AND ei.objet_type = 'plan_transition'
  WHERE p.type IN ('PCAET', 'Plan Climat Air Énergie Territorial')
    AND p.collectivite_responsable_siren ~ '^[0-9]{9}$'
  UNION ALL
  -- snapshot : snapshot_tet_api (SIREN résolu à la reconstruction). Porte les 2 ids du deep-link.
  SELECT
    s.siren AS siren,
    s.plan_nom AS nom,
    'snapshot'::text AS canal,
    s.plan_id::text AS plan_id,
    s.collectivite_id::text AS collectivite_id,
    NULL::text[] AS tc
  FROM snapshot_tet_api.plans s
  WHERE s.plan_type IN ('PCAET', 'Plan Climat Air Énergie Territorial')
    AND s.siren ~ '^[0-9]{9}$'
  UNION ALL
  -- opendata : data_tc_plans (pas d'ids de deep-link).
  SELECT
    o.collectivite_responsable_siren AS siren,
    o.nom AS nom,
    'opendata'::text AS canal,
    NULL::text AS plan_id,
    NULL::text AS collectivite_id,
    o.territoire_communes AS tc
  FROM data_tc_plans.plans_transition o
  WHERE o.type IN ('PCAET', 'Plan Climat Air Énergie Territorial')
    AND o.collectivite_responsable_siren ~ '^[0-9]{9}$'
),
ranked AS (
  SELECT src.*, CASE canal WHEN 'live' THEN 0 WHEN 'snapshot' THEN 1 ELSE 2 END AS pri
  FROM src
),
-- Plan représentatif par SIREN : le plus prioritaire (live > snapshot > opendata).
-- Son plan_id + collectivite_id forment le couple deep-link cohérent (mêmes ids = même plan).
rep AS (
  SELECT DISTINCT ON (siren) siren, nom, canal AS source_nom, plan_id, collectivite_id
  FROM ranked
  ORDER BY siren, pri, nom
),
-- Communes portées explicitement par un plan (live/opendata) du SIREN.
plan_communes AS (
  SELECT DISTINCT siren, unnest(tc) AS commune FROM src WHERE tc IS NOT NULL
)
SELECT
  rep.siren AS siren_porteur,
  rep.nom,
  rep.source_nom,
  -- Alias tet_external_id conservé (= plan_id) pour compat ; collectivite_id ajouté pour le deep-link.
  rep.plan_id AS tet_external_id,
  rep.collectivite_id,
  ARRAY(
    SELECT DISTINCT c FROM (
      SELECT pc.commune AS c FROM plan_communes pc WHERE pc.siren = rep.siren
      UNION
      SELECT pe.code_insee_commune FROM api_referentiel.perimetres pe WHERE pe.siren_groupement = rep.siren
      UNION
      SELECT co.code_insee FROM api_referentiel.communes co WHERE co.siren = rep.siren
    ) x WHERE c IS NOT NULL AND c <> ''
  ) AS communes
FROM rep;
