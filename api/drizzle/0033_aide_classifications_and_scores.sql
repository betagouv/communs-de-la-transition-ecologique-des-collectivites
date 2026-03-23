CREATE TABLE "aide_classifications" (
	"id_at" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"classification_scores" jsonb NOT NULL,
	"classified_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "classification_scores" jsonb;