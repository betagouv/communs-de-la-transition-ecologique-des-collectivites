import { components } from "../../generated-types.ts";

export type Service = components["schemas"]["ServicesByProjectIdResponse"];

export interface ServicesWidgetProps {
  projectId: string;
  isStagingEnv?: boolean;
  debug?: boolean;
}

export type ExtraFields = components["schemas"]["ExtraField"][];

export type ProjectData = components["schemas"]["ProjectPublicInfoResponse"];
