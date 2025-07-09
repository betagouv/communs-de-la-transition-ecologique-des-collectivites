import { components } from "../../generated-types.ts";
import { CompetenceCode, Levier, ProjetPhase, IdType } from "../../shared-types";

export type Service = components["schemas"]["ServicesByProjectIdResponse"];

export type ExtraFields = components["schemas"]["ExtraField"][];

export type ProjectData = components["schemas"]["ProjectPublicInfoResponse"];
export type Collectivite = ProjectData["collectivites"][number];

export interface ServicesWidgetProps {
  projectId?: string;
  idType?: IdType;

  context?: {
    competences?: CompetenceCode[];
    leviers?: Levier[];
    phases: ProjetPhase[];
    regions?: string[];
  };

  isStagingEnv?: boolean;
  debug?: boolean;
}
