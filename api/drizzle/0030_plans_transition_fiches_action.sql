CREATE TYPE "public"."fiche_action_statut" AS ENUM('À venir', 'En cours', 'En retard', 'En pause', 'Bloqué', 'Abandonné', 'Terminé');--> statement-breakpoint
CREATE TABLE "fiches_action" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"statut" "fiche_action_statut",
	"collectivite_responsable_siren" text,
	"territoire_communes" text[],
	"classification_thematiques" text[],
	"tc_demarche_id" integer,
	"tc_hash" text,
	"tc_secteurs" text[],
	"tc_types_porteur" text[],
	"tc_volets" text[],
	"tc_type_action" text,
	"tc_cible_action" text,
	CONSTRAINT "fiches_action_tc_hash_unique" UNIQUE("tc_hash")
);
--> statement-breakpoint
CREATE TABLE "fiches_action_to_plans_transition" (
	"fiche_action_id" uuid NOT NULL,
	"plan_transition_id" uuid NOT NULL,
	CONSTRAINT "fiches_action_to_plans_transition_fiche_action_id_plan_transition_id_pk" PRIMARY KEY("fiche_action_id","plan_transition_id")
);
--> statement-breakpoint
CREATE TABLE "plans_transition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"nom" text NOT NULL,
	"type" text,
	"description" text,
	"periode_debut" text,
	"periode_fin" text,
	"collectivite_responsable_siren" text,
	"territoire_communes" text[],
	"tc_demarche_id" integer,
	"tc_version" text,
	"tc_etat" text,
	CONSTRAINT "plans_transition_tc_demarche_id_unique" UNIQUE("tc_demarche_id")
);
--> statement-breakpoint
ALTER TABLE "fiches_action_to_plans_transition" ADD CONSTRAINT "fiches_action_to_plans_transition_fiche_action_id_fiches_action_id_fk" FOREIGN KEY ("fiche_action_id") REFERENCES "public"."fiches_action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiches_action_to_plans_transition" ADD CONSTRAINT "fiches_action_to_plans_transition_plan_transition_id_plans_transition_id_fk" FOREIGN KEY ("plan_transition_id") REFERENCES "public"."plans_transition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiches_action_siren_idx" ON "fiches_action" USING btree ("collectivite_responsable_siren");--> statement-breakpoint
CREATE INDEX "fiches_action_tc_demarche_idx" ON "fiches_action" USING btree ("tc_demarche_id");--> statement-breakpoint
CREATE INDEX "plan_fiche_idx" ON "fiches_action_to_plans_transition" USING btree ("plan_transition_id","fiche_action_id");--> statement-breakpoint
CREATE INDEX "plans_transition_siren_idx" ON "plans_transition" USING btree ("collectivite_responsable_siren");