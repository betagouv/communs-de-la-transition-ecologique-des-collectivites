import { leviers } from "@/shared/const/leviers";
import { competenceCodes, competencesFromM57Referentials } from "@/shared/const/competences-list";

export type ServiceType = "MEC" | "TeT" | "Recoco" | "UrbanVitaliz" | "SosPonts" | "FondVert";
export type ServiceTypeIds = "mecId" | "tetId" | "recocoId" | "urbanVitalizId" | "sosPontsId" | "fondVertId";

export type CompetenceCode = (typeof competenceCodes)[number];
export type CompetenceCodes = CompetenceCode[];
export type CompetenceName = (typeof competencesFromM57Referentials)[CompetenceCode];

export type Levier = (typeof leviers)[number];
export type Leviers = Levier[];

export const idTypes = ["communId", "tetId"] as const;
export type IdType = (typeof idTypes)[number];
