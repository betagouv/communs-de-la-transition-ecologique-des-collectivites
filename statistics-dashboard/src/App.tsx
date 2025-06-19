import { useState, useEffect } from "react";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { fr } from "@codegouvfr/react-dsfr";
import { WidgetUsageStatistics } from "./components/WidgetUsageStatistics";
import { DatabaseUsageStatistics } from "./components/DatabaseUsageStatistics";
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

        <div className={fr.cx("fr-p-6w")}>
          {isLoading && <div className={fr.cx("fr-mt-4w")}>Chargement des données...</div>}

          {error && (
            <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mt-4w")}>
              <p>{error}</p>
            </div>
          )}

          {dashboardData && !isLoading && (
            <WidgetUsageStatistics
              data={dashboardData}
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
            />
          )}

          <DatabaseUsageStatistics />
        </div>
      </div>
    </div>
  );
}

export default App;
