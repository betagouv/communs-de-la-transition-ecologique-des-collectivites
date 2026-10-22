// Nightly run of the consultation export, by the Scalingo Scheduler in a one-off container (see
// cron.json at the repository root): Sentry cron monitor, Mattermost message on failure only.
import * as Sentry from "@sentry/node";
import type { CustomLogger } from "@logging/logger.service";
import { notifyMattermost } from "@/shared/utils/notify-mattermost";
import { ConsultationExportGenerator, ExportRefusedError } from "./consultation-export.generator";
import type { ExportManifest } from "./export-store";

export const CONSULTATION_EXPORT_MONITOR_SLUG = "consultation-export";
// Must match the command in cron.json: every day at 03:00 UTC.
export const CONSULTATION_EXPORT_CRON = "0 3 * * *";

export class ConsultationExportJob {
  constructor(
    private readonly generator: ConsultationExportGenerator,
    private readonly webhookUrl: string | undefined,
    private readonly logger: Pick<CustomLogger, "log" | "error" | "warn">,
  ) {}

  async run(options: { force?: boolean } = {}): Promise<ExportManifest> {
    const checkInId = Sentry.captureCheckIn(
      { monitorSlug: CONSULTATION_EXPORT_MONITOR_SLUG, status: "in_progress" },
      {
        schedule: { type: "crontab", value: CONSULTATION_EXPORT_CRON },
        checkinMargin: 10,
        maxRuntime: 120,
        timezone: "UTC",
      },
    );
    const startTime = Date.now();

    try {
      const manifest = await this.generator.generate(options);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Consultation export complete in ${duration}s`, { manifest });
      Sentry.captureCheckIn({ checkInId, monitorSlug: CONSULTATION_EXPORT_MONITOR_SLUG, status: "ok" });
      return manifest;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Consultation export failed", {
        error: { message, stack: error instanceof Error ? error.stack : undefined },
      });
      Sentry.captureCheckIn({ checkInId, monitorSlug: CONSULTATION_EXPORT_MONITOR_SLUG, status: "error" });
      Sentry.captureException(error);

      await notifyMattermost(
        this.webhookUrl,
        error instanceof ExportRefusedError
          ? `:warning: **Export de la consultation refusé** (${duration}s), export précédent conservé.\n` +
              `Volumes suspects : ${error.problems.join(", ")}`
          : `:x: **Export de la consultation échoué** (${duration}s), export précédent conservé.\nErreur : ${message}`,
        this.logger,
      );
      throw error;
    }
  }
}
