-- Doctrine d'accès aux données, base consolidée (/consultation/v1) : les lignes `interne`
-- (CRTE, Fonds Vert et DGCL internes…) sont réservées aux services porteurs du scope
-- `interne_etat` (CONSOLIDATED_INTERNAL_SCOPE). Sans ce scope, un appelant ne voit que
-- l'`ouvert` et le `public_sans_licence`.
--
-- Turgot (serviceType "Turgot") est un service de l'État habilité : on lui donne le
-- scope. Le scope est résolu par `services.name = serviceType` ; Turgot n'a pas de ligne
-- dans le catalogue du widget, on la crée NON listée (is_listed = false, aucun
-- service_context) pour qu'elle n'apparaisse jamais dans le widget.
--
-- Ré-exécutable : si la ligne existe, on ajoute le scope sans toucher aux autres.
INSERT INTO "services" ("id", "name", "description", "sous_titre", "logo_url", "is_listed", "redirection_url", "data_scopes")
VALUES (
  gen_random_uuid(),
  'Turgot',
  'Service de l''État consommateur de l''API (consultation de la base consolidée). Non listé dans le widget.',
  'Turgot',
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
