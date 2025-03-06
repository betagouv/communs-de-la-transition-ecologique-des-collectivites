CREATE TYPE "public"."collectivite_type" AS ENUM('Commune', 'EPCI');--> statement-breakpoint
CREATE TABLE "collectivites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"type" "collectivite_type" NOT NULL,
	"code_insee" text,
	"code_departements" text[],
	"code_regions" text[],
	"code_epci" text,
	"siren" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collectivites_code_epci_unique" UNIQUE("code_epci"),
	CONSTRAINT "collectivites_siren_unique" UNIQUE("siren")
);
--> statement-breakpoint
CREATE TABLE "projects_to_collectivites" (
	"project_id" uuid NOT NULL,
	"collectivite_id" uuid NOT NULL,
	CONSTRAINT "projects_to_collectivites_project_id_collectivite_id_pk" PRIMARY KEY("project_id","collectivite_id")
);
--> statement-breakpoint
ALTER TABLE "projects_to_collectivites" ADD CONSTRAINT "projects_to_collectivites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects_to_collectivites" ADD CONSTRAINT "projects_to_collectivites_collectivite_id_collectivites_id_fk" FOREIGN KEY ("collectivite_id") REFERENCES "public"."collectivites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collectivite_project_idx" ON "projects_to_collectivites" USING btree ("collectivite_id","project_id");