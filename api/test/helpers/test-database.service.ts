import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";

@Injectable()
export class TestDatabaseService extends DatabaseService {
  constructor(
    configService: ConfigService,
    private logger: CustomLogger,
  ) {
    super(configService);
  }

  async cleanDatabase(maxRetries = 3) {
    const tableOrder = [
      // Plans/fiches tables (data_tc_plans schema)
      "data_tc_plans.fiches_action_to_plans_transition",
      "data_tc_plans.fiches_action",
      "data_tc_plans.plans_transition",
      // Referentiel tables (api_referentiel schema, children first)
      "api_referentiel.groupement_competences",
      "api_referentiel.perimetres",
      "api_referentiel.groupements",
      "api_referentiel.communes",
      "api_referentiel.competences",
      "api_referentiel.competence_categories",
      // Core tables (public schema)
      "projets_to_collectivites",
      "projets",
      "collectivites",
      "services",
      "api_requests",
    ];

    const truncateQueries = tableOrder.map((table) => `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`).join("; ");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.database.transaction(async (tx) => {
          await tx.execute(sql.raw(truncateQueries));
        });
        return; // Success
      } catch (error) {
        this.logger.warn(`Database cleanup attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === maxRetries) {
          this.logger.error("Database cleanup failed after maximum retries", {
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        // Optional: Add a small delay between retries to help resolve potential lock conflicts
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
}
