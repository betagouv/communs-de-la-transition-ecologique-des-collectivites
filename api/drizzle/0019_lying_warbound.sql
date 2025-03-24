ALTER TABLE "service_context" ALTER COLUMN "competences" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "leviers" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "service_context" ALTER COLUMN "phases" DROP NOT NULL;