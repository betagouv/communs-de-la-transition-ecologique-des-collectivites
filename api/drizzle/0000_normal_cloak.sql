CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'READY', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insee_code" text NOT NULL,
	CONSTRAINT "communes_insee_code_unique" UNIQUE("insee_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "porteur_referents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"telephone" text,
	"prenom" text,
	"nom" text,
	CONSTRAINT "porteur_referents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"nom" text NOT NULL,
	"description" text NOT NULL,
	"code_siret" text NOT NULL,
	"porteur_referent_id" uuid,
	"budget" integer NOT NULL,
	"forecasted_start_date" text NOT NULL,
	"status" "project_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects_to_communes" (
	"project_id" uuid NOT NULL,
	"commune_id" uuid NOT NULL
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
 ALTER TABLE "projects" ADD CONSTRAINT "projects_porteur_referent_id_porteur_referents_id_fk" FOREIGN KEY ("porteur_referent_id") REFERENCES "public"."porteur_referents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
