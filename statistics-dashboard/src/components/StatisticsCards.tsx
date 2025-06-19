import type { DashboardData } from "../types";
import styles from "./StatisticsCards.module.css";
import classNames from "classnames";
import Tile from "@codegouvfr/react-dsfr/Tile";
import { fr } from "@codegouvfr/react-dsfr";

interface StatisticsCardsProps {
  data: DashboardData;
}

export function StatisticsCards({ data }: StatisticsCardsProps) {
  const cards = [
    {
      title: "Navigations vers le service",
      value: data.navigationToService,
    },
    {
      title: "Nombre de vues « tableau de bord » consultées",
      value: data.serviceIframeDisplays,
      detail: "Nombre d’aperçus de services référencés dans le module consulté",
    },
    {
      title: "Nombre de services affichés par projet",
      value: data.servicesDisplayedPerProject,
    },
  ];

  return (
    <div className={classNames(fr.cx("fr-mt-4w"), styles.container)}>
      {cards.map(({ title, value, detail }) => (
        <div
          key={title}
          style={{
            width: 360,
          }}
        >
          <Tile
            orientation="vertical"
            title={value}
            desc={title}
            titleAs="h2"
            detail={detail}
            classes={{
              title: "fr-h1",
            }}
          />
        </div>
      ))}
    </div>
  );
}
