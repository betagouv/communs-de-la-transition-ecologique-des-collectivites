// Builds the referentiel collectivites from its public sources, without touching the database.
//
// Sources:
//   - geo.api.gouv.fr: communes, EPCI names, departements, regions
//   - Banatic: groupements (EPCI, syndicats, PETR), competences, perimetres
//   - ZLV (data.gouv.fr): SIREN -> SIRET mapping, SIREN of departements and regions
//   - Static CSV: competence reference codes and categories

import { Injectable } from "@nestjs/common";
import { join } from "path";
import { fetchCommunes, fetchDepartements, fetchEpciNames, fetchRegions } from "./sources/geo-api.source";
import { fetchZlv } from "./sources/zlv.source";
import { loadCompetenceReference, fetchBanaticGroupements, fetchBanaticPerimetres } from "./sources/banatic.source";
import { epciFromBanatic, mergePerimetres, resolveMemberPerimetres, withMemberStats } from "./groupement-stats";
import type { SeedVolumes } from "./volume-guard";
import type {
  RawDepartement,
  RawRegion,
  RawCommune,
  RawGroupement,
  RawPerimetre,
  RawGroupementCompetence,
  SeedData,
} from "./sources/types";

// Static competence CSVs, copied next to the compiled file as nest-cli assets
const DATA_DIR = join(__dirname, "data");

@Injectable()
export class ReferentielSeedService {
  async buildSeedData(): Promise<{ data: SeedData; volumes: SeedVolumes }> {
    // 1. Load competence reference data (static CSV)
    const { categories, competences } = await loadCompetenceReference(DATA_DIR);
    console.log(`Loaded ${categories.length} categories, ${competences.length} competences\n`);

    // 2. Fetch from sources in parallel
    console.log("Fetching data from sources...");
    const [communes, epciNames, banaticResult, zlv, geoDepartements, geoRegions] = await Promise.all([
      fetchCommunes(),
      fetchEpciNames(),
      fetchBanaticGroupements(DATA_DIR),
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
    const departementsWithSiren = departements.filter((d) => d.siren).length;
    console.log(
      `  ${regions.length} regions (${regions.filter((r) => r.siren).length} with SIREN), ` +
        `${departements.length} departements (${departementsWithSiren} with SIREN)`,
    );

    // 3. Build SIREN -> codeInsee lookup from communes (needed for Banatic member records)
    const sirenToInsee = new Map<string, string>();
    for (const commune of communes) {
      sirenToInsee.set(commune.siren, commune.codeInsee);
    }

    // 4. Members of every groupement from Banatic regional exports (slow: 18 downloads)
    console.log("\nFetching Banatic regional perimetres...");
    const banaticPerimetres = await fetchBanaticPerimetres();
    console.log(`  ${banaticPerimetres.length} raw member records from Banatic`);

    // 5. Enrich communes: SIRET from ZLV, EPCI from Banatic (geo.api lags a year: it keeps the
    //    composition of the previous 1st January), geo.api's EPCI as a fallback.
    console.log("\nEnriching communes with SIRET and EPCI...");
    const banaticEpci = epciFromBanatic(banaticPerimetres, sirenToInsee);
    let siretEnriched = 0;
    let epciChanged = 0;
    const enrichedCommunes: RawCommune[] = communes.map((c) => {
      const siret = siretMapping.get(c.siren) ?? null;
      if (siret) siretEnriched++;
      const codeEpci = banaticEpci.get(c.codeInsee) ?? c.codeEpci;
      if (codeEpci !== c.codeEpci) epciChanged++;
      return { ...c, siret, codeEpci };
    });
    console.log(`  ${siretEnriched}/${enrichedCommunes.length} communes enriched with SIRET`);
    console.log(`  ${banaticEpci.size} communes with their EPCI from Banatic, ${epciChanged} differing from geo.api`);

    // 6. Enrich groupements: Banatic provides all groupement types.
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

    // 7. Build EPCI perimetres from commune data
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

    // 8. Convert Banatic member records (EPT, syndicats, EPCI): SIREN membre -> code INSEE.
    //    A commune member is looked up in our SIREN->INSEE map, an EPCI member is expanded to the
    //    communes of the EPCI.
    const memberPerimetres = resolveMemberPerimetres(banaticPerimetres, sirenToInsee, epciPerimetres);
    const mergedPerimetres = mergePerimetres(allPerimetres, memberPerimetres);
    console.log(`  ${mergedPerimetres.length - allPerimetres.length} perimetres added from Banatic members`);
    console.log(`  ${mergedPerimetres.length} total perimetres after merge`);

    // 9. Filter perimetres to only include known groupements and communes
    const groupementSirens = new Set(enrichedGroupements.map((g) => g.siren));
    const communeInsees = new Set(enrichedCommunes.map((c) => c.codeInsee));
    const validPerimetres = mergedPerimetres.filter((p) => {
      return groupementSirens.has(p.sirenGroupement) && communeInsees.has(p.codeInseeCommune);
    });
    if (validPerimetres.length < mergedPerimetres.length) {
      console.log(
        `  Filtered to ${validPerimetres.length} valid perimetres (removed ${mergedPerimetres.length - validPerimetres.length} with unknown groupement/commune)`,
      );
    }

    // 10. Filter groupement competences to only include known groupements and competences
    const competenceCodes = new Set(competences.map((c) => c.code));
    const validGroupementCompetences: RawGroupementCompetence[] = banaticResult.groupementCompetences.filter((gc) => {
      return groupementSirens.has(gc.sirenGroupement) && competenceCodes.has(gc.codeCompetence);
    });
    console.log(`  ${validGroupementCompetences.length} valid groupement-competence links`);

    // 11. Population and number of communes from the member communes (Banatic's are not reliable)
    const groupementsWithStats = withMemberStats(enrichedGroupements, validPerimetres, enrichedCommunes);

    return {
      data: {
        regions,
        departements,
        communes: enrichedCommunes,
        groupements: groupementsWithStats,
        perimetres: validPerimetres,
        competenceCategories: categories,
        competences,
        groupementCompetences: validGroupementCompetences,
      },
      volumes: {
        regions: regions.length,
        departements: departements.length,
        departementsWithSiren,
        communes: enrichedCommunes.length,
        communesWithSiret: siretEnriched,
        communesWithBanaticEpci: banaticEpci.size,
        groupements: groupementsWithStats.length,
        perimetres: validPerimetres.length,
        groupementCompetences: validGroupementCompetences.length,
      },
    };
  }
}
