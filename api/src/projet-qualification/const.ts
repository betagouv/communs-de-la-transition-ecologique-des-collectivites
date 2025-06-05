import { CompetenceCode, Levier } from "@/shared/types";

export const PROJECT_QUALIFICATION_QUEUE_NAME = "project-qualification";
export const PROJECT_QUALIFICATION_COMPETENCES_JOB = "project-qualification-competences-job";
export const PROJECT_QUALIFICATION_LEVIERS_JOB = "project-qualification-leviers-job";
export const COMPETENCE_SCORE_TRESHOLD = 0.7;
export const LEVIER_SCORE_TRESHOLD = 0.7;

export type QualificationJobType =
  | typeof PROJECT_QUALIFICATION_COMPETENCES_JOB
  | typeof PROJECT_QUALIFICATION_LEVIERS_JOB;

export interface LeviersResult {
  projet: string;
  classification: string | null;
  leviers: Partial<Record<Levier, number>>;
  raisonnement: string | null;
  errorMessage: string;
}

interface Competence {
  competence: string;
  sous_competence: string;
  code: CompetenceCode;
  score: number;
}

export interface CompetencesResult {
  projet: string;
  competences: Competence[];
  errorMessage: string;
}
