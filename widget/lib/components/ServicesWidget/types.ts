import { components } from "../../generated-types.ts";

export type Service = components["schemas"]["ServicesByProjectIdResponse"];

export type ExtraFields = components["schemas"]["ExtraField"][];

export type ProjectData = components["schemas"]["ProjectPublicInfoResponse"];
export type Collectivite = ProjectData["collectivites"][number];

export type IdType = "communId" | "tetId";

export interface ServicesWidgetProps {
  projectId?: string;
  idType?: IdType;

  context?: {
    competences?: string[];
    leviers?: string[];
    phases: string[];
    regions: string[];
  };

  isStagingEnv?: boolean;
  debug?: boolean;
}
