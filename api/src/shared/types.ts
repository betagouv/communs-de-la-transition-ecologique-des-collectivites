import { competences } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";

export type ServiceType = "MEC" | "TeT" | "Recoco";

export type Competence = (typeof competences)[number];
export type Competences = Competence[];

export type Levier = (typeof leviers)[number];
export type Leviers = Levier[];
