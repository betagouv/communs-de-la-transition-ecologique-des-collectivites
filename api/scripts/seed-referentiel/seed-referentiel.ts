// Seed script for the referentiel collectivites pipeline.
// Fetches data from multiple sources, merges, and imports into the database.
//
// Sources:
//   - geo.api.gouv.fr: communes, EPCI names, departements, regions
//   - Banatic: groupements (EPCI, syndicats, PETR), competences, perimetres
//   - ZLV (data.gouv.fr): SIREN -> SIRET mapping, SIREN of departements and regions
//   - Static CSV: competence reference codes and categories

import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { ImportService } from "./import.service";
import { fetchCommunes, fetchDepartements, fetchEpciNames, fetchRegions } from "./sources/geo-api.source";
import { fetchZlv } from "./sources/zlv.source";
import { loadCompetenceReference, fetchBanaticGroupements, fetchBanaticPerimetres } from "./sources/banatic.source";
import { resolveSyndicatPerimetres, withMemberStats } from "./groupement-stats";
import type {
  RawDepartement,
  RawRegion,
  RawCommune,
  RawGroupement,
  RawPerimetre,
  RawGroupementCompetence,
  SeedData,
} from "./sources/types";

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
    const [communes, epciNames, banaticResult, zlv, geoDepartements, geoRegions] = await Promise.all([
      fetchCommunes(),
      fetchEpciNames(),
      fetchBanaticGroupements(dataDir),
      fetchZlv(),
      fetchDepartements(),
      fetchRegions(),
    ]);
    const { siretMapping } = zlv;

    // Departements and regions: names from geo.api, SIREN of their collectivity from ZLV
    const regions: RawRegion[] = geoRegions.map((r) => ({
      code: r.code,
      nom: r.nom,
      siren: zlv.regionSirens.get(r.code) ?? null,
    }));
    const departements: RawDepartement[] = geoDepartements.map((d) => ({
      code: d.code,
      nom: d.nom,
      codeRegion: d.codeRegion ?? "",
      siren: zlv.departementSirens.get(d.code) ?? null,
    }));
    console.log(
      `  ${regions.length} regions (${regions.filter((r) => r.siren).length} with SIREN), ` +
        `${departements.length} departements (${departements.filter((d) => d.siren).length} with SIREN)`,
    );

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
    //    Banatic regional exports list member SIRENs, not INSEE codes: a commune member is looked
    //    up in our SIREN->INSEE map, an EPCI member is expanded to the communes of the EPCI.
    const perimDedup = new Set<string>(allPerimetres.map((p) => `${p.sirenGroupement}:${p.codeInseeCommune}`));
    const syndicatPerimetres = resolveSyndicatPerimetres(banaticPerimetres, sirenToInsee, epciPerimetres).filter(
      (p) => !perimDedup.has(`${p.sirenGroupement}:${p.codeInseeCommune}`),
    );
    allPerimetres.push(...syndicatPerimetres);
    console.log(`  ${syndicatPerimetres.length} syndicat perimetres converted`);
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
    // Population and number of communes from the member communes (Banatic's are not reliable)
    const groupementsWithStats = withMemberStats(enrichedGroupements, validPerimetres, enrichedCommunes);

    const seedData: SeedData = {
      regions,
      departements,
      communes: enrichedCommunes,
      groupements: groupementsWithStats,
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
