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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDashboardData(selectedPlatform);
        setDashboardData(data);
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

        <div>
          <div className={fr.cx("fr-py-6w")}>
            <h1 className={fr.cx("fr-h1", "fr-mb-4w")}>Statistiques d&#39;usage</h1>

            <PlatformFilter value={selectedPlatform} onChange={setSelectedPlatform} />

            {isLoading && <div className={fr.cx("fr-mt-4w")}>Chargement des données...</div>}

            {error && (
              <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mt-4w")}>
                <p>{error}</p>
              </div>
            )}

            {dashboardData && !isLoading && (
              <>
                <StatisticsCards data={dashboardData} />
                <InteractionsChart data={dashboardData.chartData} />
              </>
            )}

            <div className={fr.cx("fr-mt-6w", "fr-pt-4w")}>
              <p className={fr.cx("fr-text--sm")}>
                <a
                  href="https://stats.beta.gouv.fr/index.php?module=CoreHome&action=index&idSite=1234"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={fr.cx("fr-link")}
                >
                  Découvrez toutes les statistiques sur matomo
                </a>
              </p>
              <p className={fr.cx("fr-text--sm", "fr-mt-2w")}>
                <a href="#metabase" className={fr.cx("fr-link")}>
                  Découvrez toutes les statistiques de notre base de données sur metabase
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
