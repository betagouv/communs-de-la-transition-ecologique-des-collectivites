import { competences } from "@/shared/const/competences-list";

export type ServiceType = "MEC" | "TeT" | "Recoco";

export type Competence = (typeof competences)[number];
export type Competences = Competence[];
