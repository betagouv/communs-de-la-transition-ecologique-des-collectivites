/**
 * Import DGCL "dotations d'investissement local" (DETR / DSIL / DPV / DSID …)
 * into schema_commun_v2.
 *
 * Each CSV row (one subsidy attributed to a beneficiary for a given project)
 * becomes:
 *   - one row in schema_commun_v2.projets_operationnels (source_origine = 'DGCL'),
 *   - one row in schema_commun_v2.financements (source = the dispositif),
 *   - a link in liens_financements_projets,
 *   - one or more links in liens_projets_communes:
 *       · commune beneficiary  → the commune itself,
 *       · EPCI/groupement      → all its member communes (api_referentiel.perimetres),
 *       · other (syndicat mixte, PETR, département, unknown SIREN) → no commune link
 *         (kept attached by collectiviteResponsableSiren only).
 *
 * Idempotent: projet/financement ids are deterministic UUIDv5 derived from the
 * row's natural key, so re-running upserts via ON CONFLICT DO NOTHING.
 *
 * NOTE: schema_commun_v2 is normally rebuilt by the nightly ETL pipeline. Rows
 * tagged source_origine = 'DGCL' may be wiped on a full rebuild and need a
 * re-import. This is a deliberate, accepted trade-off (writing here from the API
 * repo rather than from the ETL repo).
 *
 * Usage:
 *   DATABASE_URL=… npx ts-node scripts/import-dgcl-dotations/import-dgcl-dotations.ts [options]
 * Options:
 *   --dry-run         parse + map + report stats, no DB writes
 *   --year=YYYY       import a single exercice (default: all CSVs found in ./data)
 *   --limit=N         only process the first N valid rows per file (sampling)
 *   --data-dir=PATH   directory holding the CSVs (default: ./data next to this script)
 */
import { parse } from "csv-parse";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { join } from "node:path";
import pg from "pg";

// Projet source_origine = "DGCL " + dotation family (DETR / DSIL / DPV / DSID).
// The exact dispositif (incl. "DSIL RT", "DSIL Exceptionnelle", "DSID RT") is
// preserved on the linked financement.source; here we only keep the family so the
// dashboard "Source" facet stays readable. All DGCL rows share the "DGCL " prefix
// (rollback: WHERE source_origine LIKE 'DGCL%').
const SOURCE_PREFIX = "DGCL";
function dotationFamily(dispositif: string): string {
  const d = dispositif.toUpperCase();
  if (d.startsWith("DETR")) return "DETR";
  if (d.startsWith("DSIL")) return "DSIL";
  if (d.startsWith("DPV")) return "DPV";
  if (d.startsWith("DSID")) return "DSID";
  return dispositif || "Autre";
}
// Fixed namespace UUID for deterministic v5 ids (random, stable forever).
const NAMESPACE = "6f1d0b3e-2a4c-5e8a-9c1f-7b3d2e6a4c8f";

interface CsvRow {
  exercice: string;
  dispositif: string;
  programme: string;
  beneficiaire_type: string;
  beneficiaire_siren: string;
  beneficiaire_dep: string;
  beneficiaire_nom: string;
  beneficiaire_code_insee: string;
  intitule: string;
  cout_ht: string;
  subvention: string;
  taux: string;
}

interface Args {
  dryRun: boolean;
  year?: string;
  limit?: number;
  dataDir: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  return {
    dryRun: argv.includes("--dry-run"),
    year: get("year"),
    limit: get("limit") ? Number(get("limit")) : undefined,
    dataDir: get("data-dir") ?? join(__dirname, "data"),
  };
}

/** RFC 4122 name-based UUID v5 (SHA-1), dependency-free. */
function uuidv5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(nsBytes).update(Buffer.from(name, "utf8")).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** "10114,0" → 10114 (rounded euros). Empty/invalid → null. */
function toEuros(raw: string | undefined): number | null {
  if (!raw) return null;
  const v = Number(String(raw).replace(",", "."));
  return Number.isFinite(v) ? Math.round(v) : null;
}

const isInsee = (s: string) => /^(\d{5}|2[AB]\d{3})$/.test(s);
const isSiren = (s: string) => /^\d{9}$/.test(s);

interface Mapped {
  projetId: string;
  financementId: string;
  sourceOrigine: string; // "DGCL " + dotation family
  nom: string;
  budget: number | null;
  dateDebut: string;
  siren: string | null;
  communeLinks: string[]; // resolved + validated INSEE codes (may be empty)
  source: string; // dispositif
  programme: string | null;
  coutHt: number | null;
  subvention: number | null;
  dateAttribution: string;
}

function mapRow(r: CsvRow, validInsee: Set<string>, groupementCommunes: Map<string, string[]>): Mapped | null {
  const intitule = (r.intitule ?? "").trim();
  const siren = isSiren(r.beneficiaire_siren) ? r.beneficiaire_siren : null;
  const rawInsee = isInsee(r.beneficiaire_code_insee) ? r.beneficiaire_code_insee : null;
  // A row must attach to a collectivité one way or another.
  if (!siren && !rawInsee) return null;
  if (!intitule) return null;

  // Resolve commune links: the commune itself, or the EPCI's member communes.
  let communeLinks: string[] = [];
  if (rawInsee && validInsee.has(rawInsee)) {
    communeLinks = [rawInsee];
  } else if (siren && groupementCommunes.has(siren)) {
    communeLinks = groupementCommunes.get(siren) as string[];
  }

  const exercice = (r.exercice ?? "").trim();
  const dispositif = (r.dispositif ?? "").trim() || "DGCL";
  // Natural key — stable across runs for the same source line.
  const key = [exercice, r.dispositif, r.beneficiaire_siren, r.beneficiaire_code_insee, intitule, r.subvention].join(
    "|",
  );

  return {
    projetId: uuidv5(`projet:${key}`, NAMESPACE),
    financementId: uuidv5(`financement:${key}`, NAMESPACE),
    sourceOrigine: `${SOURCE_PREFIX} ${dotationFamily(dispositif)}`,
    nom: intitule,
    budget: toEuros(r.cout_ht),
    dateDebut: `${exercice}-01-01`,
    siren,
    communeLinks,
    source: dispositif,
    programme: (r.programme ?? "").trim() || null,
    coutHt: toEuros(r.cout_ht),
    subvention: toEuros(r.subvention),
    dateAttribution: `${exercice}-01-01`,
  };
}

async function loadValidInsee(client: pg.Client): Promise<Set<string>> {
  const r = await client.query<{ code_insee: string }>("SELECT code_insee FROM api_referentiel.communes");
  return new Set(r.rows.map((x) => x.code_insee));
}

/** SIREN of groupement → its member communes (validated against the communes set). */
async function loadGroupementCommunes(client: pg.Client, validInsee: Set<string>): Promise<Map<string, string[]>> {
  const r = await client.query<{ siren_groupement: string; code_insee_commune: string }>(
    "SELECT siren_groupement, code_insee_commune FROM api_referentiel.perimetres",
  );
  const map = new Map<string, string[]>();
  for (const row of r.rows) {
    if (!validInsee.has(row.code_insee_commune)) continue;
    const arr = map.get(row.siren_groupement);
    if (arr) arr.push(row.code_insee_commune);
    else map.set(row.siren_groupement, [row.code_insee_commune]);
  }
  return map;
}

function readRows(file: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    fs.createReadStream(file)
      .pipe(
        parse({
          bom: true,
          delimiter: ";",
          columns: true,
          skip_empty_lines: true,
          relax_quotes: true,
          relax_column_count: true,
          trim: true,
        }),
      )
      .on("data", (r: CsvRow) => rows.push(r))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

const BATCH = 500;

async function insertBatch(client: pg.Client, mapped: Mapped[]): Promise<void> {
  for (let i = 0; i < mapped.length; i += BATCH) {
    const chunk = mapped.slice(i, i + BATCH);
    await client.query("BEGIN");
    try {
      await bulkInsert(
        client,
        `schema_commun_v2.projets_operationnels (id, nom, source_origine, "budgetPrevisionnel", "dateDebut", "collectiviteResponsableSiren", "territoireCommunes", statut_financements)`,
        chunk.map((m) => [
          m.projetId,
          m.nom,
          m.sourceOrigine,
          m.budget?.toString() ?? null,
          m.dateDebut,
          m.siren,
          m.communeLinks.length === 1 ? m.communeLinks[0] : null,
          "Attribué",
        ]),
        8,
        "(id) DO NOTHING",
      );
      await bulkInsert(
        client,
        `schema_commun_v2.financements (id, source, "referenceExterne", "montantDemande", "dateAttribution", "montantAttribue", statut)`,
        chunk.map((m) => [
          m.financementId,
          m.source,
          m.programme,
          m.coutHt?.toString() ?? null,
          m.dateAttribution,
          m.subvention?.toString() ?? null,
          "Attribué",
        ]),
        7,
        "(id) DO NOTHING",
      );
      await bulkInsert(
        client,
        `schema_commun_v2.liens_financements_projets (financement_id, projet_id)`,
        chunk.map((m) => [m.financementId, m.projetId]),
        2,
        "(financement_id, projet_id) DO NOTHING",
      );
      const communeLinks = chunk.flatMap((m) => m.communeLinks.map((insee) => [m.projetId, insee]));
      await bulkInsert(
        client,
        `schema_commun_v2.liens_projets_communes (projet_id, insee_com)`,
        communeLinks,
        2,
        "(projet_id, insee_com) DO NOTHING",
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
}

/** Multi-row INSERT, sub-chunked to stay well under Postgres' 65535 param limit. */
async function bulkInsert(
  client: pg.Client,
  target: string,
  rows: (string | null)[][],
  cols: number,
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const maxRows = Math.floor(60000 / cols);
  for (let i = 0; i < rows.length; i += maxRows) {
    const slice = rows.slice(i, i + maxRows);
    const values: (string | null)[] = [];
    const tuples = slice.map((row, ri) => {
      const ph = Array.from({ length: cols }, (_, ci) => `$${ri * cols + ci + 1}`);
      values.push(...row);
      return `(${ph.join(",")})`;
    });
    await client.query(`INSERT INTO ${target} VALUES ${tuples.join(",")} ON CONFLICT ${onConflict}`, values);
  }
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const files = fs
    .readdirSync(args.dataDir)
    .filter((f) => f.endsWith(".csv") && (!args.year || f.includes(args.year)))
    .sort()
    .map((f) => join(args.dataDir, f));
  if (files.length === 0) {
    console.error(`No CSV found in ${args.dataDir}${args.year ? ` for year ${args.year}` : ""}`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Connected. Loading referentiel…`);
  const validInsee = await loadValidInsee(client);
  const groupementCommunes = await loadGroupementCommunes(client, validInsee);
  console.log(`  ${validInsee.size} communes, ${groupementCommunes.size} groupements (EPCI→communes).`);

  let grandTotal = 0;
  let grandMapped = 0;
  let grandSkipped = 0;
  let grandWithCommune = 0;
  let grandCommuneLinks = 0;

  for (const file of files) {
    const rows = await readRows(file);
    const mapped: Mapped[] = [];
    let skipped = 0;
    for (const r of rows) {
      if (args.limit && mapped.length >= args.limit) break;
      const m = mapRow(r, validInsee, groupementCommunes);
      if (m) mapped.push(m);
      else skipped++;
    }
    const withCommune = mapped.filter((m) => m.communeLinks.length > 0).length;
    const links = mapped.reduce((n, m) => n + m.communeLinks.length, 0);
    grandTotal += rows.length;
    grandMapped += mapped.length;
    grandSkipped += skipped;
    grandWithCommune += withCommune;
    grandCommuneLinks += links;
    console.log(
      `${file.split("/").pop()}: lues=${rows.length} mappées=${mapped.length} (avec commune=${withCommune}, sansCommune=${mapped.length - withCommune}, liensCommune=${links}) ignorées=${skipped}`,
    );
    if (!args.dryRun) {
      await insertBatch(client, mapped);
      console.log(`  → inséré (idempotent).`);
    }
  }

  console.log("\n=== TOTAL ===");
  console.log(`lignes lues:           ${grandTotal}`);
  console.log(`projets+financements:  ${grandMapped}`);
  console.log(`  avec lien commune:   ${grandWithCommune}`);
  console.log(`  sans lien commune:   ${grandMapped - grandWithCommune}`);
  console.log(`liens projet→commune:  ${grandCommuneLinks}`);
  console.log(`lignes ignorées:       ${grandSkipped}`);
  console.log(args.dryRun ? "(dry-run — aucune écriture)" : "(écriture effectuée)");

  await client.end();
}

void main();
