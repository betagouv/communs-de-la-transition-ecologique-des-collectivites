ALTER TABLE "projects" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "name" TO "nom";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "code_siret" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "porteur_email_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "commune_insee_codes" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "forecasted_start_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ownerUserId";