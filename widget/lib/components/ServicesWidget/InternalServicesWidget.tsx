import { fr } from "@codegouvfr/react-dsfr";
import classNames from "classnames";
import { Service } from "./Service.tsx";
import styles from "./InternalServicesWidget.module.css";
import { Service as ServiceType, ServicesWidgetProps } from "./types.ts";
import { useServicesWidgetData } from "./useServicesWidgetData.ts";

export const InternalServicesWidget = ({
  projectId,
  context,
  idType = "communId",
  isStagingEnv,
  debug,
}: ServicesWidgetProps) => {
  const {
    services: servicesData,
    projectCollectivite,
    extraFields: extraFieldsData,
    isLoading,
    error,
  } = useServicesWidgetData({
    projectId,
    context,
    idType,
    isStagingEnv,
    debug,
  });

  // do not display anything while we don't know if there are any services or there are no services
  // and if we don't have related info for the project (only in mode projet)
  if (isLoading) return null;

  if (servicesData?.length === 0) return <div>No service displayed</div>;

  //todo see with Mathieu Lejeune a proper error handling design
  if (error) return <div>Error: {error.message}</div>;

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
        {(servicesData ?? []).map((service: ServiceType) => (
          <div key={`${service.name}-${service.description}`} role="listitem">
            <Service
              key={`${service.id}-${service.description}`}
              service={service}
              // collectivite is already handled by the hook (includes fake data when needed)
              collectivite={projectCollectivite!}
              projectExtraFields={extraFieldsData ?? []}
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
