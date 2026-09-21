-- Id interne de la collectivité côté TeT, fourni par le webhook TeT (collectivites[].collectiviteId).
-- Nécessaire au deep-link MEC→TeT : /collectivite/:tetCollectiviteId/plans/:planId (PCAET, sur le plan)
-- et /collectivite/:tetCollectiviteId/actions/:actionId (fiche action, sur la fiche).
-- Nullable : toutes les sources / tous les payloads ne le portent pas.

ALTER TABLE "data_tet"."fiches_action" ADD COLUMN "tet_collectivite_id" text;--> statement-breakpoint
ALTER TABLE "data_tet"."plans_transition" ADD COLUMN "tet_collectivite_id" text;
