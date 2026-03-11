// Fetch and parse Banatic XLSX exports from banatic.interieur.gouv.fr
// for the referentiel seed pipeline.
//
// The Banatic "XLSX" files are actually ZIP archives containing XML files
// (Office Open XML format). We use `unzipper` to extract the relevant XML
// files (sharedStrings.xml + sheet1.xml), then parse them with regex.
//
// This approach avoids heavy XLSX libraries and matches the pattern used
// in the existing Python exploration scripts.

import * as fs from "fs";
import * as path from "path";
import { parse as csvParse } from "csv-parse/sync";
import unzipper from "unzipper";
import type { RawGroupement, RawGroupementCompetence, RawCompetenceCategorie, RawCompetence } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANATIC_BASE_URL = "https://www.banatic.interieur.gouv.fr/api/export/pregenere/telecharger";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// All 18 French regions (including overseas) used for fetching syndicat perimetres
const REGION_CODES = [
  "01", // Guadeloupe
  "02", // Martinique
  "03", // Guyane
  "04", // La Réunion
  "06", // Mayotte
  "11", // Île-de-France
  "24", // Centre-Val de Loire
  "27", // Bourgogne-Franche-Comté
  "28", // Normandie
  "32", // Hauts-de-France
  "44", // Grand Est
  "52", // Pays de la Loire
  "53", // Bretagne
  "75", // Nouvelle-Aquitaine
  "76", // Occitanie
  "84", // Auvergne-Rhône-Alpes
  "93", // Provence-Alpes-Côte d'Azur
  "94", // Corse
] as const;

// Syndicat types — these need regional exports for member→commune relationships
const SYNDICAT_TYPES = new Set(["SIVU", "SIVOM", "SMF", "SMO", "PETR", "POLEM"]);

// Types that represent Métropole variants, normalized to 'MET'
const METROPOLE_VARIANTS = new Set(["MET", "MET69", "MET70", "MET75"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Temporary type for perimetres before SIREN→INSEE conversion by the import service */
export interface BanaticRawPerimetre {
  sirenGroupement: string;
  sirenMembre: string;
  categorieMembre: string | null;
}

/** Column positions detected from the XLSX header row */
interface ColumnMap {
  siren: number;
  nom: number;
  type: number;
  departement: number;
  modeFinancement: number;
  dateCreation: number;
  nbMembres: number;
  population: number;
  sirenMembre: number;
  nomMembre: number;
  categorieMembre: number;
  // Competence columns: index → competence name (from header)
  competenceColumns: Map<number, string>;
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with retry logic and exponential backoff.
 */
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
      console.warn(
        `  Attempt ${attempt}/${retries} failed for ${url}: ${message}. Retrying in ${RETRY_DELAY_MS * attempt}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error(`Failed after ${retries} attempts`);
}

/**
 * Download a Banatic export to a local file.
 * Returns the path to the downloaded file.
 */
async function downloadExport(regionOrFrance: string, destPath: string): Promise<string> {
  const url = `${BANATIC_BASE_URL}/${regionOrFrance}`;
  console.log(`[banatic] Downloading ${regionOrFrance} export from ${url}...`);

  const response = await fetchWithRetry(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
  console.log(`[banatic] Downloaded ${regionOrFrance} (${sizeMb} MB) → ${destPath}`);

  return destPath;
}

// ---------------------------------------------------------------------------
// XLSX (ZIP/XML) parsing
// ---------------------------------------------------------------------------

/**
 * Extract sharedStrings.xml as a string from the XLSX ZIP archive.
 * sharedStrings.xml is small enough to fit in memory (~10-20 MB).
 */
async function extractSharedStringsXml(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const directory = await unzipper.Open.buffer(buffer);

  const sharedStringsFile = directory.files.find((f) => f.path === "xl/sharedStrings.xml");
  if (!sharedStringsFile) {
    throw new Error(`No xl/sharedStrings.xml found in ${filePath}`);
  }

  const buf = await sharedStringsFile.buffer();
  return buf.toString("utf-8");
}

/**
 * Stream-parse the worksheet XML (sheet1.xml) from an XLSX file.
 * The worksheet can exceed 512MB when decompressed, so we must stream it.
 *
 * We pipe the decompressed entry through a text-based state machine that
 * accumulates each `<row>...</row>` block, then parses it with regex.
 */
async function streamParseWorksheetRows(filePath: string, sharedStrings: string[]): Promise<ParsedRow[]> {
  const rows: ParsedRow[] = [];

  return new Promise<ParsedRow[]>((resolve, reject) => {
    const readStream = fs.createReadStream(filePath).pipe(unzipper.Parse());

    let worksheetFound = false;

    readStream.on("entry", (entry: unzipper.Entry) => {
      if (entry.path !== "xl/worksheets/sheet1.xml") {
        entry.autodrain();
        return;
      }

      worksheetFound = true;
      let leftover = "";

      entry.on("data", (chunk: Buffer) => {
        leftover += chunk.toString("utf-8");

        // Process complete <row>...</row> blocks
        let endIdx: number;
        while ((endIdx = leftover.indexOf("</row>")) !== -1) {
          const blockEnd = endIdx + "</row>".length;
          const block = leftover.substring(0, blockEnd);
          leftover = leftover.substring(blockEnd);

          // Find the <row> opening in this block
          const rowStartIdx = block.lastIndexOf("<row");
          if (rowStartIdx === -1) continue;

          const rowContent = block.substring(rowStartIdx, blockEnd);
          const parsed = parseSingleRow(rowContent, sharedStrings);
          if (parsed) {
            rows.push(parsed);
          }
        }
      });

      entry.on("end", () => {
        // Process any remaining content
        if (leftover.includes("<row")) {
          const rowStartIdx = leftover.lastIndexOf("<row");
          if (rowStartIdx !== -1) {
            const rowContent = leftover.substring(rowStartIdx);
            const parsed = parseSingleRow(rowContent, sharedStrings);
            if (parsed) {
              rows.push(parsed);
            }
          }
        }

        resolve(rows);
      });

      entry.on("error", reject);
    });

    readStream.on("close", () => {
      if (!worksheetFound) {
        reject(new Error(`No xl/worksheets/sheet1.xml found in ${filePath}`));
      }
    });

    readStream.on("error", reject);
  });
}

/**
 * Parse a single `<row ...>...</row>` XML block into a ParsedRow.
 */
function parseSingleRow(rowXml: string, sharedStrings: string[]): ParsedRow | null {
  const rowAttrMatch = rowXml.match(/<row[^>]*\s+r="(\d+)"/);
  if (!rowAttrMatch) return null;

  const rowNumber = parseInt(rowAttrMatch[1], 10);
  const cells: ParsedCell[] = [];

  const cellTagRegex = /<c\s([^>]*)>[\s\S]*?<\/c>|<c\s([^/]*)\/>/g;
  let cellTagMatch: RegExpExecArray | null;

  while ((cellTagMatch = cellTagRegex.exec(rowXml)) !== null) {
    const fullTag = cellTagMatch[0];
    const attrs = cellTagMatch[1] || cellTagMatch[2] || "";

    const refMatch = attrs.match(/r="([A-Z]+\d+)"/);
    if (!refMatch) continue;

    const colIndex = cellRefToColumnIndex(refMatch[1]);

    const typeMatch = attrs.match(/t="([^"]*)"/);
    const cellType = typeMatch ? typeMatch[1] : "";

    const vMatch = fullTag.match(/<v>([^<]*)<\/v>/);
    if (!vMatch) continue;

    const rawValue = vMatch[1];
    let value: string;

    if (cellType === "s") {
      const ssIndex = parseInt(rawValue, 10);
      value = ssIndex >= 0 && ssIndex < sharedStrings.length ? sharedStrings[ssIndex] : "";
    } else {
      value = decodeXmlEntities(rawValue);
    }

    cells.push({ colIndex, value });
  }

  return cells.length > 0 ? { rowNumber, cells } : null;
}

/**
 * Parse shared strings from the sharedStrings.xml file.
 *
 * Each `<si>` element can contain:
 *   - A simple `<t>text</t>`
 *   - Multiple `<r>` (rich text run) elements, each with `<t>text</t>`
 *
 * We concatenate all `<t>` values within each `<si>` block to handle
 * both simple and rich text entries.
 */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;

  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1];
    let concatenated = "";
    let tMatch: RegExpExecArray | null;

    // Reset the tRegex lastIndex for each <si> block
    tRegex.lastIndex = 0;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      concatenated += tMatch[1];
    }

    // Decode basic XML entities
    strings.push(decodeXmlEntities(concatenated));
  }

  return strings;
}

/**
 * Decode common XML entities in text content.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Parse a cell reference (e.g., "A1", "AB123") into column index (0-based).
 */
function cellRefToColumnIndex(ref: string): number {
  const colLetters = ref.replace(/[0-9]/g, "");
  let index = 0;
  for (let i = 0; i < colLetters.length; i++) {
    index = index * 26 + (colLetters.charCodeAt(i) - "A".charCodeAt(0) + 1);
  }
  return index - 1; // 0-based
}

/** Represents a single parsed cell from the worksheet */
interface ParsedCell {
  colIndex: number;
  value: string;
}

/** Represents a parsed row from the worksheet */
interface ParsedRow {
  rowNumber: number;
  cells: ParsedCell[];
}

// parseWorksheetRows has been replaced by streamParseWorksheetRows above

/**
 * Get a cell value from a parsed row by column index.
 * Returns empty string if the column is not present.
 */
function getCellValue(row: ParsedRow, colIndex: number): string {
  const cell = row.cells.find((c) => c.colIndex === colIndex);
  return cell?.value ?? "";
}

// ---------------------------------------------------------------------------
// Column detection from header row
// ---------------------------------------------------------------------------

/**
 * Detect column positions by matching header names (case-insensitive, trimmed).
 *
 * We use substring matching so minor Banatic header wording changes
 * (e.g., accent variations) are tolerated.
 */
function detectColumns(headerRow: ParsedRow): ColumnMap {
  const columnMap: ColumnMap = {
    siren: -1,
    nom: -1,
    type: -1,
    departement: -1,
    modeFinancement: -1,
    dateCreation: -1,
    nbMembres: -1,
    population: -1,
    sirenMembre: -1,
    nomMembre: -1,
    categorieMembre: -1,
    competenceColumns: new Map(),
  };

  // Build a map of colIndex → header name for all cells
  const headers = new Map<number, string>();
  for (const cell of headerRow.cells) {
    headers.set(cell.colIndex, cell.value.trim());
  }

  // Columns that mark the boundaries of the competence range
  let nbCompetencesColIndex = -1;
  let adhesionColIndex = -1;

  for (const [colIndex, header] of headers) {
    const lowerHeader = header.toLowerCase();

    // Match known columns by checking if the header contains the key phrase
    if (lowerHeader.includes("siren") && !lowerHeader.includes("membre")) {
      // "N° SIREN" — groupement SIREN
      if (columnMap.siren === -1) {
        columnMap.siren = colIndex;
      }
    } else if (lowerHeader.includes("nom du groupement")) {
      columnMap.nom = colIndex;
    } else if (lowerHeader.includes("nature juridique")) {
      columnMap.type = colIndex;
    } else if (lowerHeader === "département" || lowerHeader === "departement") {
      columnMap.departement = colIndex;
    } else if (lowerHeader.includes("mode de financement")) {
      columnMap.modeFinancement = colIndex;
    } else if (lowerHeader.includes("date de création") || lowerHeader.includes("date de creation")) {
      columnMap.dateCreation = colIndex;
    } else if (lowerHeader.includes("nombre total de membres")) {
      columnMap.nbMembres = colIndex;
    } else if (lowerHeader.includes("population totale") || lowerHeader.includes("population regroupée")) {
      columnMap.population = colIndex;
    } else if (lowerHeader.includes("siren membre") || lowerHeader.includes("siren du membre")) {
      columnMap.sirenMembre = colIndex;
    } else if (lowerHeader.includes("nom membre") || lowerHeader.includes("nom du membre")) {
      columnMap.nomMembre = colIndex;
    } else if (lowerHeader.includes("catégorie") && lowerHeader.includes("membre")) {
      columnMap.categorieMembre = colIndex;
    } else if (lowerHeader.includes("nombre de compétences") || lowerHeader.includes("nombre de competences")) {
      nbCompetencesColIndex = colIndex;
    } else if (lowerHeader.includes("adhésion") || lowerHeader.includes("adhesion")) {
      adhesionColIndex = colIndex;
    }
  }

  // Validate that all required columns were found
  const requiredCols: Array<[keyof Omit<ColumnMap, "competenceColumns">, string]> = [
    ["siren", "N° SIREN"],
    ["nom", "Nom du groupement"],
    ["type", "Nature juridique"],
  ];
  for (const [key, label] of requiredCols) {
    if (columnMap[key] === -1) {
      throw new Error(
        `[banatic] Required column "${label}" not found in headers. Available headers: ${[...headers.values()].join(", ")}`,
      );
    }
  }

  // Detect competence columns: all columns AFTER "Nombre de compétences exercées"
  // and BEFORE "Adhésion" (or end of headers)
  if (nbCompetencesColIndex >= 0) {
    const lowerBound = nbCompetencesColIndex;
    const upperBound = adhesionColIndex >= 0 ? adhesionColIndex : Infinity;

    for (const [colIndex, header] of headers) {
      if (colIndex > lowerBound && colIndex < upperBound && header.length > 0) {
        columnMap.competenceColumns.set(colIndex, header);
      }
    }
  }

  console.log(`[banatic] Detected ${columnMap.competenceColumns.size} competence columns`);

  return columnMap;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/**
 * Convert a date string from DD/MM/YYYY format to ISO YYYY-MM-DD format.
 * Returns null if the input is empty or unparseable.
 */
function parseDateToIso(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;

  const trimmed = dateStr.trim();

  // Try DD/MM/YYYY format
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Try YYYY-MM-DD format (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Excel serial date number — Banatic sometimes stores dates as integers
  const numValue = parseInt(trimmed, 10);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    // Excel epoch is 1900-01-01, but has the 1900-02-29 bug (+1 offset)
    const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
    const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Type normalization
// ---------------------------------------------------------------------------

/**
 * Normalize the "Nature juridique" type string from Banatic.
 *
 * The XLSX contains abbreviations like 'CA', 'CC', 'CU', 'MET69', 'MET70',
 * 'MET75', 'SIVU', 'SIVOM', 'SMF', 'SMO', 'PETR', 'POLEM'.
 *
 * We normalize all Métropole variants (MET69, MET70, MET75) to 'MET'.
 */
function normalizeType(rawType: string): string {
  const trimmed = rawType.trim().toUpperCase();

  if (METROPOLE_VARIANTS.has(trimmed)) {
    return "MET";
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Competence reference data (static CSV files)
// ---------------------------------------------------------------------------

/**
 * Load the competence reference data from the static CSV files.
 *
 * These files are semicolon-delimited:
 *   - banatic-categorie-competences.csv: Code;Nom (15 categories)
 *   - banatic-codes-competences.csv: Code;Nom;Categorie (130 competences)
 */
export async function loadCompetenceReference(dataDir: string): Promise<{
  categories: RawCompetenceCategorie[];
  competences: RawCompetence[];
}> {
  console.log("[banatic] Loading competence reference data...");

  // Read category CSV
  const categoriesPath = path.join(dataDir, "banatic-categorie-competences.csv");
  const categoriesContent = fs.readFileSync(categoriesPath, "utf-8");
  const categoriesRows: Array<{ Code: string; Nom: string }> = csvParse(categoriesContent, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const categories: RawCompetenceCategorie[] = categoriesRows.map((row) => ({
    code: row.Code,
    nom: row.Nom,
  }));

  // Read competences CSV
  const competencesPath = path.join(dataDir, "banatic-codes-competences.csv");
  const competencesContent = fs.readFileSync(competencesPath, "utf-8");
  const competencesRows: Array<{
    Code: string;
    Nom: string;
    Categorie: string;
  }> = csvParse(competencesContent, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // The CSV has trailing semicolons
  });

  const competences: RawCompetence[] = competencesRows.map((row) => ({
    code: row.Code,
    nom: row.Nom,
    codeCategorie: row.Categorie,
  }));

  console.log(
    `[banatic] Loaded ${categories.length} categories and ${competences.length} competences from reference CSVs`,
  );

  return { categories, competences };
}

// ---------------------------------------------------------------------------
// Build competence name→code lookup from reference data
// ---------------------------------------------------------------------------

/**
 * Build a mapping from competence name (normalized) to competence code.
 *
 * The XLSX column headers contain competence names, and we need to map
 * them to the official codes from the reference CSV. We normalize names
 * by trimming, lowercasing, and collapsing whitespace for fuzzy matching.
 */
function buildCompetenceNameToCodeMap(competences: RawCompetence[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const comp of competences) {
    const normalizedName = normalizeCompetenceName(comp.nom);
    map.set(normalizedName, comp.code);
  }

  return map;
}

/**
 * Normalize a competence name for matching.
 * Trims, lowercases, collapses whitespace, and removes some punctuation.
 */
function normalizeCompetenceName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/['']/g, "'");
}

// ---------------------------------------------------------------------------
// Main parsing: France export → groupements + competences
// ---------------------------------------------------------------------------

/**
 * Download and parse the France Banatic export to extract all groupements
 * and their competence flags.
 *
 * The XLSX file is ~73 MB. We download it to /tmp, extract the XML from
 * the ZIP, parse shared strings, then process the worksheet row by row.
 *
 * Multiple rows can share the same SIREN (one row per member commune).
 * We take groupement data from the first row for each SIREN, and extract
 * competence flags from that same first row.
 */
export async function fetchBanaticGroupements(dataDir: string): Promise<{
  groupements: RawGroupement[];
  groupementCompetences: RawGroupementCompetence[];
}> {
  // Step 1: Download France export
  const tmpPath = "/tmp/banatic-france.xlsx";
  await downloadExport("France", tmpPath);

  // Step 2: Extract shared strings from XLSX (small file, fits in memory)
  console.log("[banatic] Extracting shared strings from XLSX...");
  const sharedStringsXml = await extractSharedStringsXml(tmpPath);

  // Step 3: Parse shared strings
  console.log("[banatic] Parsing shared strings...");
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  console.log(`[banatic] Found ${sharedStrings.length} shared strings`);

  // Step 4: Stream-parse worksheet rows (sheet1.xml can exceed 512MB)
  console.log("[banatic] Streaming worksheet rows...");
  const rows = await streamParseWorksheetRows(tmpPath, sharedStrings);
  console.log(`[banatic] Parsed ${rows.length} rows from worksheet`);

  if (rows.length === 0) {
    throw new Error("[banatic] No rows found in worksheet");
  }

  // Step 5: Detect column positions from header row (row 1)
  const headerRow = rows[0];
  const columns = detectColumns(headerRow);

  // Step 6: Load competence reference data for name→code mapping
  const { competences: refCompetences } = await loadCompetenceReference(dataDir);
  const competenceNameToCode = buildCompetenceNameToCodeMap(refCompetences);

  // Build the mapping from XLSX column index → competence code
  const colIndexToCompetenceCode = new Map<number, string>();
  let unmappedCompetences = 0;

  for (const [colIndex, headerName] of columns.competenceColumns) {
    const normalizedName = normalizeCompetenceName(headerName);
    const code = competenceNameToCode.get(normalizedName);

    if (code) {
      colIndexToCompetenceCode.set(colIndex, code);
    } else {
      // Try partial matching: find the reference competence whose normalized
      // name starts with or contains the header text, or vice versa
      let found = false;
      for (const [refNorm, refCode] of competenceNameToCode) {
        if (refNorm.startsWith(normalizedName) || normalizedName.startsWith(refNorm)) {
          colIndexToCompetenceCode.set(colIndex, refCode);
          found = true;
          break;
        }
      }
      if (!found) {
        unmappedCompetences++;
      }
    }
  }

  if (unmappedCompetences > 0) {
    console.warn(
      `[banatic] Warning: ${unmappedCompetences} competence column(s) could not be mapped to reference codes`,
    );
  }
  console.log(`[banatic] Mapped ${colIndexToCompetenceCode.size} competence columns to codes`);

  // Step 7: Process data rows — aggregate by SIREN
  const groupementsMap = new Map<string, RawGroupement>();
  const allCompetences: RawGroupementCompetence[] = [];
  const seenSirens = new Set<string>();
  let skippedNoSiren = 0;
  let processedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    processedRows++;

    const siren = getCellValue(row, columns.siren).trim();
    if (!siren || siren.length < 9) {
      skippedNoSiren++;
      continue;
    }

    // Only take groupement data + competences from the first row for each SIREN
    if (seenSirens.has(siren)) {
      continue;
    }
    seenSirens.add(siren);

    // Extract groupement data
    const rawType = getCellValue(row, columns.type);
    const type = normalizeType(rawType);

    // Parse nbMembres and population as numbers
    const nbMembresStr = getCellValue(row, columns.nbMembres);
    const populationStr = getCellValue(row, columns.population);
    const nbMembres = nbMembresStr ? parseInt(nbMembresStr, 10) : null;
    const population = populationStr ? parseInt(populationStr, 10) : null;

    // Parse departement — could be a code or a code + name
    const departementRaw = getCellValue(row, columns.departement).trim();

    // Parse date
    const dateCreationRaw = columns.dateCreation >= 0 ? getCellValue(row, columns.dateCreation) : "";
    const dateCreation = parseDateToIso(dateCreationRaw);

    // Parse mode de financement
    const modeFinancement =
      columns.modeFinancement >= 0 ? getCellValue(row, columns.modeFinancement).trim() || null : null;

    const groupement: RawGroupement = {
      siren,
      siret: null, // Will be enriched later if available
      nom: getCellValue(row, columns.nom).trim(),
      type,
      population: population !== null && !isNaN(population) ? population : null,
      nbCommunes: nbMembres !== null && !isNaN(nbMembres) ? nbMembres : null,
      departements: departementRaw ? [departementRaw] : [],
      regions: [], // Will be enriched from commune data by the import service
      modeFinancement,
      dateCreation,
    };

    groupementsMap.set(siren, groupement);

    // Extract competences for this groupement (check OUI/NON flags)
    for (const [colIndex, compCode] of colIndexToCompetenceCode) {
      const cellValue = getCellValue(row, colIndex).trim().toUpperCase();
      if (cellValue === "OUI") {
        allCompetences.push({
          sirenGroupement: siren,
          codeCompetence: compCode,
        });
      }
    }
  }

  const groupements = Array.from(groupementsMap.values());

  console.log(`[banatic] Processed ${processedRows} data rows, skipped ${skippedNoSiren} without SIREN`);
  console.log(`[banatic] Extracted ${groupements.length} unique groupements`);
  console.log(`[banatic] Extracted ${allCompetences.length} groupement-competence associations`);

  // Clean up temp file
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // Ignore cleanup errors
  }

  return {
    groupements,
    groupementCompetences: allCompetences,
  };
}

// ---------------------------------------------------------------------------
// Perimetres: regional exports → syndicat member lists
// ---------------------------------------------------------------------------

/**
 * Download and parse all 18 regional Banatic exports to extract
 * syndicat → commune member relationships.
 *
 * For syndicats (SIVU, SIVOM, SMF, SMO, PETR, POLEM), the member
 * relationships are only available in regional exports, not in the
 * France-level export.
 *
 * Returns members with `sirenMembre` (not codeInseeCommune). The import
 * service is responsible for converting SIREN → INSEE using the communes
 * reference data.
 */
export async function fetchBanaticPerimetres(): Promise<BanaticRawPerimetre[]> {
  console.log(`[banatic] Fetching perimetres from ${REGION_CODES.length} regional exports...`);

  const allPerimetres: BanaticRawPerimetre[] = [];
  let regionCount = 0;

  for (const regionCode of REGION_CODES) {
    regionCount++;
    console.log(`[banatic] Region ${regionCount}/${REGION_CODES.length}: ${regionCode}`);

    try {
      const perimetres = await fetchRegionalPerimetres(regionCode);
      allPerimetres.push(...perimetres);
      console.log(`[banatic]   → ${perimetres.length} syndicat member records`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[banatic] Error processing region ${regionCode}: ${message}`);
      // Continue with other regions rather than failing entirely
    }
  }

  console.log(`[banatic] Total syndicat perimetres: ${allPerimetres.length}`);

  return allPerimetres;
}

/**
 * Download and parse a single regional Banatic export to extract
 * syndicat member records.
 */
async function fetchRegionalPerimetres(regionCode: string): Promise<BanaticRawPerimetre[]> {
  const tmpPath = `/tmp/banatic-region-${regionCode}.xlsx`;

  try {
    await downloadExport(regionCode, tmpPath);

    const sharedStringsXml = await extractSharedStringsXml(tmpPath);
    const sharedStrings = parseSharedStrings(sharedStringsXml);
    const rows = await streamParseWorksheetRows(tmpPath, sharedStrings);

    if (rows.length === 0) {
      return [];
    }

    // Detect columns from header row
    const columns = detectColumns(rows[0]);
    const perimetres: BanaticRawPerimetre[] = [];

    // Process data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const sirenGroupement = getCellValue(row, columns.siren).trim();
      if (!sirenGroupement || sirenGroupement.length < 9) {
        continue;
      }

      // Only extract members of syndicat-type groupements
      const rawType = getCellValue(row, columns.type);
      const type = normalizeType(rawType);
      if (!SYNDICAT_TYPES.has(type)) {
        continue;
      }

      // Extract member SIREN
      const sirenMembre = columns.sirenMembre >= 0 ? getCellValue(row, columns.sirenMembre).trim() : "";
      if (!sirenMembre || sirenMembre.length < 9) {
        continue;
      }

      // Extract member category (may be absent)
      const categorieMembre =
        columns.categorieMembre >= 0 ? getCellValue(row, columns.categorieMembre).trim() || null : null;

      perimetres.push({
        sirenGroupement,
        sirenMembre,
        categorieMembre,
      });
    }

    return perimetres;
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
