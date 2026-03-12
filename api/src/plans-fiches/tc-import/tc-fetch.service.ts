// Downloads and parses TC (Territoires Climat) opendata files.
// Returns parsed plans and fiches action ready for DB import.

import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import { CustomLogger } from "@logging/logger.service";
import {
  TC_BASE_URL,
  TC_FILES,
  type TcDemarcheCsv,
  type TcDemarcheActions,
  type TcFicheActionCsv,
  type ParsedPlan,
  type ParsedFicheAction,
} from "./tc-import.types";

@Injectable()
export class TcFetchService {
  constructor(private readonly logger: CustomLogger) {}

  async fetchAndParse(): Promise<{ plans: ParsedPlan[]; fiches: ParsedFicheAction[] }> {
    this.logger.log("Downloading TC opendata files...");
    const [v1Csv, v2Csv, v1Json, v2Json, fichesCsv] = await Promise.all([
      this.fetchText(TC_FILES.v1Entete),
      this.fetchText(TC_FILES.v2Entete),
      this.fetchJson<TcDemarcheActions[]>(TC_FILES.v1Actions),
      this.fetchJson<TcDemarcheActions[]>(TC_FILES.v2Actions),
      this.fetchText(TC_FILES.fichesAction),
    ]);

    // Parse plans
    const plansV1 = this.parsePlans(v1Csv, "V1");
    const plansV2 = this.parsePlans(v2Csv, "V2");
    const plans = [...plansV1, ...plansV2];
    this.logger.log(`Parsed ${plans.length} plans (V1: ${plansV1.length}, V2: ${plansV2.length})`);

    // Build SIREN lookup for fiches
    const planSirenMap = new Map<number, string | null>();
    for (const plan of plans) {
      planSirenMap.set(plan.tcDemarcheId, plan.collectiviteResponsableSiren);
    }

    // Parse fiches action
    const fichesV1 = this.parseFichesAction(v1Json, planSirenMap);
    const fichesV2 = this.parseFichesAction(v2Json, planSirenMap);
    const fiches = [...fichesV1, ...fichesV2];
    this.logger.log(`Parsed ${fiches.length} fiches (V1: ${fichesV1.length}, V2: ${fichesV2.length})`);

    // Enrich fiches with Fiches_Action.csv
    const enriched = this.enrichFiches(fiches, fichesCsv);
    this.logger.log(`Enriched ${enriched} fiches with description/type/cible`);

    return { plans, fiches };
  }

  // --- Fetch helpers ---

  private async fetchText(filename: string): Promise<string> {
    const url = `${TC_BASE_URL}/${filename}`;
    this.logger.debug(`Fetching ${filename}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const text = await res.text();
    // Strip BOM if present
    return text.replace(/^\uFEFF/, "");
  }

  private async fetchJson<T>(filename: string): Promise<T> {
    const text = await this.fetchText(filename);
    return JSON.parse(text) as T;
  }

  private parseCsv<T>(text: string): T[] {
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ";",
      relax_column_count: true,
    }) as T[];
  }

  // --- Parse logic ---

  private parsePlans(csvText: string, version: string): ParsedPlan[] {
    const rows = this.parseCsv<TcDemarcheCsv>(csvText);
    const plans: ParsedPlan[] = [];

    for (const row of rows) {
      const demarcheId = parseInt(row.Id, 10);
      if (isNaN(demarcheId)) continue;

      const siren = row["SIREN collectivites_coporteuses"]?.trim() || null;
      const periodeDebut = this.parseFrenchDate(row.Date_lancement);

      plans.push({
        nom: row.Nom?.trim() || `PCAET ${row["Collectivités porteuses"]?.trim() || demarcheId}`,
        type: "PCAET",
        description: row.Description_rapide?.trim() || null,
        periodeDebut,
        periodeFin: periodeDebut ? this.addYears(periodeDebut, 6) : null,
        collectiviteResponsableSiren: siren && /^\d{9}$/.test(siren) ? siren : null,
        territoireCommunes: null, // resolved later by import service
        tcDemarcheId: demarcheId,
        tcVersion: version,
        tcEtat: row.Demarche_etat?.trim() || null,
      });
    }

    return plans;
  }

  private parseFichesAction(
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
          territoireCommunes: null, // resolved later by import service
          tcDemarcheId: demarche.id,
          tcHash: this.ficheHash(demarche.id, intitule),
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

  private enrichFiches(fiches: ParsedFicheAction[], enrichmentCsvText: string): number {
    const rows = this.parseCsv<TcFicheActionCsv>(enrichmentCsvText);

    // Build lookup: hash(demarcheId + intitulé) → enrichment row
    const enrichMap = new Map<string, TcFicheActionCsv>();
    for (const row of rows) {
      const demarcheId = parseInt(row.Id_demarche, 10);
      const intitule = row.Intitule_action?.trim();
      if (isNaN(demarcheId) || !intitule) continue;
      enrichMap.set(this.ficheHash(demarcheId, intitule), row);
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

  // --- Helpers ---

  /** Parse French date "DD/MM/YYYY" -> "YYYY-MM-DD" or null */
  private parseFrenchDate(dateStr: string | undefined): string | null {
    if (!dateStr?.trim()) return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  /** Add N years to "YYYY-MM-DD" -> "YYYY-MM-DD" */
  private addYears(dateStr: string, years: number): string {
    const year = parseInt(dateStr.slice(0, 4), 10) + years;
    return `${year}${dateStr.slice(4)}`;
  }

  /** Deterministic hash for fiche action upsert key */
  private ficheHash(demarcheId: number, intitule: string): string {
    return createHash("sha256").update(`${demarcheId}:${intitule}`).digest("hex").slice(0, 40);
  }
}
