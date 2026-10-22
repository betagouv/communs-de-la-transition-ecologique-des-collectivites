// Weekly import of the referentiel, run by the Scalingo Scheduler in a one-off container (see
// cron.json at the repository root) so that its memory peak never weighs on the web container.
import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { REFERENTIEL_IMPORT_CRON, REFERENTIEL_IMPORT_MONITOR_SLUG } from "./referentiel-import.constants";
import { ReferentielSeedService } from "./referentiel-seed.service";
import { ReferentielImportService } from "./import.service";
import { insufficientVolumes } from "./volume-guard";
import { notifyMattermost } from "@/shared/utils/notify-mattermost";
import type { SeedStats } from "./sources/types";

class InsufficientVolumesError extends Error {
  constructor(readonly problems: string[]) {
    super(`Referentiel import refused, insufficient volumes: ${problems.join(", ")}`);
  }
}

@Injectable()
export class ReferentielImportJob {
  private readonly webhookUrl: string | undefined;

  constructor(
    private readonly seedService: ReferentielSeedService,
    private readonly importService: ReferentielImportService,
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    // Same channel as the TC opendata import unless a dedicated webhook is set
    this.webhookUrl =
      this.configService.get<string>("REFERENTIEL_IMPORT_MATTERMOST_WEBHOOK") ??
      this.configService.get<string>("TC_IMPORT_MATTERMOST_WEBHOOK");
  }

  async run(): Promise<SeedStats> {
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: REFERENTIEL_IMPORT_MONITOR_SLUG, status: "in_progress" },
      {
        schedule: { type: "crontab", value: REFERENTIEL_IMPORT_CRON },
        checkinMargin: 5,
        maxRuntime: 30,
        timezone: "UTC",
      },
    );

    const startTime = Date.now();
    this.logger.log("Starting referentiel import...");

    try {
      const { data, volumes } = await this.seedService.buildSeedData();
      const problems = insufficientVolumes(volumes);
      if (problems.length > 0) throw new InsufficientVolumesError(problems);

      const stats = await this.importService.importAll(data);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Referentiel import complete in ${duration}s`, { stats });
      Sentry.captureCheckIn({ checkInId, monitorSlug: REFERENTIEL_IMPORT_MONITOR_SLUG, status: "ok" });

      await this.notifyMattermost(
        `:white_check_mark: **Import du référentiel terminé** (${duration}s)\n` +
          `| Table | Lignes |\n|---|---|\n` +
          `| Régions | ${stats.regions} |\n` +
          `| Départements | ${stats.departements} |\n` +
          `| Communes | ${stats.communes} |\n` +
          `| Groupements | ${stats.groupements} |\n` +
          `| Périmètres | ${stats.perimetres} |\n` +
          `| Compétences des groupements | ${stats.groupementCompetences} |`,
      );

      return stats;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const message = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Referentiel import failed", {
        error: { message, stack: error instanceof Error ? error.stack : undefined },
      });
      Sentry.captureCheckIn({ checkInId, monitorSlug: REFERENTIEL_IMPORT_MONITOR_SLUG, status: "error" });
      Sentry.captureException(error);

      await this.notifyMattermost(
        error instanceof InsufficientVolumesError
          ? `:warning: **Import du référentiel refusé** (${duration}s), données actuelles conservées.\n` +
              `Une source a renvoyé trop peu de lignes : ${error.problems.join(", ")}`
          : `:x: **Import du référentiel échoué** (${duration}s), données actuelles conservées.\nErreur : ${message}`,
      );

      throw error;
    }
  }

  private notifyMattermost(text: string): Promise<void> {
    return notifyMattermost(this.webhookUrl, text, this.logger);
  }
}
