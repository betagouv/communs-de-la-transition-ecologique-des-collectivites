// Seed script for the referentiel collectivites pipeline.
// Fetches data from multiple sources, merges, and imports into the database.
//
// Sources:
//   - geo.api.gouv.fr: communes + EPCI names
//   - Banatic: groupements (EPCI, syndicats, PETR), competences, perimetres
//   - ZLV (data.gouv.fr): SIREN -> SIRET mapping
//   - Static CSV: competence reference codes and categories

import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { ImportService } from "./import.service";
import { fetchCommunes, fetchEpciNames } from "./sources/geo-api.source";
import { fetchSiretMapping } from "./sources/zlv.source";
import { loadCompetenceReference, fetchBanaticGroupements, fetchBanaticPerimetres } from "./sources/banatic.source";
import type { RawCommune, RawGroupement, RawPerimetre, RawGroupementCompetence, SeedData } from "./sources/types";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
  ],
  providers: [DatabaseService, ImportService],
})
class SeedReferentielModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(SeedReferentielModule);
  const importService = app.get(ImportService);

  try {
    console.log("=== Seed Referentiel Collectivites ===\n");
    const startTime = Date.now();

    // 1. Load competence reference data (static CSV)
    const dataDir = join(__dirname, "data");
    const { categories, competences } = await loadCompetenceReference(dataDir);
    console.log(`Loaded ${categories.length} categories, ${competences.length} competences\n`);

    // 2. Fetch from sources in parallel
    console.log("Fetching data from sources...");
    const [communes, epciNames, banaticResult, siretMapping] = await Promise.all([
      fetchCommunes(),
      fetchEpciNames(),
      fetchBanaticGroupements(dataDir),
      fetchSiretMapping(),
    ]);

    // 3. Build SIREN -> codeInsee lookup from communes (needed for syndicat perimetres)
    const sirenToInsee = new Map<string, string>();
    for (const commune of communes) {
      sirenToInsee.set(commune.siren, commune.codeInsee);
    }

    // 4. Enrich communes with SIRET from ZLV
    console.log("\nEnriching communes with SIRET data...");
    let siretEnriched = 0;
    const enrichedCommunes: RawCommune[] = communes.map((c) => {
      const siret = siretMapping.get(c.siren) ?? null;
      if (siret) siretEnriched++;
      return { ...c, siret };
    });
    console.log(`  ${siretEnriched}/${enrichedCommunes.length} communes enriched with SIRET`);

    // 5. Enrich groupements: Banatic provides all groupement types.
    //    For EPCIs, prefer geo.api name if available (often cleaner).
    //    Also enrich EPCI SIRET from ZLV.
    console.log("\nBuilding groupements...");
    const enrichedGroupements: RawGroupement[] = banaticResult.groupements.map((g) => {
      const geoApiName = epciNames.get(g.siren);
      const siret = siretMapping.get(g.siren) ?? null;
      return {
        ...g,
        nom: geoApiName ?? g.nom,
        siret,
      };
    });
    console.log(`  ${enrichedGroupements.length} groupements from Banatic`);

    // 6. Build EPCI perimetres from commune data
    console.log("\nBuilding EPCI perimetres from commune data...");
    const epciPerimetres = new Map<string, Set<string>>();
    for (const commune of enrichedCommunes) {
      if (!commune.codeEpci) continue;
      let communeSet = epciPerimetres.get(commune.codeEpci);
      if (!communeSet) {
        communeSet = new Set<string>();
        epciPerimetres.set(commune.codeEpci, communeSet);
      }
      communeSet.add(commune.codeInsee);
    }

    const allPerimetres: RawPerimetre[] = [];
    for (const [siren, communeSet] of epciPerimetres) {
      for (const codeInsee of communeSet) {
        allPerimetres.push({
          sirenGroupement: siren,
          codeInseeCommune: codeInsee,
          categorieMembre: null,
        });
      }
    }
    console.log(`  ${allPerimetres.length} EPCI->commune perimetres`);

    // 7. Fetch syndicat perimetres from Banatic regional exports (slow: 18 downloads)
    console.log("\nFetching Banatic regional perimetres...");
    const banaticPerimetres = await fetchBanaticPerimetres();
    console.log(`  ${banaticPerimetres.length} raw syndicat perimetres from Banatic`);

    // 8. Convert syndicat perimetres: SIREN membre -> code INSEE
    //    Banatic regional exports list member SIRENs, not INSEE codes.
    //    We look up the code INSEE using our commune SIREN->INSEE map.
    let convertedCount = 0;
    let skippedCount = 0;
    const perimDedup = new Set<string>(allPerimetres.map((p) => `${p.sirenGroupement}:${p.codeInseeCommune}`));

    for (const bp of banaticPerimetres) {
      const codeInsee = sirenToInsee.get(bp.sirenMembre);
      if (!codeInsee) {
        // Member SIREN not found in our commune list (might be another groupement)
        skippedCount++;
        continue;
      }

      const key = `${bp.sirenGroupement}:${codeInsee}`;
      if (perimDedup.has(key)) continue;
      perimDedup.add(key);

      allPerimetres.push({
        sirenGroupement: bp.sirenGroupement,
        codeInseeCommune: codeInsee,
        categorieMembre: bp.categorieMembre,
      });
      convertedCount++;
    }
    console.log(`  ${convertedCount} syndicat perimetres converted, ${skippedCount} skipped (not communes)`);
    console.log(`  ${allPerimetres.length} total perimetres after merge`);

    // 9. Filter perimetres to only include known groupements and communes
    const groupementSirens = new Set(enrichedGroupements.map((g) => g.siren));
    const communeInsees = new Set(enrichedCommunes.map((c) => c.codeInsee));
    const validPerimetres = allPerimetres.filter((p) => {
      return groupementSirens.has(p.sirenGroupement) && communeInsees.has(p.codeInseeCommune);
    });
    if (validPerimetres.length < allPerimetres.length) {
      console.log(
        `  Filtered to ${validPerimetres.length} valid perimetres (removed ${allPerimetres.length - validPerimetres.length} with unknown groupement/commune)`,
      );
    }

    // 10. Filter groupement competences to only include known groupements and competences
    const competenceCodes = new Set(competences.map((c) => c.code));
    const validGroupementCompetences: RawGroupementCompetence[] = banaticResult.groupementCompetences.filter((gc) => {
      return groupementSirens.has(gc.sirenGroupement) && competenceCodes.has(gc.codeCompetence);
    });
    console.log(`  ${validGroupementCompetences.length} valid groupement-competence links`);

    // 11. Build the SeedData object
    const seedData: SeedData = {
      communes: enrichedCommunes,
      groupements: enrichedGroupements,
      perimetres: validPerimetres,
      competenceCategories: categories,
      competences,
      groupementCompetences: validGroupementCompetences,
    };

    // 12. Import into DB
    console.log("\n--- Importing into database ---\n");
    const stats = await importService.importAll(seedData);

    console.log("\n=== Import Complete ===");
    console.log(JSON.stringify(stats, null, 2));
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
