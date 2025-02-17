import styles from "./Service.module.css";
import Button from "@codegouvfr/react-dsfr/Button";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import { useState } from "react";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import IFrameResized from "./IFrameResized.tsx";
import LevierDetails, { LevierData } from "./LevierDetails.tsx";
import voiture_electrique from "../../leviers_data/voiture_electrique.json";
import Input from "@codegouvfr/react-dsfr/Input";
import { ServiceType } from "./types.ts";
import { usePostExtraFields } from "./queries.ts";

export interface ExtraField {
  fieldName: string;
  fieldValue: string;
}

interface ServiceProps {
  service: ServiceType;
  projectExtraFields: ExtraField[];
  isStagingEnv?: boolean;
  projectId: string;
}

export const Service = ({ service, projectExtraFields, isStagingEnv, projectId }: ServiceProps) => {
  const [expanded, setExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const { mutate: postExtraFields } = usePostExtraFields();

  const { name, description, iframeUrl, redirectionUrl, redirectionLabel, extendLabel, extraFields, logoUrl } = service;
  const isLevier = name === "Levier_SGPE";

  const missingExtraFields = (extraFields || []).filter(
    (fieldName) => !projectExtraFields.some((projectExtraField) => projectExtraField.fieldName === fieldName),
  );
  const needsAccordion = (isLevier || iframeUrl) && missingExtraFields.length === 0;

  const handleInputChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (fieldName: string) => {
    const fieldValue = fieldValues[fieldName];
    if (!fieldValue) return;

    postExtraFields({
      postExtraFielsPayload: { fieldName, fieldValue, projectId },
      isStagingEnv: Boolean(isStagingEnv),
    });

    setExpanded(true);
  };

  return (
    <div className={classNames(styles.container)}>
      <div className={classNames(fr.cx("fr-m-2w"), styles.header)}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img className={styles.logo} src={logoUrl} alt=""></img>
          </div>
          <div className={styles.mainHeader}>
            <span className={classNames(fr.cx("fr-text--md"), styles.title)}>{name}</span>
            <span className={classNames(fr.cx("fr-text--sm"), styles.description)}>{description}</span>
          </div>

          {redirectionUrl && (
            <Button
              className={styles.button}
              linkProps={{
                href: redirectionUrl,
                target: "_blank",
                rel: "noopener noreferrer",
              }}
              priority="tertiary no outline"
            >
              {redirectionLabel ?? "Etre accompagné"}
            </Button>
          )}
        </div>
      </div>
      {missingExtraFields.length > 0 && (
        <div className={classNames(fr.cx("fr-m-2w"), styles.extraFields)}>
          <span className={fr.cx("fr-text--sm")}>
            Les champs suivants sont manquants pour afficher les données liées au projet
          </span>
          <div className={styles.extraFieldsForm}>
            {missingExtraFields.map((fieldName) => (
              <Input
                className={fr.cx("fr-text--sm")}
                key={fieldName}
                addon={<Button onClick={() => void handleSubmit(fieldName)}>Enregistrer</Button>}
                label={`${fieldName} de la friche en m2`}
                nativeInputProps={{
                  value: fieldValues[fieldName] ?? "",
                  onChange: (e) => handleInputChange(fieldName, e.target.value),
                }}
              />
            ))}
          </div>
        </div>
      )}
      {needsAccordion && (
        <Accordion
          label={extendLabel ?? "Voir le détail"}
          onExpandedChange={(value) => {
            setExpanded(!value);
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

function replaceUrlParamsDirect(url: string, projectExtraField: { fieldName: string; fieldValue: string }[]): string {
  return url.replace(/{(\w+)}/g, (_, key) => {
    const matchingExtraField = projectExtraField.find((field) => field.fieldName === key);
    return matchingExtraField?.fieldValue ?? `{${key}}`;
  });
}
