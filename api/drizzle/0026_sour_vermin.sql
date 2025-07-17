ALTER TABLE "projets" ADD COLUMN "urban_vitaliz_id" text;--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "sos_ponts_id" text;--> statement-breakpoint
ALTER TABLE "projets" ADD COLUMN "fond_vert_id" text;--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_urban_vitaliz_id_unique" UNIQUE("urban_vitaliz_id");--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_sos_ponts_id_unique" UNIQUE("sos_ponts_id");--> statement-breakpoint
ALTER TABLE "projets" ADD CONSTRAINT "projets_fond_vert_id_unique" UNIQUE("fond_vert_id");