import { useState, useEffect } from "react";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { fr } from "@codegouvfr/react-dsfr";
import { StatisticsCards } from "./components/StatisticsCards";
import { InteractionsChart } from "./components/InteractionsChart";
import { PlatformFilter } from "./components/PlatformFilter";
import type { DashboardData } from "./types";
import { getDashboardData } from "./utils/getDashboardData.ts";

function App() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDashboardData(selectedPlatform);
        setDashboardData(data);
        setPlatforms(data.hostingPlatforms);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setError("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [selectedPlatform]);

  return (
    <div className={fr.cx("fr-grid-row")}>
      <div className={fr.cx("fr-col-12")}>
        <Header
          brandTop={
            <>
              République
              <br />
              Française
            </>
          }
          homeLinkProps={{
            href: "/",
            title: "Accueil - Les Communs",
          }}
          serviceTitle="Les Communs de la transition écologique"
          serviceTagline="Tableau de bord des statistiques"
        />

        <div className={fr.cx("fr-p-6w")}>
          <h2 className={fr.cx("fr-h2", "fr-mb-4w")}>1) Statistiques d&#39;usage du module d’aiguillage</h2>

          <PlatformFilter value={selectedPlatform} onChange={setSelectedPlatform} platforms={platforms} />

          {isLoading && <div className={fr.cx("fr-mt-4w")}>Chargement des données...</div>}

          {error && (
            <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mt-4w")}>
              <p>{error}</p>
            </div>
          )}

          {dashboardData && !isLoading && (
            <>
              <InteractionsChart data={dashboardData.chartData} />
              <StatisticsCards data={dashboardData} />
            </>
          )}

          <div className={fr.cx("fr-mt-6w", "fr-pt-4w")}>
            <p className={fr.cx("fr-text--sm")}>
              <a
                href="https://stats.beta.gouv.fr/index.php?module=CoreHome&action=index&idSite=217&period=day&date=yesterday#?period=day&date=2025-01-14&category=Dashboard_Dashboard&subcategory=1&idSite=217"
                target="_blank"
                rel="noopener noreferrer"
                className={fr.cx("fr-link")}
              >
                Découvrez toutes les statistiques sur matomo
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className={fr.cx("fr-p-6w")}>
        <h2 className={fr.cx("fr-h2", "fr-mb-4w")}>2) Statistiques API et base de données (à venir)</h2>
      </div>
    </div>
  );
}

export default App;
