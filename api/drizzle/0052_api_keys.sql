-- Clés d'API partenaires en base : plusieurs clés par service, hashées (SHA-256),
-- révocables sans redéploiement. Les clés d'env restent valides (transition).
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY NOT NULL,
  "key_hash" text NOT NULL,
  "service_type" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
