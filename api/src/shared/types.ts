import { leviers } from "@/shared/const/leviers";
import { competenceCodes } from "@/shared/const/competences-list";

export type ServiceType = "MEC" | "TeT" | "Recoco";
export type ServiceTypeIds = "mecId" | "tetId" | "recocoId";

export type CompetenceCode = (typeof competenceCodes)[number];
export type CompetenceCodes = CompetenceCode[];

export type Levier = (typeof leviers)[number];
export type Leviers = Levier[];

export const idTypes = ["communId", "tetId"] as const;
export type IdType = (typeof idTypes)[number];
