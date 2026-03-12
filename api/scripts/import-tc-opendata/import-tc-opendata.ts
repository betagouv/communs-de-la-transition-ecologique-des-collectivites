// Import TC (Territoires Climat) opendata into the API Collectivités database.
// Creates plans_transition and fiches_action records from PCAET data.
//
// Usage: pnpm import:tc-opendata
//
// Sources:
//   - Demarches_PCAET_V1_entete.csv + V2 → plans_transition
//   - Demarches_PCAET_Programme_Actions_V1.json + V2 → fiches_action
//   - Fiches_Action.csv → enrichment (description, type, cible)

import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { TcImportService } from "./import.service";
import type { TcDemarcheCsv, TcDemarcheActions, TcFicheActionCsv, ParsedPlan, ParsedFicheAction } from "./types";
import { TC_BASE_URL, TC_FILES } from "./types";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
  ],
  providers: [DatabaseService, TcImportService],
})
class ImportTcModule {}

// --- Fetch helpers ---

async function fetchText(filename: string): Promise<string> {
  const url = `${TC_BASE_URL}/${filename}`;
  console.log(`  Fetching ${filename}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  // Strip BOM if present
  return text.replace(/^\uFEFF/, "");
}

async function fetchJson<T>(filename: string): Promise<T> {
  const text = await fetchText(filename);
  return JSON.parse(text) as T;
}

function parseCsv<T>(text: string): T[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    relax_column_count: true,
  }) as T[];
}

// --- Date helpers ---

/** Parse French date "DD/MM/YYYY" → "YYYY-MM-DD" or null */
function parseFrenchDate(dateStr: string | undefined): string | null {
  if (!dateStr?.trim()) return null;
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Add N years to "YYYY-MM-DD" → "YYYY-MM-DD" */
function addYears(dateStr: string, years: number): string {
  const year = parseInt(dateStr.slice(0, 4), 10) + years;
  return `${year}${dateStr.slice(4)}`;
}

/** Deterministic hash for fiche action upsert key */
function ficheHash(demarcheId: number, intitule: string): string {
  return createHash("sha256").update(`${demarcheId}:${intitule}`).digest("hex").slice(0, 40);
}

// --- Parse logic ---

function parsePlans(csvText: string, version: string): ParsedPlan[] {
  const rows = parseCsv<TcDemarcheCsv>(csvText);
  const plans: ParsedPlan[] = [];

  for (const row of rows) {
    const demarcheId = parseInt(row.Id, 10);
    if (isNaN(demarcheId)) continue;

    const siren = row["SIREN collectivites_coporteuses"]?.trim() || null;
    const periodeDebut = parseFrenchDate(row.Date_lancement);

    plans.push({
      nom: row.Nom?.trim() || `PCAET ${row["Collectivités porteuses"]?.trim() || demarcheId}`,
      type: "PCAET",
      description: row.Description_rapide?.trim() || null,
      periodeDebut,
      periodeFin: periodeDebut ? addYears(periodeDebut, 6) : null,
      collectiviteResponsableSiren: siren && /^\d{9}$/.test(siren) ? siren : null,
      territoireCommunes: null, // resolved later
      tcDemarcheId: demarcheId,
      tcVersion: version,
      tcEtat: row.Demarche_etat?.trim() || null,
    });
  }

  return plans;
}

function parseFichesAction(
  demarches: TcDemarcheActions[],
  planSirenMap: Map<number, string | null>,
): ParsedFicheAction[] {
  const fiches: ParsedFicheAction[] = [];

  for (const demarche of demarches) {
    const siren = planSirenMap.get(demarche.id) ?? null;

    for (const action of demarche.actions) {
      const intitule = action.intitule?.trim();
      if (!intitule) continue;

      fiches.push({
        nom: intitule,
        description: null, // enriched later from Fiches_Action.csv
        collectiviteResponsableSiren: siren,
        territoireCommunes: null, // resolved later
        tcDemarcheId: demarche.id,
        tcHash: ficheHash(demarche.id, intitule),
        tcSecteurs: action.secteurs?.map((s) => s.secteur.libelle).filter(Boolean) || null,
        tcTypesPorteur: action.typesPorteur?.map((t) => t.libelle).filter(Boolean) || null,
        tcVolets: action.volets?.map((v) => v.libelle).filter(Boolean) || null,
        tcTypeAction: null,
        tcCibleAction: null,
      });
    }
  }

  return fiches;
}

function enrichFiches(fiches: ParsedFicheAction[], enrichmentCsvText: string): number {
  const rows = parseCsv<TcFicheActionCsv>(enrichmentCsvText);

  // Build lookup: hash(demarcheId + intitulé) → enrichment row
  const enrichMap = new Map<string, TcFicheActionCsv>();
  for (const row of rows) {
    const demarcheId = parseInt(row.Id_demarche, 10);
    const intitule = row.Intitule_action?.trim();
    if (isNaN(demarcheId) || !intitule) continue;
    enrichMap.set(ficheHash(demarcheId, intitule), row);
  }

  let enriched = 0;
  for (const fiche of fiches) {
    const row = enrichMap.get(fiche.tcHash);
    if (!row) continue;

    if (row.Description_action?.trim()) {
      fiche.description = row.Description_action.trim();
    }
    if (row.Type_action?.trim()) {
      fiche.tcTypeAction = row.Type_action.trim();
    }
    if (row.Cible_action?.trim()) {
      fiche.tcCibleAction = row.Cible_action.trim();
    }
    enriched++;
  }

  return enriched;
}

// --- Main ---

async function main() {
  const app = await NestFactory.createApplicationContext(ImportTcModule);
  const importService = app.get(TcImportService);

  try {
    console.log("=== Import TC Opendata (PCAET) ===\n");
    const startTime = Date.now();

    // 1. Fetch all files
    console.log("Downloading TC opendata files...");
    const [v1Csv, v2Csv, v1Json, v2Json, fichesCsv] = await Promise.all([
      fetchText(TC_FILES.v1Entete),
      fetchText(TC_FILES.v2Entete),
      fetchJson<TcDemarcheActions[]>(TC_FILES.v1Actions),
      fetchJson<TcDemarcheActions[]>(TC_FILES.v2Actions),
      fetchText(TC_FILES.fichesAction),
    ]);
    console.log("  Done.\n");

    // 2. Parse plans
    console.log("Parsing plans...");
    const plansV1 = parsePlans(v1Csv, "V1");
    const plansV2 = parsePlans(v2Csv, "V2");
    const allPlans = [...plansV1, ...plansV2];
    console.log(`  V1: ${plansV1.length} plans, V2: ${plansV2.length} plans → ${allPlans.length} total`);

    // Build SIREN lookup for fiches
    const planSirenMap = new Map<number, string | null>();
    for (const plan of allPlans) {
      planSirenMap.set(plan.tcDemarcheId, plan.collectiviteResponsableSiren);
    }

    // 3. Parse fiches action
    console.log("\nParsing fiches action...");
    const fichesV1 = parseFichesAction(v1Json, planSirenMap);
    const fichesV2 = parseFichesAction(v2Json, planSirenMap);
    const allFiches = [...fichesV1, ...fichesV2];
    console.log(`  V1: ${fichesV1.length} fiches, V2: ${fichesV2.length} fiches → ${allFiches.length} total`);

    // 4. Enrich fiches with Fiches_Action.csv
    console.log("\nEnriching fiches from Fiches_Action.csv...");
    const enriched = enrichFiches(allFiches, fichesCsv);
    console.log(`  ${enriched} fiches enriched with description/type/cible`);

    // 5. Import into database
    console.log("\n--- Importing into database ---");
    const stats = await importService.importAll(allPlans, allFiches);

    console.log("\n=== Import Complete ===");
    console.log(JSON.stringify(stats, null, 2));
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
