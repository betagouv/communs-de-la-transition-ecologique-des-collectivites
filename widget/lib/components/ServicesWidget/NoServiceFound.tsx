import NoResultImage from "./NoResultImage";
import { fr } from "@codegouvfr/react-dsfr";
import styles from "./NoServiceFound.module.css";
import classNames from "classnames";

const NoServiceFound = () => {
  return (
    <div className={classNames(fr.cx("fr-pt-7w", "fr-pb-4w"), styles.noServiceFound)}>
      <div className={fr.cx("fr-mb-4w")}>
        <NoResultImage />
      </div>
      <div>
        <h6 className={fr.cx("fr-mb-3w")}>Aucun service pertinent identifié</h6>
        <p>Nous travaillons à ajouter de nouveaux services pour couvrir plus de thématiques et de projets.</p>
      </div>
    </div>
  );
};

export default NoServiceFound;
