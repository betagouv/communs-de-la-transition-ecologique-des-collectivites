-- Delta migration: copy MEC projects added to public.projets AFTER the initial migration
-- Safe to run multiple times (INSERT ... WHERE NOT EXISTS)
--
-- Usage:
--   psql $DATABASE_URL -f scripts/migrate-projets-to-data-mec-delta.sql
--
-- Run this RIGHT AFTER MEC merges the /mec/v1/ MR to catch any projects
-- that arrived between the initial migration and the endpoint switch.

BEGIN;

-- 1. Copy new projects not yet in data_mec
INSERT INTO data_mec.projets_operationnels (
  id, nom, description, budget_previsionnel, date_debut,
  phase, phase_statut, collectivite_responsable_siren,
  porteur_operationnel_siret, territoire_communes,
  competences_m57, leviers_sgpe, programmes_rattachement,
  classification_thematiques, classification_sites, classification_interventions,
  classification_scores, probabilite_te, content_hash,
  created_at, updated_at
)
SELECT
  p.id, p.nom, p.description,
  p.budget_previsionnel,
  p.date_debut_previsionnelle,
  p.phase::text, p."phaseStatut"::text,
  (SELECT c.siren FROM public.projets_to_collectivites ptc
   JOIN public.collectivites c ON c.id = ptc.collectivite_id
   WHERE ptc.projet_id = p.id LIMIT 1),
  p.code_siret,
  (SELECT array_agg(c.code_insee) FROM public.projets_to_collectivites ptc
   JOIN public.collectivites c ON c.id = ptc.collectivite_id
   WHERE ptc.projet_id = p.id AND c.code_insee IS NOT NULL),
  p.competences, p.leviers,
  CASE WHEN p.programme IS NOT NULL AND p.programme != ''
       THEN string_to_array(p.programme, ',') ELSE NULL END,
  p.classification_thematiques, p.classification_sites, p.classification_interventions,
  p.classification_scores,
  CASE WHEN p.probabilite_te IS NOT NULL AND p.probabilite_te != ''
       THEN p.probabilite_te::double precision ELSE NULL END,
  p.content_hash, p.created_at, p.updated_at
FROM public.projets p
WHERE p.mec_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM data_mec.projets_operationnels d WHERE d.id = p.id
  );

-- 2. Copy missing external_ids
INSERT INTO data_mec.external_ids (objet_id, service_type, external_id)
SELECT p.id, 'MEC', p.mec_id
FROM public.projets p
WHERE p.mec_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM data_mec.external_ids e
    WHERE e.objet_id = p.id AND e.service_type = 'MEC'
  );

-- 3. Also update existing projects that may have been modified
-- (content_hash changed in public.projets since initial copy)
UPDATE data_mec.projets_operationnels d
SET
  nom = p.nom,
  description = p.description,
  budget_previsionnel = p.budget_previsionnel,
  phase = p.phase::text,
  phase_statut = p."phaseStatut"::text,
  classification_thematiques = p.classification_thematiques,
  classification_sites = p.classification_sites,
  classification_interventions = p.classification_interventions,
  classification_scores = p.classification_scores,
  probabilite_te = CASE WHEN p.probabilite_te IS NOT NULL AND p.probabilite_te != ''
                        THEN p.probabilite_te::double precision ELSE d.probabilite_te END,
  content_hash = p.content_hash,
  updated_at = p.updated_at
FROM public.projets p
WHERE p.id = d.id
  AND p.mec_id IS NOT NULL
  AND p.content_hash != d.content_hash;

-- 4. Report
DO $$
DECLARE
  src_count INTEGER;
  dst_count INTEGER;
  ext_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO src_count FROM public.projets WHERE mec_id IS NOT NULL;
  SELECT COUNT(*) INTO dst_count FROM data_mec.projets_operationnels;
  SELECT COUNT(*) INTO ext_count FROM data_mec.external_ids WHERE service_type = 'MEC';

  RAISE NOTICE '=== Delta migration complete ===';
  RAISE NOTICE '  Source (public.projets MEC): % rows', src_count;
  RAISE NOTICE '  data_mec.projets_operationnels: % rows', dst_count;
  RAISE NOTICE '  data_mec.external_ids: % rows', ext_count;

  IF src_count != dst_count OR src_count != ext_count THEN
    RAISE WARNING '  ⚠ Count mismatch — check for orphaned records';
  ELSE
    RAISE NOTICE '  ✓ Counts match';
  END IF;
END $$;

COMMIT;
