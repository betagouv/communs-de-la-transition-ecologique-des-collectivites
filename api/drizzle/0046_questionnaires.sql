-- Définition des questionnaires : contenu (questions, recommandations, conditions) ET règle
-- d'éligibilité (étiquettes requises). Ils vivaient dans le dépôt ; ils deviennent éditables.
--
-- Les garde-fous que le chargeur appliquait au DÉMARRAGE (condition pointant une question
-- inexistante, étiquette hors taxonomie, aucune étiquette requise) sont reconstruits à
-- l'ÉCRITURE, en 400 explicite. Aucun n'a été assoupli : c'était la condition du déplacement.
--
-- Amorçage : `pnpm seed:questionnaires` (upsert depuis src/questionnaires/content/).

CREATE TABLE IF NOT EXISTS "questionnaires" (
	"slug" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source_nom" text NOT NULL,
	"banniere" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"recommandations" jsonb NOT NULL,
	"etiquettes_requises" jsonb NOT NULL,
	"edite_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
