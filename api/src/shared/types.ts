import { leviers } from "@/shared/const/leviers";
import { competenceCodes } from "@/shared/const/competences-list-v2";

export type ServiceType = "MEC" | "TeT" | "Recoco";

export type CompetenceCode = (typeof competenceCodes)[number];
export type Competences = CompetenceCode[];

export type Levier = (typeof leviers)[number];
export type Leviers = Levier[];
