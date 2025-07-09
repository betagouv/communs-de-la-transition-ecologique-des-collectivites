import { useEffect } from "react";
import {
  useGetProjectExtraFields,
  useGetProjectPublicInfo,
  useGetServicesByProjectId,
  useGetServicesByContext,
  useTrackEvent,
} from "./queries.ts";
import { Service, ServicesWidgetProps, ExtraFields, Collectivite } from "./types.ts";
import { extraFields as fakeExtraFields, project as fakeProjet } from "../../test/stub/project.ts";

interface UseServicesWidgetDataResult {
  services: Service[] | undefined;
  projectCollectivite: Collectivite | undefined;
  extraFields: ExtraFields | undefined;

  isLoading: boolean;
  error: Error | null;
}

export const useServicesWidgetData = ({
  projectId,
  context,
  idType = "communId",
  isStagingEnv,
  debug,
}: ServicesWidgetProps): UseServicesWidgetDataResult => {
  /* there are 2 ways of getting the list of services :
  1) either by providing a projectId which is in our base for plateforms connected to our DB
  like Tet or MEC
  2) by providing a context for the generalist platform not connected to our DB or which have not the
  concept of project (ANCT website, Agir pour la transition, etc)
  */

  const mode: "project" | "context" = projectId ? "project" : "context";
  const needsRealProjectData = mode === "project" && debug !== true;

  const {
    data: servicesDataByProject,
    error: projectError,
    isLoading: isProjectLoading,
  } = useGetServicesByProjectId({ projectId, idType, options: { isStagingEnv, debug, enabled: mode === "project" } });

  const {
    data: servicesDataByContext,
    error: contextError,
    isLoading: isContextLoading,
  } = useGetServicesByContext({ context, options: { isStagingEnv, debug, enabled: mode === "context" } });

  const { data: extraFieldsData } = useGetProjectExtraFields({
    projectId,
    idType,
    options: { isStagingEnv, debug, enabled: needsRealProjectData },
  });

  const { data: firstCollectivite, isLoading: isProjectDataLoading } = useGetProjectPublicInfo({
    projectId: projectId!,
    idType,
    options: { isStagingEnv, debug, enabled: needsRealProjectData },
  });

  const { mutate: trackEvent } = useTrackEvent();

  const servicesData = mode === "project" ? servicesDataByProject : servicesDataByContext;
  const error = mode === "project" ? projectError : contextError;
  const isLoading = mode === "project" ? isProjectLoading && isProjectDataLoading : isContextLoading;

  useEffect(() => {
    if (servicesData) {
      trackEvent({
        action: "Nombre de services affichés",
        name: "Nombre de services affichés",
        value: servicesData.length.toString(),
        options: {
          isStagingEnv,
        },
      });
    }
  }, [isStagingEnv, servicesData, trackEvent]);

  //todo adapt this in future for project Data to be available for context mode. The user will have to select a collectivity in this case
  const collectivite = needsRealProjectData ? firstCollectivite : fakeProjet.collectivites[0];
  const finalExtraFields = needsRealProjectData ? (extraFieldsData ?? []) : fakeExtraFields;

  return {
    services: servicesData,
    projectCollectivite: collectivite,
    extraFields: finalExtraFields,
    isLoading: isLoading || (mode === "project" && isProjectDataLoading),
    error,
  };
};
