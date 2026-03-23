import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { DatabaseService } from "@database/database.service";
import { aideClassifications } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { ClassificationService } from "@/projet-qualification/classification/classification.service";
import { AideTerritoires } from "./aides-territoires.service";

interface ClassificationScores {
  thematiques: { label: string; score: number }[];
  sites: { label: string; score: number }[];
  interventions: { label: string; score: number }[];
}

/**
 * Manages classification of aides: LLM classification + cache via content hash
 * Only reclassifies when aide content (name + description) has changed
 */
@Injectable()
export class AideClassificationService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly classificationService: ClassificationService,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Get classification for an aide, classifying if needed (cache miss or content changed)
   */
  async getOrClassify(aide: AideTerritoires): Promise<ClassificationScores | null> {
    const idAt = String(aide.id);
    const hash = this.computeHash(aide);

    // Check cache
    const [existing] = await this.dbService.database
      .select()
      .from(aideClassifications)
      .where(eq(aideClassifications.idAt, idAt))
      .limit(1);

    if (existing?.contentHash === hash) {
      return existing.classificationScores;
    }

    // Cache miss or content changed — classify
    return this.classifyAndStore(aide, idAt, hash);
  }

  /**
   * Get cached classifications for multiple aides (batch lookup)
   * Returns a map of id_at -> scores (only for aides that are already classified)
   */
  async getCachedClassifications(aideIds: string[]): Promise<Map<string, ClassificationScores>> {
    if (aideIds.length === 0) return new Map();

    const rows = await this.dbService.database.select().from(aideClassifications);

    const map = new Map<string, ClassificationScores>();
    for (const row of rows) {
      if (aideIds.includes(row.idAt)) {
        map.set(row.idAt, row.classificationScores);
      }
    }
    return map;
  }

  /**
   * Sync classifications for a batch of aides
   * Only classifies new or modified aides (based on content hash)
   */
  async syncClassifications(aides: AideTerritoires[]): Promise<{ classified: number; cached: number }> {
    let classified = 0;
    let cached = 0;

    for (const aide of aides) {
      const idAt = String(aide.id);
      const hash = this.computeHash(aide);

      const [existing] = await this.dbService.database
        .select()
        .from(aideClassifications)
        .where(eq(aideClassifications.idAt, idAt))
        .limit(1);

      if (existing?.contentHash === hash) {
        cached++;
        continue;
      }

      try {
        await this.classifyAndStore(aide, idAt, hash);
        classified++;
      } catch (error) {
        this.logger.error(`Failed to classify aide ${idAt}: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }

    this.logger.log(`Aide classification sync: ${classified} classified, ${cached} cached`);
    return { classified, cached };
  }

  private async classifyAndStore(aide: AideTerritoires, idAt: string, hash: string): Promise<ClassificationScores> {
    const context = this.buildContext(aide);
    this.logger.log(`Classifying aide ${idAt}: ${aide.name.slice(0, 60)}`);

    const result = await this.classificationService.classify(context, "aide");

    const scores: ClassificationScores = {
      thematiques: result.thematiques,
      sites: result.sites,
      interventions: result.interventions,
    };

    // Upsert classification
    await this.dbService.database
      .insert(aideClassifications)
      .values({
        idAt,
        contentHash: hash,
        classificationScores: scores,
        classifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: aideClassifications.idAt,
        set: {
          contentHash: hash,
          classificationScores: scores,
          classifiedAt: new Date(),
        },
      });

    return scores;
  }

  private computeHash(aide: AideTerritoires): string {
    const content = `${aide.name}|${aide.description ?? ""}`;
    return createHash("sha256").update(content).digest("hex");
  }

  private buildContext(aide: AideTerritoires): string {
    const parts = [`TITRE: ${aide.name}`];
    if (aide.description) {
      parts.push(`DESCRIPTION: ${aide.description}`);
    }
    if (aide.eligibility) {
      parts.push(`ELIGIBILITÉ: ${aide.eligibility}`);
    }
    return parts.join("\n");
  }
}
