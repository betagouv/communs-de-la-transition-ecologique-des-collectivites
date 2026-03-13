import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { TC_IMPORT_QUEUE_NAME, TC_IMPORT_MONITOR_SLUG } from "./tc-import.constants";
import { TcFetchService } from "./tc-fetch.service";
import { TcImportService } from "./tc-import.service";
import type { ImportStats } from "./tc-import.types";

@Processor(TC_IMPORT_QUEUE_NAME)
export class TcImportProcessor extends WorkerHost {
  private readonly webhookUrl: string | undefined;

  constructor(
    private readonly fetchService: TcFetchService,
    private readonly importService: TcImportService,
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    super();
    this.webhookUrl = this.configService.get<string>("TC_IMPORT_MATTERMOST_WEBHOOK");
  }

  async process(job: Job): Promise<ImportStats> {
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: TC_IMPORT_MONITOR_SLUG, status: "in_progress" },
      {
        schedule: { type: "crontab", value: "0 3 * * 0" },
        checkinMargin: 5,
        maxRuntime: 30,
        timezone: "UTC",
      },
    );

    const startTime = Date.now();
    this.logger.log(`Starting TC opendata import job (id=${job.id})...`);

    try {
      const { plans, fiches } = await this.fetchService.fetchAndParse();
      const stats = await this.importService.importAll(plans, fiches);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`TC import complete in ${duration}s`, { stats });

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: TC_IMPORT_MONITOR_SLUG,
        status: "ok",
      });

      await this.notifyMattermost(
        `:white_check_mark: **Import TC opendata terminé** (${duration}s)\n` +
          `| Métrique | Valeur |\n|---|---|\n` +
          `| Plans insérés | ${stats.plansInserted} |\n` +
          `| Plans mis à jour | ${stats.plansUpdated} |\n` +
          `| Fiches insérées | ${stats.fichesInserted} |\n` +
          `| Fiches mises à jour | ${stats.fichesUpdated} |\n` +
          `| Liens créés | ${stats.linksCreated} |\n` +
          `| Fiches enrichies | ${stats.fichesEnriched} |\n` +
          `| Communes résolues | ${stats.communesResolved} |`,
      );

      return stats;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const message = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("TC opendata import failed", {
        error: {
          message,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: TC_IMPORT_MONITOR_SLUG,
        status: "error",
      });

      Sentry.captureException(error);

      await this.notifyMattermost(`:x: **Import TC opendata échoué** (${duration}s)\nErreur : ${message}`);

      throw error;
    }
  }

  private async notifyMattermost(text: string): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (error) {
      this.logger.warn("Failed to send Mattermost notification", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
