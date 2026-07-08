-- Doctrine d'accès aux données : colonne data_scopes sur public.services.
--
-- public.services est le catalogue du widget (services découvrables), PAS la couche
-- d'authentification (les clés API sont en variables d'environnement). Le scope d'un
-- service appelant est donc résolu par NOM : services.name = serviceType du guard
-- (MEC, TeT, DashboardTE, UrbanVitaliz…). Voir docs/api/DOCTRINE_ACCES_DONNEES.md.
--
-- Vide par défaut ('{}') : aucune donnée restreinte en base aujourd'hui → aucun
-- filtrage, aucune régression. On installe le mécanisme AVANT la donnée.
ALTER TABLE "services" ADD COLUMN "data_scopes" text[] NOT NULL DEFAULT '{}';
