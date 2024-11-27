CREATE TABLE IF NOT EXISTS "communes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insee_code" text NOT NULL,
	CONSTRAINT "communes_insee_code_unique" UNIQUE("insee_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects_to_communes" (
	"project_id" uuid NOT NULL,
	"commune_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "porteur_referents" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "porteur_referents" DROP COLUMN IF EXISTS "created_at";--> statement-breakpoint
ALTER TABLE "porteur_referents" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "commune_insee_codes";