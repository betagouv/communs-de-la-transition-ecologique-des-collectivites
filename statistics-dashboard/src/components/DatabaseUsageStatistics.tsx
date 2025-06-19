import { fr } from "@codegouvfr/react-dsfr";
import Tile from "@codegouvfr/react-dsfr/Tile";
import styles from "./StatisticsCards.module.css";
import classNames from "classnames";

// Types temporaires - à définir selon les besoins futurs
interface DatabaseStats {
  totalProjects?: number;
  totalServices?: number;
  activeUsers?: number;
  apiCalls?: number;
}

interface DatabaseUsageStatisticsProps {
  data?: DatabaseStats;
  isLoading?: boolean;
}

export function DatabaseUsageStatistics({ data, isLoading = false }: DatabaseUsageStatisticsProps) {
  // todo Placeholder for now, will be replaced by real data
  const placeholderStats = [
    {
      title: "Nombre total de projets",
      value: data?.totalProjects ?? "24K",
      description: "Projets stockés dans la base de données",
    },
    {
      title: "Services référencés",
      value: data?.totalServices ?? "53",
      description: "Nombre de services disponibles",
    },
    {
      title: "Appels API (à venir)",
      value: data?.apiCalls ?? "-",
      description: "Nombre d'appels API ce mois",
      isUnderDev: true,
    },
  ];

  return (
    <div className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h2", "fr-mb-4w")}>2) Statistiques API et base de données</h2>

      {isLoading ? (
        <div className={fr.cx("fr-mt-4w")}>Chargement des statistiques de base de données...</div>
      ) : (
        <>
          <div className={fr.cx("fr-mb-4w")}>
            <p className={fr.cx("fr-text--sm")}>
              Les statistiques ci-dessous montrent l&#39;utilisation de notre API et base de données.
              {!data && " (Données en cours de développement)"}
            </p>
          </div>

          <div className={classNames(fr.cx("fr-mt-4w"), styles.container)}>
            {placeholderStats.map(({ title, value, description, isUnderDev }) => (
              <div
                key={title}
                style={{
                  width: 360,
                }}
              >
                <Tile
                  orientation="vertical"
                  title={String(value)}
                  desc={title}
                  titleAs="h2"
                  detail={description}
                  classes={{
                    title: "fr-h1",
                  }}
                  grey={isUnderDev}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
