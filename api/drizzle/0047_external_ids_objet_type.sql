-- Discriminant de type d'objet dans data_tet.external_ids.
--
-- Côté source (TeT), les ids de fiches et de plans sont des séquences DISTINCTES :
-- un plan peut porter le même external_id qu'une fiche déjà ingérée. Le lookup par
-- (service_type, external_id) seul renvoyait alors l'UUID du mauvais objet →
-- violation FK sur fiches_action_to_plans (webhook 500 en boucle depuis le 23/07),
-- ou upsert de fiche silencieusement perdu dans le sens inverse.
--
-- Backfill : le type se déduit de la table où vit objet_id. Les éventuels mappings
-- orphelins (objet_id dans aucune des deux tables) sont supprimés — 0 en prod au
-- moment de l'écriture. Les doublons (service_type, objet_type, external_id) —
-- 2 paires de fiches en prod, créées par une course sur le même webhook — sont
-- dédoublonnés en gardant la fiche la plus récemment mise à jour ; la fiche
-- surnuméraire reste en base mais n'est plus adressable par external_id.

ALTER TABLE "data_tet"."external_ids" ADD COLUMN "objet_type" text;--> statement-breakpoint
UPDATE "data_tet"."external_ids" e
SET "objet_type" = 'fiche_action'
FROM "data_tet"."fiches_action" f
WHERE f."id" = e."objet_id";--> statement-breakpoint
UPDATE "data_tet"."external_ids" e
SET "objet_type" = 'plan_transition'
FROM "data_tet"."plans_transition" p
WHERE p."id" = e."objet_id" AND e."objet_type" IS NULL;--> statement-breakpoint
DELETE FROM "data_tet"."external_ids" WHERE "objet_type" IS NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT e."objet_id", e."service_type",
         row_number() OVER (
           PARTITION BY e."service_type", e."objet_type", e."external_id"
           ORDER BY f."updated_at" DESC NULLS LAST, e."objet_id" DESC
         ) AS rn
  FROM "data_tet"."external_ids" e
  LEFT JOIN "data_tet"."fiches_action" f ON f."id" = e."objet_id"
)
DELETE FROM "data_tet"."external_ids" e
USING ranked r
WHERE e."objet_id" = r."objet_id" AND e."service_type" = r."service_type" AND r."rn" > 1;--> statement-breakpoint
ALTER TABLE "data_tet"."external_ids" ALTER COLUMN "objet_type" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "data_tet"."tet_external_ids_external_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "tet_external_ids_lookup_uidx" ON "data_tet"."external_ids" ("service_type","objet_type","external_id");
