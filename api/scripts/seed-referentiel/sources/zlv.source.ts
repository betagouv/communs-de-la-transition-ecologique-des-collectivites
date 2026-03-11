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
interface ZlvRecord {
  Siren: string;
  Siret: string;
  "Kind-admin": string;
  "Name-source": string;
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

/**
 * Download the ZLV collectivites territoriales CSV and extract
 * SIREN (9 chars) -> SIRET (14 chars) mapping for communes and EPCIs.
 *
 * The CSV is semicolon-delimited and UTF-8 encoded.
 */
export async function fetchSiretMapping(): Promise<Map<string, string>> {
  console.log("[zlv] Downloading collectivites territoriales CSV...");
  const response = await fetchWithRetry(ZLV_CSV_URL);

  const csvText = await response.text();
  console.log(`[zlv] Downloaded ${(csvText.length / 1024).toFixed(0)} KB of CSV data`);

  const siretMapping = new Map<string, string>();

  return new Promise<Map<string, string>>((resolve, reject) => {
    const parser = parse({
      columns: true,
      delimiter: ",",
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    });

    let totalRows = 0;
    let matchedRows = 0;

    parser.on("readable", () => {
      let record: ZlvRecord | null;
      while ((record = parser.read() as ZlvRecord | null) !== null) {
        totalRows++;

        const kind = record["Kind-admin"];
        const siren = record.Siren;
        const siret = record.Siret;

        if (!kind || !siren || !siret) {
          continue;
        }

        if (!RELEVANT_KINDS.has(kind)) {
          continue;
        }

        // Validate SIREN (9 digits) and SIRET (14 digits)
        if (siren.length !== 9 || siret.length !== 14) {
          continue;
        }

        // Keep first occurrence (some entities may have multiple SIRETs)
        if (!siretMapping.has(siren)) {
          siretMapping.set(siren, siret);
          matchedRows++;
        }
      }
    });

    parser.on("error", (error) => {
      reject(new Error(`[zlv] CSV parsing error: ${error.message}`));
    });

    parser.on("end", () => {
      console.log(`[zlv] Parsed ${totalRows} rows, extracted ${matchedRows} SIREN->SIRET mappings`);
      resolve(siretMapping);
    });

    // Feed the downloaded text into the parser
    const readable = Readable.from(csvText);
    readable.pipe(parser);
  });
}
