-- Clés d'API en lecture seule : limitées aux méthodes sûres (GET/HEAD/OPTIONS) par le guard.
-- Sert à ouvrir la prod en lecture à un environnement tiers (préprod TeT) sans droit d'écriture.
ALTER TABLE "api_keys" ADD COLUMN "read_only" boolean DEFAULT false NOT NULL;
