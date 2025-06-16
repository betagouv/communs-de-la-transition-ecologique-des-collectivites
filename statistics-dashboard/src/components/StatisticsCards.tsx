import { fr } from "@codegouvfr/react-dsfr";
import type { DashboardData } from "../types";

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
    <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-my-6w")}>
      {cards.map((card, index) => (
        <div key={index} className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <div
            className={fr.cx("fr-p-4w")}
            style={{
              border: "2px solid #ddd",
              borderRadius: "8px",
              textAlign: "center",
              backgroundColor: "#f8f9fa",
            }}
          >
            <h3 className={fr.cx("fr-h6", "fr-mb-2w")}>{card.title}</h3>
            <div
              className={fr.cx("fr-text--xl")}
              style={{
                fontSize: "2.5rem",
                fontWeight: "bold",
                color: "#000091",
              }}
            >
              {card.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
