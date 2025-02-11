import styles from "./Service.module.css";
import Button from "@codegouvfr/react-dsfr/Button";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import { Dispatch, SetStateAction, useState } from "react";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import IFrameResized from "./IFrameResized.tsx";
import LevierDetails, { LevierData } from "./LevierDetails.tsx";
import voiture_electrique from "../leviers/voiture_electrique.json";
import Input from "@codegouvfr/react-dsfr/Input";
import { getApiUrl } from "../utils.ts";

export interface ExtraField {
  fieldName: string;
  fieldValue: string;
}

interface ServiceProps {
  name: string;
  description: string;
  iframeUrl?: string;
  logoUrl: string;
  redirectionUrl?: string;
  customRedirectionUrl?: string;
  redirectionLabel?: string;
  extendLabel?: string;
  extraFields: string[];
  projectExtraFields: ExtraField[];
  isStagingEnv?: boolean;
  projectId: string;
  setProjectExtraFields: Dispatch<SetStateAction<ExtraField[]>>;
}

export const Service = ({
  name,
  description,
  iframeUrl,
  logoUrl,
  redirectionUrl,
  redirectionLabel,
  extendLabel,
  extraFields,
  projectExtraFields,
  isStagingEnv,
  projectId,
  setProjectExtraFields,
}: ServiceProps) => {
  const [expanded, setExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const isLevier = name === "Levier_SGPE";
  const missingExtraFields = (extraFields || []).filter(
    (fieldName) => !projectExtraFields.some((projectExtraField) => projectExtraField.fieldName === fieldName)
  );
  const needsAccordion = (isLevier || iframeUrl) && missingExtraFields.length === 0;

  const handleInputChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (fieldName: string) => {
    const fieldValue = fieldValues[fieldName];
    if (!fieldValue) return;

    try {
      const apiUrl = getApiUrl(isStagingEnv);

      const response = await fetch(`${apiUrl}/projects/${projectId}/extra-fields`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extraFields: [{ fieldName, fieldValue }],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update extra fields");
      }
      // todo this is a hack for now to show the accordion once the update is done
      //  ideally this should be done through cache invalidation to let the backend drive the state      setProjectExtraFields([{ fieldName, fieldValue }]);
      setExpanded(true);
      setProjectExtraFields([{ fieldName, fieldValue }]);
      console.log(`Field ${fieldName} updated successfully`);
    } catch (error) {
      console.error("Error updating extra fields:", error);
    }
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
                label={`${fieldName} de la friche`}
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
          {iframeUrl && <IFrameResized src={iframeUrl} />}
        </Accordion>
      )}
    </div>
  );
};
