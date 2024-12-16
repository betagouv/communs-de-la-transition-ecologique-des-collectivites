import styles from "./Service.module.css";
import Button from "@codegouvfr/react-dsfr/Button";
import IFrameResized from "./IFrameResized.tsx";
import classNames from "classnames";
import { fr } from "@codegouvfr/react-dsfr";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import { useState } from "react";

interface ServiceProps {
  id: string;
  name: string;
  description: string;
  iframeUrl?: string;
  logoUrl: string;
  redirectionUrl: string;
  customRedirectionUrl?: string;
}

export const Service = ({
  name,
  description,
  iframeUrl,
  logoUrl,
  redirectionUrl,
}: ServiceProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={classNames(styles.container)}>
      <div className={classNames(fr.cx("fr-m-2w"), styles.header)}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img className={styles.logo} src={logoUrl} alt=""></img>
          </div>
          <div className={styles.mainHeader}>
            <span className={classNames(fr.cx("fr-text--md"), styles.title)}>
              {name}
            </span>
            <span
              className={classNames(fr.cx("fr-text--sm"), styles.description)}
            >
              {description}
            </span>
          </div>
          <Button
            className={styles.button}
            linkProps={{
              href: redirectionUrl,
              target: "_blank",
              rel: "noopener noreferrer",
            }}
            priority="tertiary no outline"
          >
            {"Etre accompagné"}
          </Button>
        </div>
      </div>
      {iframeUrl && (
        <Accordion
          label="Voir le détail"
          onExpandedChange={(value) => setExpanded(!value)}
          expanded={expanded}
        >
          <IFrameResized src={iframeUrl} />
        </Accordion>
      )}
    </div>
  );
};
