import { components } from "../../generated-types.ts";
import { CompetenceCodes, IdType, Leviers, ProjetPhase } from "../../shared-types";

export type Service = components["schemas"]["ServicesByProjectIdResponse"];

export type ExtraFields = components["schemas"]["ExtraField"][];

export type ProjectData = components["schemas"]["ProjectPublicInfoResponse"];
export type Collectivite = ProjectData["collectivites"][number];

interface BaseServicesWidgetProps {
  isStagingEnv?: boolean;
  debug?: boolean;
}

interface ProjectModeProps extends BaseServicesWidgetProps {
  idType?: IdType;
  projectId: string;
  context?: never;
}

interface ContextModeProps extends BaseServicesWidgetProps {
  projectId?: never;
  idType?: never;
  context: {
    competences?: CompetenceCodes;
    leviers?: Leviers;
    phases: ProjetPhase[];
    regions?: string[];
  };
}

/**
 * ServicesWidget props - supports two mutually exclusive modes:
 *
 * @example Project Mode
 * ```tsx
 * <ServicesWidget projectId="123" />
 * ```
 *
 * @example Context Mode
 * ```tsx
 * <ServicesWidget context={{ competences: ["90-11"], phases: ["Idée"] }} />
 * ```
 */
export type ServicesWidgetProps = ProjectModeProps | ContextModeProps;
