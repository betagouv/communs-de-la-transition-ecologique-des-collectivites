import { FC } from "react";
import styles from "./LevierDetails.module.css";
import { fr } from "@codegouvfr/react-dsfr";

interface EtapeType {
  objectifs: string;
  actions: string[];
}

interface EtapesTypes {
  decision_strategique_et_normes: EtapeType;
  etude: EtapeType;
  infrastructure: EtapeType;
  sensibilisation_et_suivi: EtapeType;
  exemplarité_de_la_collectivite: EtapeType;
}

interface Resource {
  ressource: string;
  description: string;
  lien: string | null;
  etapes_applicables: (keyof EtapesTypes)[];
}

export interface LevierData {
  levier: string;
  etapes_types: EtapesTypes;
  support_ingenierie_financement: Resource[];
  ressources_partenaires: Resource[];
}

const formatEtapeTitle = (etape: string): string => {
  return etape
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const LevierDetails: FC<LevierData> = ({ etapes_types, levier, support_ingenierie_financement }) => {
  const etapeKeys = Object.keys(etapes_types) as (keyof EtapesTypes)[];

  return (
    <div className={styles["fr-levier-container"]}>
      <h1 className={styles["fr-levier-title"]}>{levier}</h1>
      <div className={styles["fr-grid-container"]}>
        <div style={{ gridColumn: 1, gridRow: 1 }}>Objectifs</div>
        <div style={{ gridColumn: 1, gridRow: 2 }}>Action</div>
        <div style={{ gridColumn: 1, gridRow: 3 }}>Support et Ingénierie</div>
        <div style={{ gridColumn: 1, gridRow: 4 }}>Ressources / Partenaires</div>

        {etapeKeys.map((key, index) => (
          <>
            <h6 style={{ gridColumn: index + 2, gridRow: 1 }}>{formatEtapeTitle(key)}</h6>
            <div style={{ gridColumn: index + 2, gridRow: 2 }} className={fr.cx("fr-text--sm")}>
              {etapes_types[key].objectifs}
            </div>

            <div style={{ gridColumn: index + 2, gridRow: 3 }}>
              {etapes_types[key].actions.map((action) => (
                <div key={action} className={fr.cx("fr-text--xs")}>
                  {action}
                </div>
              ))}
            </div>
          </>
        ))}

        {support_ingenierie_financement.map(({ ressource, etapes_applicables, description }) => {
          const columns = {
            decision_strategique_et_normes: 2,
            etude: 3,
            infrastructure: 4,
            sensibilisation_et_suivi: 5,
            exemplarité_de_la_collectivite: 6,
          };

          const columnStart = columns[etapes_applicables[0]];
          const columnEnd = columns[etapes_applicables[etapes_applicables.length - 1]];

          return (
            <div key={ressource} style={{ gridColumn: columnStart, gridRow: 4, gridColumnEnd: columnEnd + 1 }}>
              <span className={fr.cx("fr-text--xs")}>
                {ressource} : {description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LevierDetails;
