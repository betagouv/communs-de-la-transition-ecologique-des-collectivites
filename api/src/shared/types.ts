import { competencesWithSousCompetences, competences, sousCompetences } from "@/shared/const/competences-list";

export type ServiceType = "MEC" | "TeT" | "Recoco";

export type Competence = (typeof competences)[number];
export type Competences = Competence[];

export type SousCompetence = (typeof sousCompetences)[number];
export type SousCompetences = SousCompetence[];

export type CompetenceWithSousCompetence = (typeof competencesWithSousCompetences)[number];
export type CompetencesWithSousCompetences = CompetenceWithSousCompetence[];
