-- Référentiel : départements et régions, avec le SIREN de leur collectivité.
--
-- Sources (scripts/seed-referentiel) : codes et noms de geo.api.gouv.fr, SIREN du référentiel
-- des collectivités ZLV (data.gouv.fr). Remplies par le seed, comme les autres tables du schéma.
-- SIREN = collectivité qui exerce les compétences du territoire : collectivité unique pour la
-- Corse, la Martinique, la Guyane et Mayotte, Collectivité européenne d'Alsace pour 67 et 68.
CREATE TABLE IF NOT EXISTS "api_referentiel"."regions" (
  "code" varchar(3) PRIMARY KEY NOT NULL,
  "nom" text NOT NULL,
  "siren" varchar(9)
);

CREATE TABLE IF NOT EXISTS "api_referentiel"."departements" (
  "code" varchar(3) PRIMARY KEY NOT NULL,
  "nom" text NOT NULL,
  "code_region" varchar(3) NOT NULL REFERENCES "api_referentiel"."regions"("code"),
  "siren" varchar(9)
);

CREATE INDEX IF NOT EXISTS "ref_departements_region_idx" ON "api_referentiel"."departements" ("code_region");
