import { fr } from "@codegouvfr/react-dsfr";
import classNames from "classnames";
import { Service } from "./Service.tsx";
import styles from "./InternalServicesWidget.module.css";
import {
  useGetProjectExtraFields,
  useGetProjectPublicInfo,
  useGetServicesByProjectId,
  useGetServicesByContext,
  useTrackEvent,
} from "./queries.ts";
import { Service as ServiceType, ServicesWidgetProps } from "./types.ts";
import { useEffect } from "react";
import { extraFields as fakeExtraFields, project as fakeProjet } from "../../test/stub/project.ts";

export const InternalServicesWidget = ({
  projectId,
  context,
  idType = "communId",
  isStagingEnv,
  debug,
}: ServicesWidgetProps) => {
  const {
    data: servicesDataByProject,
    error: projectError,
    isLoading: isProjectLoading,
  } = useGetServicesByProjectId({ projectId, idType, options: { isStagingEnv, debug } });

  const {
    data: servicesDataByContext,
    error: contextError,
    isLoading: isContextLoading,
  } = useGetServicesByContext(context, { isStagingEnv, debug });

  const servicesData = projectId ? servicesDataByProject : servicesDataByContext;
  const error = projectId ? projectError : contextError;
  const isLoading = projectId ? isProjectLoading : isContextLoading;

  const { data: extraFieldsData } = useGetProjectExtraFields({ projectId, idType, options: { isStagingEnv, debug } });

  const { data: projectData, isLoading: isProjectDataLoading } = useGetProjectPublicInfo({
    projectId: projectId!,
    idType,
    options: { isStagingEnv, debug },
  });

  const { mutate: trackEvent } = useTrackEvent();

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

  // do not display anything while we don't know if there are any services or there are no services
  // and if we don't have related info for the project (only in mode projet)
  if (
    isLoading ||
    (projectId && isProjectDataLoading) ||
    !servicesData?.length ||
    (projectId && !projectData && !debug)
  )
    return null;

  if (error) return <div>Error: {error.message}</div>;

  // todo for the context mode, this need to be addressed to properly display service that rely on extra field or public info from project
  //  since we're not in a project context
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const needsFakeData = (projectId && debug) || (context && !projectId);

  return (
    <div className={classNames(fr.cx("fr-container", "fr-p-3w", "fr-pt-4w"), styles.container)}>
      <h2 className={classNames(fr.cx("fr-h6", "fr-mb-2w"), styles.title)}>Services</h2>
      <span className={fr.cx("fr-text--sm")}>
        {projectId ? (
          <>
            Ces services sont en lien avec les <strong>thématiques, l&apos;état d&apos;avancement</strong> ainsi que
            la&nbsp;
            <strong>localisation</strong> de votre projet.
          </>
        ) : (
          <>
            Ces services correspondent aux <strong>compétences, leviers et phases</strong> que vous avez sélectionnés.
          </>
        )}
      </span>
      <div
        className={classNames(fr.cx("fr-mt-3w"), styles.services)}
        role="list"
        aria-label="Liste des services disponibles"
      >
        {servicesData.map((service: ServiceType) => (
          <div key={`${service.name}-${service.description}`} role="listitem">
            <Service
              key={`${service.id}-${service.description}`}
              service={service}
              // projectData is always defined if not in debug mode (only in mode projet)
              projectData={needsFakeData ? fakeProjet : projectData!}
              projectExtraFields={needsFakeData ? fakeExtraFields : (extraFieldsData ?? [])}
              isStagingEnv={isStagingEnv}
              projectId={projectId!}
              debug={debug}
              idType={idType}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
