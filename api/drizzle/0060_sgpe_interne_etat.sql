-- Doctrine d'accès aux données, base consolidée (/consultation/v1) : le SGPE (Secrétariat
-- général à la planification écologique, serviceType "SGPE") construit un tableau de bord
-- comparable à celui de Turgot. Service de l'État habilité, il reçoit le même scope
-- `interne_etat` (CONSOLIDATED_INTERNAL_SCOPE), donc les lignes `interne` et l'export
-- `interne_etat`.
--
-- Même schéma que 0057 : le scope est résolu par `services.name = serviceType` ; le SGPE n'a
-- pas de ligne dans le catalogue du widget, on la crée NON listée (is_listed = false, aucun
-- service_context) pour qu'elle n'apparaisse jamais dans le widget.
--
-- Ré-exécutable : si la ligne existe, on ajoute le scope sans toucher aux autres.
INSERT INTO "services" ("id", "name", "description", "sous_titre", "logo_url", "is_listed", "redirection_url", "data_scopes")
VALUES (
  gen_random_uuid(),
  'SGPE',
  'Secrétariat général à la planification écologique, service de l''État consommateur de l''API (consultation de la base consolidée). Non listé dans le widget.',
  'SGPE',
  '',
  false,
  '',
  '{interne_etat}'
)
ON CONFLICT ("name") DO UPDATE
SET "data_scopes" = (
  SELECT array_agg(DISTINCT s ORDER BY s)
  FROM unnest("services"."data_scopes" || '{interne_etat}'::text[]) AS s
);
