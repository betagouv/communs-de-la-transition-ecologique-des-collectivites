ALTER TABLE "projects" ALTER COLUMN "code_siret" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "porteur_referents" ADD COLUMN "fonction" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "porteur" text;