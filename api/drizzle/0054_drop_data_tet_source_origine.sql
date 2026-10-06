-- Colonne ajoutée à la main en prod (hors migrations), absente des autres environnements,
-- lue par aucun code et plus alimentée depuis avril 2026. IF EXISTS : sans effet ailleurs.
ALTER TABLE "data_tet"."fiches_action" DROP COLUMN IF EXISTS "source_origine";
