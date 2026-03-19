ALTER TABLE "api_referentiel"."communes" DROP CONSTRAINT "ref_communes_siren_unique";--> statement-breakpoint
ALTER TABLE "api_referentiel"."competences" DROP CONSTRAINT "ref_competences_code_categorie_ref_competence_categories_code_fk";
--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" DROP CONSTRAINT "ref_groupement_competences_siren_groupement_ref_groupements_siren_fk";
--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" DROP CONSTRAINT "ref_groupement_competences_code_competence_ref_competences_code_fk";
--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" DROP CONSTRAINT "ref_perimetres_siren_groupement_ref_groupements_siren_fk";
--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" DROP CONSTRAINT "ref_perimetres_code_insee_commune_ref_communes_code_insee_fk";
--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" DROP CONSTRAINT "ref_groupement_competences_siren_groupement_code_competence_pk";--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" DROP CONSTRAINT "ref_perimetres_siren_groupement_code_insee_commune_pk";--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" ADD CONSTRAINT "groupement_competences_siren_groupement_code_competence_pk" PRIMARY KEY("siren_groupement","code_competence");--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" ADD CONSTRAINT "perimetres_siren_groupement_code_insee_commune_pk" PRIMARY KEY("siren_groupement","code_insee_commune");--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "classification_thematiques" text[];--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "classification_sites" text[];--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "classification_interventions" text[];--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "probabilite_te" text;--> statement-breakpoint
ALTER TABLE "api_referentiel"."competences" ADD CONSTRAINT "competences_code_categorie_competence_categories_code_fk" FOREIGN KEY ("code_categorie") REFERENCES "api_referentiel"."competence_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" ADD CONSTRAINT "groupement_competences_siren_groupement_groupements_siren_fk" FOREIGN KEY ("siren_groupement") REFERENCES "api_referentiel"."groupements"("siren") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_referentiel"."groupement_competences" ADD CONSTRAINT "groupement_competences_code_competence_competences_code_fk" FOREIGN KEY ("code_competence") REFERENCES "api_referentiel"."competences"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" ADD CONSTRAINT "perimetres_siren_groupement_groupements_siren_fk" FOREIGN KEY ("siren_groupement") REFERENCES "api_referentiel"."groupements"("siren") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_referentiel"."perimetres" ADD CONSTRAINT "perimetres_code_insee_commune_communes_code_insee_fk" FOREIGN KEY ("code_insee_commune") REFERENCES "api_referentiel"."communes"("code_insee") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_referentiel"."communes" ADD CONSTRAINT "communes_siren_unique" UNIQUE("siren");