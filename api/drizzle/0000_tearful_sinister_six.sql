CREATE TYPE "public"."project_status" AS ENUM('IDEE', 'FAISABILITE', 'EN_COURS', 'IMPACTE', 'ABANDONNE', 'TERMINE');--> statement-breakpoint
CREATE TABLE "communes" (
	"insee_code" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"budget" integer,
	"forecasted_start_date" text,
	"status" "project_status",
	"code_siret" text,
	"porteur_referent_email" text,
	"porteur_referent_telephone" text,
	"porteur_referent_prenom" text,
	"porteur_referent_nom" text,
	"porteur_referent_fonction" text,
	"competences" text[],
	"leviers" text[],
	"mec_id" text,
	"tet_id" text,
	"recoco_id" text,
	CONSTRAINT "projects_mec_id_unique" UNIQUE("mec_id"),
	CONSTRAINT "projects_tet_id_unique" UNIQUE("tet_id"),
	CONSTRAINT "projects_recoco_id_unique" UNIQUE("recoco_id")
);
--> statement-breakpoint
CREATE TABLE "projects_to_communes" (
	"project_id" uuid NOT NULL,
	"commune_id" text NOT NULL,
	CONSTRAINT "projects_to_communes_project_id_commune_id_pk" PRIMARY KEY("project_id","commune_id")
);
--> statement-breakpoint
CREATE TABLE "service_context" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid NOT NULL,
	"competences" text[] DEFAULT '{}' NOT NULL,
	"leviers" text[],
	"statuses" "project_status"[] DEFAULT '{}' NOT NULL,
	"description" text,
	"logo_url" text,
	"redirection_url" text,
	"redirection_label" text,
	"extend_label" text,
	"iframe_url" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"logo_url" text NOT NULL,
	"iframe_url" text,
	"redirection_url" text NOT NULL,
	"redirection_label" text NOT NULL,
	"extend_label" text
);
--> statement-breakpoint
ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_commune_id_communes_insee_code_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("insee_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_context" ADD CONSTRAINT "service_context_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commune_project_idx" ON "projects_to_communes" USING btree ("commune_id","project_id");