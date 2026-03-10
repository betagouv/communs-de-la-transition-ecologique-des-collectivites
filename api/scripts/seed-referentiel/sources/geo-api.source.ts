// Fetch commune and EPCI data from geo.api.gouv.fr for the referentiel seed pipeline

import type { RawCommune } from "./types";

const GEO_API_BASE_URL = "https://geo.api.gouv.fr";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface GeoApiCommune {
  code: string; // INSEE code
  nom: string;
  siren?: string;
  codeEpci?: string;
  codeDepartement?: string;
  codeRegion?: string;
  population?: number;
  codesPostaux?: string[];
}

interface GeoApiEpci {
  code: string; // SIREN
  nom: string;
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
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
      console.warn(`  Attempt ${attempt}/${retries} failed for ${url}: ${message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error(`Failed after ${retries} attempts`);
}

/**
 * Fetch all communes from geo.api.gouv.fr.
 * Filters out communes without a SIREN (a handful exist in the dataset).
 */
export async function fetchCommunes(): Promise<RawCommune[]> {
  const fields = "nom,code,siren,codeEpci,codeDepartement,codeRegion,population,codesPostaux";
  const url = `${GEO_API_BASE_URL}/communes?fields=${fields}&limit=50000`;

  console.log("[geo-api] Fetching communes...");
  const response = await fetchWithRetry(url);
  const data: GeoApiCommune[] = await response.json();
  console.log(`[geo-api] Received ${data.length} communes from API`);

  const communes: RawCommune[] = [];
  let skippedNoSiren = 0;

  for (const entry of data) {
    if (!entry.siren) {
      skippedNoSiren++;
      continue;
    }

    communes.push({
      codeInsee: entry.code,
      siren: entry.siren,
      siret: null, // Will be enriched from ZLV source
      nom: entry.nom,
      population: entry.population ?? null,
      codesPostaux: entry.codesPostaux ?? [],
      codeDepartement: entry.codeDepartement ?? null,
      codeRegion: entry.codeRegion ?? null,
      codeEpci: entry.codeEpci ?? null,
    });
  }

  if (skippedNoSiren > 0) {
    console.log(`[geo-api] Skipped ${skippedNoSiren} communes without SIREN`);
  }
  console.log(`[geo-api] Mapped ${communes.length} communes`);

  return communes;
}

/**
 * Fetch EPCI names from the bulk endpoint.
 * Returns a Map of SIREN -> nom for all EPCIs.
 *
 * The EPCI type info (CA, CC, CU, MET) is NOT available from geo.api.gouv.fr
 * and will be enriched from the Banatic source.
 */
export async function fetchEpciNames(): Promise<Map<string, string>> {
  const url = `${GEO_API_BASE_URL}/epcis?fields=nom,code&limit=5000`;

  console.log("[geo-api] Fetching EPCI names...");
  const response = await fetchWithRetry(url);
  const data: GeoApiEpci[] = await response.json();
  console.log(`[geo-api] Received ${data.length} EPCIs from API`);

  const epciNames = new Map<string, string>();
  for (const entry of data) {
    epciNames.set(entry.code, entry.nom);
  }

  return epciNames;
}
