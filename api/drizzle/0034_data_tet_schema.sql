CREATE SCHEMA "data_tet";
--> statement-breakpoint
CREATE TABLE "data_tet"."fiches_action" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tet_id" text NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"statut" text,
	"budget_previsionnel" integer,
	"date_debut_previsionnelle" text,
	"parent_tet_id" text,
	"porteur_referent_nom" text,
	"porteur_referent_email" text,
	"porteur_referent_telephone" text,
	"collectivite_type" text,
	"collectivite_code" text,
	"classification_thematiques" text[],
	"classification_sites" text[],
	"classification_interventions" text[],
	"probabilite_te" text,
	"classification_scores" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fiches_action_tet_id_unique" UNIQUE("tet_id")
);
--> statement-breakpoint
CREATE TABLE "data_tet"."fiches_action_to_plans" (
	"fiche_action_id" uuid NOT NULL,
	"plan_transition_id" uuid NOT NULL,
	CONSTRAINT "fiches_action_to_plans_fiche_action_id_plan_transition_id_pk" PRIMARY KEY("fiche_action_id","plan_transition_id")
);
--> statement-breakpoint
CREATE TABLE "data_tet"."plans_transition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tet_id" text NOT NULL,
	"nom" text,
	"type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_transition_tet_id_unique" UNIQUE("tet_id")
);
--> statement-breakpoint
ALTER TABLE "data_tet"."fiches_action_to_plans" ADD CONSTRAINT "fiches_action_to_plans_fiche_action_id_fiches_action_id_fk" FOREIGN KEY ("fiche_action_id") REFERENCES "data_tet"."fiches_action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_tet"."fiches_action_to_plans" ADD CONSTRAINT "fiches_action_to_plans_plan_transition_id_plans_transition_id_fk" FOREIGN KEY ("plan_transition_id") REFERENCES "data_tet"."plans_transition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tet_fiches_tet_id_idx" ON "data_tet"."fiches_action" USING btree ("tet_id");--> statement-breakpoint
CREATE INDEX "tet_fiches_parent_idx" ON "data_tet"."fiches_action" USING btree ("parent_tet_id");--> statement-breakpoint
CREATE INDEX "tet_plans_tet_id_idx" ON "data_tet"."plans_transition" USING btree ("tet_id");