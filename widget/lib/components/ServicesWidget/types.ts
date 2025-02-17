import { components } from "../../generated-types.ts";

export type ServiceType = components["schemas"]["ServicesByProjectIdResponse"];

export interface ServicesWidgetProps {
  projectId: string;
  isStagingEnv?: boolean;
}
