import { fr } from "@codegouvfr/react-dsfr";
import classNames from "classnames";
import { Service } from "./Service.tsx";
import styles from "./InternalServicesWidget.module.css";
import { useGetProjectExtraFields, useGetProjectPublicInfo, useGetServicesByProjectId } from "./queries.ts";
import { ServicesWidgetProps } from "./types.ts";
import { useEffect } from "react";
import { trackEvent } from "../../matomo/trackEvent.ts";
import { project as fakeProjet } from "../../test/stub/project.ts";
import { extraFields as fakeExtraFields } from "../../test/stub/project.ts";

export const InternalServicesWidget = ({ projectId, isStagingEnv, debug }: ServicesWidgetProps) => {
  const { data: servicesData, error, isLoading } = useGetServicesByProjectId(projectId, isStagingEnv, debug);
  const { data: extraFieldsData } = useGetProjectExtraFields(projectId, isStagingEnv);
  const { data: projectData, isLoading: isProjectLoading } = useGetProjectPublicInfo(projectId, debug, isStagingEnv);

  useEffect(() => {
    if (servicesData) {
      trackEvent({
        action: "Nombre de services affichés",
        name: "Nombre de services affichés",
        value: servicesData.length,
        isStagingEnv,
      });
    }
  }, [isStagingEnv, servicesData]);

  // do not display anything while we don't know if there are any services or there are no services
  // and if we don't have related info for the project
  if (isLoading || isProjectLoading || !servicesData?.length || (!projectData && !debug)) return null;

  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className={classNames(fr.cx("fr-container", "fr-p-3w", "fr-pt-4w"), styles.container)}>
      <h2 className={classNames(fr.cx("fr-h6", "fr-mb-2w"), styles.title)}>Services</h2>
      <span className={fr.cx("fr-text--sm")}>
        Ces services sont en lien avec les <strong>thématiques, l’état d’avancement</strong> ainsi que la&nbsp;
        <strong>localisation</strong> de votre projet.
      </span>
      <div className={classNames(fr.cx("fr-mt-3w"), styles.services)}>
        {servicesData.map((service) => (
          <Service
            key={`${service.id}-${service.description}`}
            service={service}
            // projectData is always defined if not in debug mode
            projectData={debug ? fakeProjet : projectData!}
            projectExtraFields={debug ? fakeExtraFields : (extraFieldsData ?? [])}
            isStagingEnv={isStagingEnv}
            projectId={projectId}
            debug={debug}
          />
        ))}
      </div>
    </div>
  );
};
