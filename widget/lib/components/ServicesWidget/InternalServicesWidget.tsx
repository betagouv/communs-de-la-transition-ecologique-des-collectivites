import { fr } from "@codegouvfr/react-dsfr";
import classNames from "classnames";
import { Service } from "./Service.tsx";
import styles from "./InternalServicesWidget.module.css";
import { useGetProject, useGetProjectExtraFields, useGetServicesByProjectId } from "./queries.ts";
import { ServicesWidgetProps } from "./types.ts";
import { useEffect } from "react";
import { trackEvent } from "../../matomo/trackEvent.ts";

export const InternalServicesWidget = ({ projectId, isStagingEnv, debug }: ServicesWidgetProps) => {
  // todo add proper error handling through error boundaries with retry

  const { data: servicesData, error, isLoading } = useGetServicesByProjectId(projectId, isStagingEnv, debug);
  const { data } = useGetProjectExtraFields(projectId, isStagingEnv);
  const { data: projectData } = useGetProject(projectId, isStagingEnv);

  console.log("projectData", projectData);

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
  if (isLoading || !servicesData?.length) return null;

  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className={classNames(fr.cx("fr-container", "fr-p-3w", "fr-pt-4w"), styles.container)}>
      <h2 className={classNames(fr.cx("fr-h6", "fr-mb-2w"), styles.title)}>Services</h2>
      <span className={fr.cx("fr-text--sm")}>
        Ces services sont en lien avec les <strong>thématiques, l’état d’avancement</strong> ainsi que la{" "}
        <strong>localisation</strong> de votre projet.
      </span>
      <div className={classNames(fr.cx("fr-mt-3w"), styles.services)}>
        {servicesData.map((service) => (
          <Service
            key={`${service.id}-${service.description}`}
            service={service}
            projectExtraFields={data?.extraFields ?? []}
            isStagingEnv={isStagingEnv}
            projectId={projectId}
            debug={debug}
          />
        ))}
      </div>
    </div>
  );
};
