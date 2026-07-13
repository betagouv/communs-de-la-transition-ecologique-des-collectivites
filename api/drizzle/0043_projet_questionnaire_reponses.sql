-- Réponses d'un projet à un questionnaire spécialisé (AtoutBiodiv…).
--
-- Le PUT des réponses est idempotent : la ligne porte l'INTÉGRALITÉ des réponses connues
-- ({ [questionId]: optionId }), jamais un delta — d'où la clé primaire (projet_id, slug)
-- et non une ligne par réponse. Une question absente du jsonb = non répondue.
--
-- `version` = version de la définition en vigueur à la saisie. Un bump de version ne migre
-- RIEN : à la lecture, les réponses dont la (question, option) n'existe plus dans la
-- définition courante sont simplement écartées (cf. reconcilierReponses).
--
-- Pas de FK vers public.projets : un projet MEC/TeT peut n'exister que dans
-- data_mec/data_tet, sans ligne dans public.projets (cf. GetProjetsService.findOneWithSource).
-- Même parti pris que public.aide_feedbacks.
CREATE TABLE IF NOT EXISTS "projet_questionnaire_reponses" (
  "projet_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "version" integer NOT NULL,
  "reponses" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projet_questionnaire_reponses_projet_id_slug_pk" PRIMARY KEY ("projet_id", "slug")
);

CREATE INDEX IF NOT EXISTS "projet_questionnaire_reponses_projet_idx"
  ON "projet_questionnaire_reponses" ("projet_id");
