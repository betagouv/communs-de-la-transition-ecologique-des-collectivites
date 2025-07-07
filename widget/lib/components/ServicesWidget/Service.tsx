import Button from "@codegouvfr/react-dsfr/Button";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import { useEffect, useState } from "react";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import IFrameResized from "./IFrameResized.tsx";
import Input from "@codegouvfr/react-dsfr/Input";
import { Collectivite, ExtraFields, Service as ServiceType } from "./types.ts";
import { usePostExtraFields, useTrackEvent } from "./queries.ts";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { useStyles } from "./Service.style.ts";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import { IdType } from "@communs/shared";

interface ServiceProps {
  service: ServiceType;
  projectExtraFields: ExtraFields;
  isStagingEnv?: boolean;
  projectId: string;
  collectivite: Collectivite;
  debug?: boolean;
  idType: IdType;
}

export const Service = ({
  service,
  projectExtraFields,
  isStagingEnv,
  projectId,
  collectivite,
  debug,
  idType,
}: ServiceProps) => {
  const { classes } = useStyles();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const maxDescriptionLength = isMobile ? 200 : 400;
  const [expanded, setExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const { mutate: postExtraFields } = usePostExtraFields();
  const { mutate: trackEvent } = useTrackEvent();

  const descriptionTruncated = descriptionExpanded
    ? service.description
    : truncateDescription(service.description, maxDescriptionLength);

  const {
    name,
    description,
    iframeUrl,
    redirectionUrl,
    redirectionLabel,
    extendLabel,
    extraFields,
    logoUrl,
    isListed,
    sousTitre,
  } = service;

  const missingExtraFields = (extraFields || []).filter(
    (field) => !projectExtraFields.some((projectExtraField) => projectExtraField.name === field.name),
  );

  const needsAccordion = iframeUrl && missingExtraFields.length === 0;

  const handleInputChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (field: { name: string; label: string }) => {
    const fieldValue = fieldValues[field.name];
    if (!fieldValue) return;

    postExtraFields({
      postExtraFielsPayload: {
        projectId,
        fieldName: field.name,
        fieldValue,
      },
      isStagingEnv: Boolean(isStagingEnv),
      idType: idType,
    });

    setExpanded(true);
  };

  useEffect(() => {
    // we only track this event when no debug mode
    // to not overload the throttle on the API
    if (!debug) {
      trackEvent({ action: "Affichage du service", name, options: { isStagingEnv } });
    }
  }, [debug, isStagingEnv, name, trackEvent]);

  const toggleDescription = () => {
    setDescriptionExpanded(!descriptionExpanded);
  };

  return (
    <div className={classNames(classes.container)} key={name}>
      <div className={classNames(fr.cx("fr-m-2w"))}>
        <div className={classes.card}>
          <div className={classes.logoContainer}>
            <img className={classes.logo} src={logoUrl} alt=""></img>
          </div>
          <div className={classes.mainContent}>
            <div className={classes.titleContainer}>
              <span className={classNames(fr.cx("fr-text--md"))}>{name}</span>
              {debug && (
                <Badge small severity={`${isListed ? "success" : "warning"}`}>
                  {isListed ? "Publié" : "Non publié"}
                </Badge>
              )}
            </div>
            <span className={classes.sousTitre}>{sousTitre}</span>
            <span style={{ whiteSpace: "pre-wrap" }} className={fr.cx("fr-text--sm")}>
              {descriptionTruncated}
            </span>

            {description.length > maxDescriptionLength && (
              <Button
                className={classes.toggleDescriptionBtn}
                priority="tertiary no outline"
                onClick={toggleDescription}
                size={"small"}
              >
                <span className={fr.cx("fr-text--xs")}>{descriptionExpanded ? "Voir moins" : "Voir plus"}</span>
                <span
                  className={fr.cx(descriptionExpanded ? "fr-icon-arrow-up-s-line" : "fr-icon-arrow-down-s-line")}
                />
              </Button>
            )}
          </div>

          <div>
            {redirectionUrl && (
              <Button
                className={classes.redirectionBtn}
                linkProps={{
                  href: redirectionUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  onClick: () =>
                    trackEvent({ action: "Clic sur le l'url de redirection", name, options: { isStagingEnv } }),
                }}
                priority="tertiary no outline"
              >
                {redirectionLabel ?? "Etre accompagné"}
              </Button>
            )}
          </div>
        </div>
      </div>
      {missingExtraFields.length > 0 && (
        <div className={classNames(fr.cx("fr-m-2w"), classes.extraFields)}>
          <span className={fr.cx("fr-text--sm")}>
            Les champs suivants sont manquants pour afficher les données liées au projet
          </span>
          <div className={classes.extraFieldsForm}>
            {missingExtraFields.map((field) => (
              <div key={field.name} className={classes.extraFields}>
                <Input
                  label={field.label}
                  nativeInputProps={{
                    value: fieldValues[field.name] || "",
                    onChange: (e) => handleInputChange(field.name, e.target.value),
                  }}
                />
                <Button onClick={() => handleSubmit(field)}>Valider</Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {needsAccordion && (
        <Accordion
          label={extendLabel ?? "Voir le détail"}
          onExpandedChange={(value) => {
            trackEvent({
              action: value ? "Clic sur le collapse" : "Clic sur le expand",
              name,
              options: { isStagingEnv },
            });
            setExpanded((prevValue) => !prevValue);
          }}
          expanded={expanded}
        >
          {/*we keep a fragment as a child to avoid accordion errot*/}
          <></>
        </Accordion>
      )}
      {/*we haved moved iframe out of Accordeon as it prevents the iframe from loading properly. Not sure exactly why, I suspect a timing issue between parent and child page from iframe resizer*/}
      {iframeUrl && expanded && (
        <IFrameResized src={replaceIframeUrlParams(iframeUrl, collectivite, projectExtraFields)} />
      )}
    </div>
  );
};

const truncateDescription = (description: string, maxDescriptionLength: number) =>
  `${description.slice(0, maxDescriptionLength - 3)}${description.length > maxDescriptionLength ? "..." : ""}`;

interface ParamsType {
  collectiviteType: string;
  collectiviteCode: string;
  collectiviteLabel: string;
  //some iframe only support epci
  epciCodeSiren: string | null;
}

export const replaceIframeUrlParams = (
  url: string,
  projectCollectivite: Collectivite,
  projectExtraFields: ExtraFields,
): string => {
  const params: ParamsType = {
    collectiviteType: projectCollectivite.type,
    // there is either an EPCI or a codeInsee
    collectiviteCode: projectCollectivite.type === "EPCI" ? projectCollectivite.siren! : projectCollectivite.codeInsee!,
    collectiviteLabel: projectCollectivite.nom,
    epciCodeSiren: projectCollectivite.codeEpci,
  };

  const result = url.replace(/{(\w+)}/g, (_, key) => {
    if (key in params) {
      const paramValue = params[key as keyof ParamsType];

      // todo for now this has been introduced to handle null epci code from some communes for lvao iframe
      //if no value is available pass empty string to delegate to the iframe to handle the edge case
      return encodeURIComponent(paramValue ?? "");
    }

    const matchingExtraField = projectExtraFields.find((field) => field.name === key);
    return encodeURIComponent(matchingExtraField?.value ?? "");
  });

  return result;
};
