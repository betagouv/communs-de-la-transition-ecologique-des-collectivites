CREATE TABLE IF NOT EXISTS "porteur_referents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"email" text NOT NULL,
	"telephone" text,
	"prenom" text NOT NULL,
	"nom" text NOT NULL,
	CONSTRAINT "porteur_referents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "porteur_referent_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_porteur_referent_id_porteur_referents_id_fk" FOREIGN KEY ("porteur_referent_id") REFERENCES "public"."porteur_referents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "porteur_email_hash";