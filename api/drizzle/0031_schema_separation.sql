-- Create dedicated PostgreSQL schemas
CREATE SCHEMA IF NOT EXISTS api_referentiel;
CREATE SCHEMA IF NOT EXISTS data_tc_plans;

-- Move referentiel tables to api_referentiel and drop ref_ prefix
ALTER TABLE public.ref_groupement_competences SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_groupement_competences RENAME TO groupement_competences;

ALTER TABLE public.ref_perimetres SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_perimetres RENAME TO perimetres;

ALTER TABLE public.ref_competences SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_competences RENAME TO competences;

ALTER TABLE public.ref_competence_categories SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_competence_categories RENAME TO competence_categories;

ALTER TABLE public.ref_groupements SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_groupements RENAME TO groupements;

ALTER TABLE public.ref_communes SET SCHEMA api_referentiel;
ALTER TABLE api_referentiel.ref_communes RENAME TO communes;

-- Move TC plans/fiches tables to data_tc_plans
ALTER TABLE public.fiches_action_to_plans_transition SET SCHEMA data_tc_plans;
ALTER TABLE public.fiches_action SET SCHEMA data_tc_plans;
ALTER TABLE public.plans_transition SET SCHEMA data_tc_plans;

-- Note: fiche_action_statut enum stays in public schema (cross-schema enum reference)
