CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'READY', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communes" (
	"insee_code" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"nom" text NOT NULL,
	"description" text NOT NULL,
	"porteur" text,
	"code_siret" text,
	"porteur_referent_email" text,
	"porteur_referent_telephone" text,
	"porteur_referent_prenom" text,
	"porteur_referent_nom" text,
	"porteur_referent_fonction" text,
	"budget" integer NOT NULL,
	"forecasted_start_date" text NOT NULL,
	"status" "project_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects_to_communes" (
	"project_id" uuid NOT NULL,
	"commune_id" text NOT NULL,
	CONSTRAINT "projects_to_communes_project_id_commune_id_pk" PRIMARY KEY("project_id","commune_id"),
	CONSTRAINT "projects_to_communes_commune_id_project_id_unique" UNIQUE("commune_id","project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"logoUrl" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_commune_id_communes_insee_code_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("insee_code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;