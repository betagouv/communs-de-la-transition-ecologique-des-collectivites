// Fetch SIREN->SIRET mapping from the ZLV (Zone de Localisation par Ville)
// collectivites territoriales CSV published on data.gouv.fr

import { parse } from "csv-parse";
import { Readable } from "stream";

// Direct resource URL for the "Référentiel des collectivités territoriales" CSV
// from the dataset "Référentiel des établissements pouvant accéder aux données des logements vacants"
// https://www.data.gouv.fr/datasets/referentiel-des-etablissements-pouvant-acceder-aux-donnees-des-logements-vacants-2025
const ZLV_CSV_URL = "https://www.data.gouv.fr/api/1/datasets/r/8c494e8c-7fe6-4aa6-9d49-a7168d7260df";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Relevant columns in the ZLV CSV (semicolon-delimited)
export interface ZlvRecord {
  Siren: string;
  Siret: string;
  "Kind-admin": string;
  "Name-source": string;
  Dep_Code: string; // Python-style list, e.g. "['34']"
  Reg_Code: string;
}

// Kind-admin values we want to extract SIRET for
const RELEVANT_KINDS = new Set(["COM", "EPCI"]);

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  Attempt ${attempt}/${retries} failed: ${message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error(`Failed after ${retries} attempts`);
}

// "['2A', '2B']" -> ["2A", "2B"]
const parseCodes = (value: string | undefined): string[] =>
  (value ?? "")
    .replace(/[[\]']/g, "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "");

// Collectivité européenne d'Alsace: exercises the departmental competences of Bas-Rhin and
// Haut-Rhin since 2021, absent from ZLV.
const ALSACE = "200094332";
const SIREN_OVERRIDES: Record<string, string> = { "67": ALSACE, "68": ALSACE };

/**
 * SIREN of the collectivity exercising the competences of each department and region listed in
 * ZLV (code -> SIREN). A territory merged into a collectivité unique (Corse, Martinique, Guyane,
 * Mayotte region) has no SIREN of its own and takes the one of that collectivity ("ACT" rows);
 * Alsace comes from SIREN_OVERRIDES. A territory listed without any of these is left out.
 */
export function collectiviteSirensFromZlv(records: ZlvRecord[]): {
  departements: Map<string, string>;
  regions: Map<string, string>;
} {
  const departements = new Map<string, string>();
  const regions = new Map<string, string>();
  const departementsListes = new Set<string>();
  const regionsListees = new Set<string>();
  const isSiren = (siren: string | undefined): siren is string => /^\d{9}$/.test(siren ?? "");

  for (const r of records) {
    if (r["Kind-admin"] === "DEP") {
      const [code] = parseCodes(r.Dep_Code);
      if (!code) continue;
      departementsListes.add(code);
      if (isSiren(r.Siren)) departements.set(code, r.Siren);
    } else if (r["Kind-admin"] === "REG") {
      const [code] = parseCodes(r.Reg_Code);
      if (!code) continue;
      regionsListees.add(code);
      if (isSiren(r.Siren)) regions.set(code, r.Siren);
    }
  }
  // Collectivités uniques fill the gaps only: their own SIREN never replaces a department's.
  for (const r of records) {
    if (r["Kind-admin"] !== "ACT" || !isSiren(r.Siren)) continue;
    for (const code of parseCodes(r.Dep_Code)) {
      if (departementsListes.has(code) && !departements.has(code)) departements.set(code, r.Siren);
    }
    for (const code of parseCodes(r.Reg_Code)) {
      if (regionsListees.has(code) && !regions.has(code)) regions.set(code, r.Siren);
    }
  }
  for (const [code, siren] of Object.entries(SIREN_OVERRIDES)) {
    if (departementsListes.has(code) && !departements.has(code)) departements.set(code, siren);
  }
  return { departements, regions };
}

/** SIREN (9 chars) -> SIRET (14 chars) for communes and EPCIs (first SIRET kept). */
function siretMappingFromZlv(records: ZlvRecord[]): Map<string, string> {
  const siretMapping = new Map<string, string>();
  for (const { "Kind-admin": kind, Siren: siren, Siret: siret } of records) {
    if (!kind || !siren || !siret || !RELEVANT_KINDS.has(kind)) continue;
    if (siren.length !== 9 || siret.length !== 14) continue;
    if (!siretMapping.has(siren)) siretMapping.set(siren, siret);
  }
  return siretMapping;
}

function parseZlvCsv(csvText: string): Promise<ZlvRecord[]> {
  return new Promise<ZlvRecord[]>((resolve, reject) => {
    const records: ZlvRecord[] = [];
    const parser = parse({
      columns: true,
      delimiter: ",",
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    });
    parser.on("readable", () => {
      let record: ZlvRecord | null;
      while ((record = parser.read() as ZlvRecord | null) !== null) records.push(record);
    });
    parser.on("error", (error) => reject(new Error(`[zlv] CSV parsing error: ${error.message}`)));
    parser.on("end", () => resolve(records));
    Readable.from(csvText).pipe(parser);
  });
}

/**
 * Download the ZLV collectivites territoriales CSV (comma-delimited, UTF-8) and extract the
 * SIREN -> SIRET mapping of communes and EPCIs and the SIREN of departments and regions.
 */
export async function fetchZlv(): Promise<{
  siretMapping: Map<string, string>;
  departementSirens: Map<string, string>;
  regionSirens: Map<string, string>;
}> {
  console.log("[zlv] Downloading collectivites territoriales CSV...");
  const response = await fetchWithRetry(ZLV_CSV_URL);
  const csvText = await response.text();
  console.log(`[zlv] Downloaded ${(csvText.length / 1024).toFixed(0)} KB of CSV data`);

  const records = await parseZlvCsv(csvText);
  const siretMapping = siretMappingFromZlv(records);
  const { departements, regions } = collectiviteSirensFromZlv(records);
  console.log(
    `[zlv] Parsed ${records.length} rows: ${siretMapping.size} SIREN->SIRET, ` +
      `${departements.size} department and ${regions.size} region SIRENs`,
  );
  return { siretMapping, departementSirens: departements, regionSirens: regions };
}
