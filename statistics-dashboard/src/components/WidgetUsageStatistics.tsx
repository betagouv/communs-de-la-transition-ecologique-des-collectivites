import { StatisticsCards } from "./StatisticsCards";
import { InteractionsChart } from "./InteractionsChart";
import { PlatformFilter } from "./PlatformFilter";
import type { WidgetUsageData } from "../types";
import { fr } from "@codegouvfr/react-dsfr";

interface WidgetUsageStatisticsProps {
  data: WidgetUsageData;
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
}

export function WidgetUsageStatistics({ data, selectedPlatform, onPlatformChange }: WidgetUsageStatisticsProps) {
  return (
    <div>
      <h2 className={fr.cx("fr-h2", "fr-mb-4w")}>1) Statistiques d&#39;usage du module d&#39;aiguillage</h2>

      <PlatformFilter value={selectedPlatform} onChange={onPlatformChange} platforms={data.hostingPlatforms} />

      <InteractionsChart data={data.chartData} />
      <StatisticsCards data={data} />

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
  );
}
