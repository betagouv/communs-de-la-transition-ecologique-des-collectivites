CREATE TABLE "ref_communes" (
	"code_insee" varchar(5) PRIMARY KEY NOT NULL,
	"siren" varchar(9) NOT NULL,
	"siret" varchar(14),
	"nom" text NOT NULL,
	"population" integer,
	"codes_postaux" text[],
	"code_departement" varchar(3),
	"code_region" varchar(3),
	"code_epci" varchar(9),
	CONSTRAINT "ref_communes_siren_unique" UNIQUE("siren")
);
--> statement-breakpoint
CREATE TABLE "ref_competence_categories" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"nom" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_competences" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"code_categorie" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_groupement_competences" (
	"siren_groupement" varchar(9) NOT NULL,
	"code_competence" varchar(10) NOT NULL,
	CONSTRAINT "ref_groupement_competences_siren_groupement_code_competence_pk" PRIMARY KEY("siren_groupement","code_competence")
);
--> statement-breakpoint
CREATE TABLE "ref_groupements" (
	"siren" varchar(9) PRIMARY KEY NOT NULL,
	"siret" varchar(14),
	"nom" text NOT NULL,
	"type" varchar(10) NOT NULL,
	"population" integer,
	"nb_communes" integer,
	"departements" text[],
	"regions" text[],
	"mode_financement" text,
	"date_creation" date
);
--> statement-breakpoint
CREATE TABLE "ref_perimetres" (
	"siren_groupement" varchar(9) NOT NULL,
	"code_insee_commune" varchar(5) NOT NULL,
	"categorie_membre" varchar(20),
	CONSTRAINT "ref_perimetres_siren_groupement_code_insee_commune_pk" PRIMARY KEY("siren_groupement","code_insee_commune")
);
--> statement-breakpoint
ALTER TABLE "ref_competences" ADD CONSTRAINT "ref_competences_code_categorie_ref_competence_categories_code_fk" FOREIGN KEY ("code_categorie") REFERENCES "public"."ref_competence_categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_groupement_competences" ADD CONSTRAINT "ref_groupement_competences_siren_groupement_ref_groupements_siren_fk" FOREIGN KEY ("siren_groupement") REFERENCES "public"."ref_groupements"("siren") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_groupement_competences" ADD CONSTRAINT "ref_groupement_competences_code_competence_ref_competences_code_fk" FOREIGN KEY ("code_competence") REFERENCES "public"."ref_competences"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_perimetres" ADD CONSTRAINT "ref_perimetres_siren_groupement_ref_groupements_siren_fk" FOREIGN KEY ("siren_groupement") REFERENCES "public"."ref_groupements"("siren") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_perimetres" ADD CONSTRAINT "ref_perimetres_code_insee_commune_ref_communes_code_insee_fk" FOREIGN KEY ("code_insee_commune") REFERENCES "public"."ref_communes"("code_insee") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ref_communes_siren_idx" ON "ref_communes" USING btree ("siren");--> statement-breakpoint
CREATE INDEX "ref_communes_departement_idx" ON "ref_communes" USING btree ("code_departement");--> statement-breakpoint
CREATE INDEX "ref_communes_epci_idx" ON "ref_communes" USING btree ("code_epci");--> statement-breakpoint
CREATE INDEX "ref_grp_comp_competence_idx" ON "ref_groupement_competences" USING btree ("code_competence");--> statement-breakpoint
CREATE INDEX "ref_groupements_type_idx" ON "ref_groupements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ref_perimetres_commune_idx" ON "ref_perimetres" USING btree ("code_insee_commune");