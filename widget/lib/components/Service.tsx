import styles from "./Service.module.css";
import Button from "@codegouvfr/react-dsfr/Button";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import { useState } from "react";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import IFrameResized from "./IFrameResized.tsx";
import LevierDetails, { LevierData } from "./LevierDetails.tsx";
import voiture_electrique from "../leviers/voiture_electrique.json";

interface ServiceProps {
  id: string;
  name: string;
  description: string;
  iframeUrl?: string;
  logoUrl: string;
  redirectionUrl?: string;
  customRedirectionUrl?: string;
  redirectionLabel?: string;
  extendLabel?: string;
}

export const Service = ({
  name,
  description,
  iframeUrl,
  logoUrl,
  redirectionUrl,
  redirectionLabel,
  extendLabel,
}: ServiceProps) => {
  const [expanded, setExpanded] = useState(false);

  const isLevier = name === "Levier_SGPE";
  const needsAccordion = isLevier || iframeUrl;
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
