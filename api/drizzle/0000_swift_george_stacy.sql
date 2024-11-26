CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'READY', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"nom" text NOT NULL,
	"description" text NOT NULL,
	"code_siret" text NOT NULL,
	"porteur_email_hash" text NOT NULL,
	"commune_insee_codes" text[] NOT NULL,
	"budget" integer NOT NULL,
	"forecasted_start_date" text NOT NULL,
	"status" "project_status" NOT NULL
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
