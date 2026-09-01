-- Retrait de la feature "extra-fields" (faille YesWeHack #YWH-PGM10356-244 :
-- POST/GET /projets/:id/extra-fields publics → écriture non authentifiée / IDOR
-- sur n'importe quel projet). Les routes sont supprimées côté code.
--
-- La table service_extra_fields est CONSERVÉE (inerte) : elle garde ses 13 lignes
-- légitimes "surface" (widget Bénéfriches, dormant depuis 04/2026). On ne supprime
-- ici que les données injectées par les chercheurs (le report demande lui-même la
-- suppression) et on vide la config extra_fields des service_context pour que plus
-- aucun service n'annonce un champ désormais non remplissable.

DELETE FROM "public"."service_extra_fields"
WHERE "name" IN ('ZZZ-YWH-SECURITY-TEST-please-delete', 'Levi HAckerman');--> statement-breakpoint
UPDATE "public"."service_context"
SET "extra_fields" = ARRAY[]::jsonb[]
WHERE array_length("extra_fields", 1) > 0;
