-- Migration: public.projets (MEC) → data_mec.projets_operationnels + external_ids
--
-- This is a one-time SQL migration script to copy MEC project data
-- from the legacy shared table to the dedicated data_mec schema.
-- Preserves UUIDs, classifications, and content hashes.
--
-- Prerequisites:
--   - data_mec schema and tables must exist (migration 0038)
--   - data_mec tables must be empty (or run the TRUNCATE below)
--
-- Usage:
--   psql $DATABASE_URL -f scripts/migrate-projets-to-data-mec.sql
--
-- After running:
--   1. Verify counts match
--   2. MEC team runs backfill-communs-crte.ts to PATCH CRTE fields
--   3. Switch pipeline schema_commun_v2 to read from data_mec

BEGIN;

-- Safety: clear data_mec tables if re-running
TRUNCATE data_mec.projets_to_plans CASCADE;
TRUNCATE data_mec.external_ids CASCADE;
TRUNCATE data_mec.projets_operationnels CASCADE;
TRUNCATE data_mec.plans_transition CASCADE;

-- 1. Copy projects
INSERT INTO data_mec.projets_operationnels (
  id,
  nom,
  description,
  budget_previsionnel,
  date_debut,
  phase,
  phase_statut,
  collectivite_responsable_siren,
  porteur_operationnel_siret,
  territoire_communes,
  competences_m57,
  leviers_sgpe,
  programmes_rattachement,
  classification_thematiques,
  classification_sites,
  classification_interventions,
  classification_scores,
  probabilite_te,
  content_hash,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.nom,
  p.description,
  p.budget_previsionnel,  -- bigint, keep as-is
  p.date_debut_previsionnelle,
  p.phase::text,
  p."phaseStatut"::text,
  -- Resolve collectivite SIREN (first collectivite linked)
  (
    SELECT c.siren
    FROM public.projets_to_collectivites ptc
    JOIN public.collectivites c ON c.id = ptc.collectivite_id
    WHERE ptc.projet_id = p.id
    LIMIT 1
  ),
  p.code_siret,
  -- Resolve territoire communes (all linked collectivite code_insee)
  (
    SELECT array_agg(c.code_insee)
    FROM public.projets_to_collectivites ptc
    JOIN public.collectivites c ON c.id = ptc.collectivite_id
    WHERE ptc.projet_id = p.id AND c.code_insee IS NOT NULL
  ),
  p.competences,
  p.leviers,
  -- programme is comma-separated text → split into array
  CASE
    WHEN p.programme IS NOT NULL AND p.programme != ''
    THEN string_to_array(p.programme, ',')
    ELSE NULL
  END,
  p.classification_thematiques,
  p.classification_sites,
  p.classification_interventions,
  p.classification_scores,
  CASE
    WHEN p.probabilite_te IS NOT NULL AND p.probabilite_te != ''
    THEN p.probabilite_te::double precision
    ELSE NULL
  END,
  p.content_hash,
  p.created_at,
  p.updated_at
FROM public.projets p
WHERE p.mec_id IS NOT NULL;

-- 2. Populate external_ids
INSERT INTO data_mec.external_ids (objet_id, service_type, external_id)
SELECT p.id, 'MEC', p.mec_id
FROM public.projets p
WHERE p.mec_id IS NOT NULL;

-- 3. Verify counts
DO $$
DECLARE
  src_count INTEGER;
  dst_count INTEGER;
  ext_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO src_count FROM public.projets WHERE mec_id IS NOT NULL;
  SELECT COUNT(*) INTO dst_count FROM data_mec.projets_operationnels;
  SELECT COUNT(*) INTO ext_count FROM data_mec.external_ids WHERE service_type = 'MEC';

  RAISE NOTICE '=== Migration complete ===';
  RAISE NOTICE '  Source (public.projets WHERE mec_id IS NOT NULL): % rows', src_count;
  RAISE NOTICE '  Destination (data_mec.projets_operationnels): % rows', dst_count;
  RAISE NOTICE '  External IDs (data_mec.external_ids): % rows', ext_count;

  IF src_count != dst_count THEN
    RAISE EXCEPTION 'Count mismatch! Source: %, Destination: %', src_count, dst_count;
  END IF;

  IF src_count != ext_count THEN
    RAISE EXCEPTION 'External IDs count mismatch! Source: %, External IDs: %', src_count, ext_count;
  END IF;

  RAISE NOTICE '  ✓ Counts match';
END $$;

COMMIT;
