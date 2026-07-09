-- Prédiction LLM des leviers sur les projets MEC (data_mec.projets_operationnels).
--
-- llm_leviers          : jsonb [{ label, score }] (scores [0,1]), prédiction validée
--                        contre le référentiel canonique des leviers. DISTINCT de
--                        leviers_sgpe (déclaratif MEC, historiquement pollué) — jamais
--                        écrasé par une prédiction.
-- llm_leviers_version  : version du modèle/prompt ayant produit la prédiction. Permet un
--                        re-run « prompt v2 » propre (remplacement, pas empilement de
--                        générations). Interne : NON exposée par l'API.
--
-- IF NOT EXISTS OBLIGATOIRE : le script batch de stock (pipeline) peut créer ces colonnes
-- avant le déploiement de l'API — définitions coordonnées, strictement identiques.
ALTER TABLE "data_mec"."projets_operationnels" ADD COLUMN IF NOT EXISTS "llm_leviers" jsonb;
ALTER TABLE "data_mec"."projets_operationnels" ADD COLUMN IF NOT EXISTS "llm_leviers_version" text;
