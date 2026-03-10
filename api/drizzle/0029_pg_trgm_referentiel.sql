-- Custom migration: pg_trgm + unaccent extensions and search function for referentiel
-- This migration is NOT managed by drizzle-kit generate, it must be applied manually.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION normalize_search(text) RETURNS text AS $$
BEGIN
  RETURN lower(unaccent($1));
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;
--> statement-breakpoint
CREATE INDEX "ref_communes_nom_trgm_idx" ON "ref_communes" USING gin (normalize_search(nom) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "ref_groupements_nom_trgm_idx" ON "ref_groupements" USING gin (normalize_search(nom) gin_trgm_ops);
