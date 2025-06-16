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
      title: "Navigation vers le service",
      value: data.navigationToService,
    },
    {
      title: "Affichage iframe des services",
      value: data.serviceIframeDisplays,
    },
    {
      title: "Nombre de service affichés par projet",
      value: data.servicesDisplayedPerProject,
    },
  ];

  return (
    <div className={classNames(fr.cx("fr-mt-4w"), styles.container)}>
      {cards.map(({ title, value }) => (
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
            classes={{
              title: "fr-h1",
            }}
          />
        </div>
      ))}
    </div>
  );
}
