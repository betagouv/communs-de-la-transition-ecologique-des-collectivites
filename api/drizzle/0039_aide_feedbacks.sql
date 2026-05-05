CREATE TABLE "aide_feedbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projet_id" uuid NOT NULL,
  "id_at" text NOT NULL,
  "feedback" text NOT NULL DEFAULT 'not_relevant',
  "reason" text,
  "source" text DEFAULT 'MEC',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "aide_feedbacks_projet_aide_idx" ON "aide_feedbacks" ("projet_id", "id_at");
CREATE INDEX "aide_feedbacks_projet_idx" ON "aide_feedbacks" ("projet_id");
CREATE INDEX "aide_feedbacks_id_at_idx" ON "aide_feedbacks" ("id_at");
