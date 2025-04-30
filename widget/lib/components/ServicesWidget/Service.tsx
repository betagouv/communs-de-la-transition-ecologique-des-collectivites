import Button from "@codegouvfr/react-dsfr/Button";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import { useEffect, useState } from "react";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import IFrameResized from "./IFrameResized.tsx";
import LevierDetails, { LevierData } from "./LevierDetails.tsx";
import voiture_electrique from "../../leviers_data/voiture_electrique.json";
import Input from "@codegouvfr/react-dsfr/Input";
import { ExtraFields, ServiceType } from "./types.ts";
import { usePostExtraFields } from "./queries.ts";
import { trackEvent } from "../../matomo/trackEvent.ts";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { useStyles } from "./Service.style.ts";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";

interface ServiceProps {
  service: ServiceType;
  projectExtraFields: ExtraFields;
  isStagingEnv?: boolean;
  projectId: string;
  debug?: boolean;
}

export const Service = ({ service, projectExtraFields, isStagingEnv, projectId, debug }: ServiceProps) => {
  const { classes } = useStyles();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const maxDescriptionLength = isMobile ? 200 : 400;
  const [expanded, setExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const { mutate: postExtraFields } = usePostExtraFields();

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
  const isLevier = name === "Levier_SGPE";

  const missingExtraFields = (extraFields || []).filter(
    (field) => !projectExtraFields.some((projectExtraField) => projectExtraField.name === field.name),
  );
  const needsAccordion = (isLevier || iframeUrl) && missingExtraFields.length === 0;

  const handleInputChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (field: { name: string; label: string }) => {
    const fieldValue = fieldValues[field.name];
    if (!fieldValue) return;

    postExtraFields({
      postExtraFielsPayload: {
        fieldName: field.name,
        fieldValue,
        projectId,
      },
      isStagingEnv: Boolean(isStagingEnv),
    });

    setExpanded(true);
  };

  useEffect(() => {
    trackEvent({ action: "Affichage du service", name, isStagingEnv });
  }, [isStagingEnv, name]);

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
            <span className={fr.cx("fr-text--sm")}>{descriptionTruncated}</span>

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
                  onClick: () => trackEvent({ action: "Clic sur le l'url de redirection", name, isStagingEnv }),
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
            trackEvent({ action: value ? "Clic sur le collapse" : "Clic sur le expand", name, isStagingEnv });
            setExpanded((prevValue) => !prevValue);
          }}
          expanded={expanded}
        >
          {isLevier ? <LevierDetails {...(voiture_electrique as LevierData)} /> : null}
          {iframeUrl && <IFrameResized src={replaceUrlParamsDirect(iframeUrl, projectExtraFields)} />}
        </Accordion>
      )}
    </div>
  );
};

// https://facili-tacct-preprod.osc-fr1.scalingo.io/thematiques?code={codeCollectivite}&libelle=Communaut%C3%A9%20d%27agglom%C3%A9ration%20Chauny-Tergnier-La%20F%C3%A8re&type={collectiviteType}

const truncateDescription = (description: string, maxDescriptionLength: number) =>
  `${description.slice(0, maxDescriptionLength - 3)}${description.length > maxDescriptionLength ? "..." : ""}`;

const replaceUrlParamsDirect = (url: string, projectExtraField: ExtraFields): string => {
  return url.replace(/{(\w+)}/g, (_, key) => {
    // check for any extra Fields to be replaced
    const matchingExtraField = projectExtraField.find((field) => field.name === key);

    return matchingExtraField?.value ?? `{${key}}`;
  });
};
