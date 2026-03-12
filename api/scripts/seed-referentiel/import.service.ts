// Service to import referentiel seed data into the database.
// Truncates all ref_* tables in FK-safe order, then inserts in reverse order.

import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql } from "drizzle-orm";
import {
  refCommunes,
  refGroupements,
  refPerimetres,
  refCompetenceCategories,
  refCompetences,
  refGroupementCompetences,
} from "@database/schema";
import type { SeedData, SeedStats } from "./sources/types";

// Drizzle table type for the batch insert helper
type DrizzleTable =
  | typeof refCommunes
  | typeof refGroupements
  | typeof refPerimetres
  | typeof refCompetenceCategories
  | typeof refCompetences
  | typeof refGroupementCompetences;

@Injectable()
export class ImportService {
  constructor(private readonly dbService: DatabaseService) {}

  async importAll(data: SeedData): Promise<SeedStats> {
    const totalStart = Date.now();

    const stats = await this.dbService.database.transaction(async (tx) => {
      // 1. Truncate all ref_* tables in FK-safe order (children first)
      console.log("Truncating tables...");
      const truncateStart = Date.now();
      await tx.execute(sql`TRUNCATE ref_groupement_competences CASCADE`);
      await tx.execute(sql`TRUNCATE ref_perimetres CASCADE`);
      await tx.execute(sql`TRUNCATE ref_groupements CASCADE`);
      await tx.execute(sql`TRUNCATE ref_communes CASCADE`);
      await tx.execute(sql`TRUNCATE ref_competences CASCADE`);
      await tx.execute(sql`TRUNCATE ref_competence_categories CASCADE`);
      console.log(`  Truncation done in ${Date.now() - truncateStart}ms`);

      // 2. Insert in FK-safe order (parents first)

      // 2a. Competence categories (~15 rows)
      let stepStart = Date.now();
      console.log("\nInserting competence categories...");
      await this.batchInsert(
        tx,
        refCompetenceCategories,
        data.competenceCategories.map((c) => ({ code: c.code, nom: c.nom })),
        1000,
        "categories",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      // 2b. Competences (~130 rows)
      stepStart = Date.now();
      console.log("Inserting competences...");
      await this.batchInsert(
        tx,
        refCompetences,
        data.competences.map((c) => ({
          code: c.code,
          nom: c.nom,
          codeCategorie: c.codeCategorie,
        })),
        1000,
        "competences",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      // 2c. Communes (~35K rows)
      stepStart = Date.now();
      console.log("Inserting communes...");
      await this.batchInsert(
        tx,
        refCommunes,
        data.communes.map((c) => ({
          codeInsee: c.codeInsee,
          siren: c.siren,
          siret: c.siret,
          nom: c.nom,
          population: c.population,
          codesPostaux: c.codesPostaux,
          codeDepartement: c.codeDepartement,
          codeRegion: c.codeRegion,
          codeEpci: c.codeEpci,
        })),
        1000,
        "communes",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      // 2d. Groupements (~9.3K rows)
      stepStart = Date.now();
      console.log("Inserting groupements...");
      await this.batchInsert(
        tx,
        refGroupements,
        data.groupements.map((g) => ({
          siren: g.siren,
          siret: g.siret,
          nom: g.nom,
          type: g.type,
          population: g.population,
          nbCommunes: g.nbCommunes,
          departements: g.departements,
          regions: g.regions,
          modeFinancement: g.modeFinancement,
          dateCreation: g.dateCreation,
        })),
        1000,
        "groupements",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      // 2e. Perimetres (~221K rows)
      stepStart = Date.now();
      console.log("Inserting perimetres...");
      await this.batchInsert(
        tx,
        refPerimetres,
        data.perimetres.map((p) => ({
          sirenGroupement: p.sirenGroupement,
          codeInseeCommune: p.codeInseeCommune,
          categorieMembre: p.categorieMembre,
        })),
        5000,
        "perimetres",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      // 2f. Groupement competences (~50K rows)
      stepStart = Date.now();
      console.log("Inserting groupement competences...");
      await this.batchInsert(
        tx,
        refGroupementCompetences,
        data.groupementCompetences.map((gc) => ({
          sirenGroupement: gc.sirenGroupement,
          codeCompetence: gc.codeCompetence,
        })),
        5000,
        "groupement_competences",
      );
      console.log(`  Done in ${Date.now() - stepStart}ms`);

      return {
        communes: data.communes.length,
        groupements: data.groupements.length,
        perimetres: data.perimetres.length,
        competenceCategories: data.competenceCategories.length,
        competences: data.competences.length,
        groupementCompetences: data.groupementCompetences.length,
      } satisfies SeedStats;
    });

    console.log(`\nTransaction committed in ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
    return stats;
  }

  /**
   * Insert rows in batches within the given transaction.
   * Logs progress after each batch.
   */
  private async batchInsert<T extends Record<string, unknown>>(
    tx: Parameters<Parameters<DatabaseService["database"]["transaction"]>[0]>[0],
    table: DrizzleTable,
    rows: T[],
    batchSize: number,
    label: string,
  ): Promise<void> {
    if (rows.length === 0) {
      console.log(`  ${label}: 0 rows (skipped)`);
      return;
    }

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx.insert(table) as any).values(batch);
      console.log(`  ${label}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }
}
