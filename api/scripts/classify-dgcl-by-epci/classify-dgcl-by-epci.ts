/**
 * Classify DGCL "dotations" projects (DETR / DSIL / DPV / DSID) of one or more
 * EPCIs, reusing the existing batch-classification building blocks.
 *
 * DGCL rows are bulk-imported into schema_commun_v2.projets_operationnels with no
 * LLM classification (see import-dgcl-dotations.ts), so they carry none of the
 * llm_sites / llm_thematiques / llm_interventions / llm_probabilite_te signals the
 * cross-source dedup/clustering relies on. This script fills those columns for the
 * DGCL rows of a given perimeter — on demand, EPCI by EPCI — without running the
 * full national pipeline.
 *
 * Pipeline (mirrors batch-classification.processor.ts):
 *   1. resolve each --epci (SIREN or name) → its member communes,
 *   2. select DGCL projets of that perimeter still unclassified (llm_classified_at IS NULL),
 *   3. submit 3 requests/project (thematiques, sites, interventions) to the Anthropic
 *      Batch API — GROUPED BY AXIS so the cached axis prompt prefix stays warm
 *      (prompt caching is already set in buildMessageParams), minimizing input tokens,
 *   4. poll until the batch ends,
 *   5. parse → validate (anti-hallucination) → enrich → TE probability, reusing the
 *      existing services,
 *   6. write the llm_* columns back to schema_commun_v2.projets_operationnels.
 *
 * Idempotent: only rows with llm_classified_at IS NULL are selected, and re-running
 * skips already-classified rows. Submit and processing can be split across runs via
 * --batch-id (recover a batch that already ended on Anthropic's side).
 *
 * Only the llm_* columns are written: in schema_commun_v2 the classification* columns
 * are left NULL by the ETL (the dashboard/clustering read llm_* exclusively).
 *
 * Usage (from the api repo root, with DATABASE_URL + ANTHROPIC_API_KEY in .env):
 *   npx ts-node -r tsconfig-paths/register \
 *     scripts/classify-dgcl-by-epci/classify-dgcl-by-epci.ts --epci="248000531,Valenciennes Métropole"
 * Options:
 *   --epci=A,B,C      one or more EPCIs, each a 9-digit SIREN or a name substring
 *                     (name resolved against api_referentiel.groupements, must be unique)
 *   --dry-run         resolve + select + report counts, no Anthropic call, no DB write
 *   --limit=N         cap the number of projects (sampling / cost control)
 *   --batch-id=ID     skip submit/poll, process the results of an already-ended batch
 *   --poll-seconds=N  polling interval while waiting for the batch (default: 30)
 */
import "dotenv/config";
import pg from "pg";
import type { ConfigService } from "@nestjs/config";
import type { CustomLogger } from "@logging/logger.service";
import { ClassificationAnthropicService } from "@/projet-qualification/classification/llm/classification-anthropic.service";
import { ClassificationValidationService } from "@/projet-qualification/classification/validation/classification-validation.service";
import { EnrichmentService } from "@/projet-qualification/classification/post-processing/enrichment.service";
import { TEProbabilityService } from "@/projet-qualification/classification/post-processing/te-probability.service";
import { CLASSIFICATION_AXES, ClassificationAxis } from "@/batch-classification/batch-classification.const";

interface Args {
  epcis: string[];
  dryRun: boolean;
  limit?: number;
  batchId?: string;
  pollSeconds: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  const epciRaw = get("epci") ?? "";
  return {
    epcis: epciRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dryRun: argv.includes("--dry-run"),
    limit: get("limit") ? Number(get("limit")) : undefined,
    batchId: get("batch-id"),
    pollSeconds: get("poll-seconds") ? Number(get("poll-seconds")) : 30,
  };
}

// --- lightweight stubs so the existing @Injectable services run standalone ---
// They only depend on CustomLogger (chatty .log silenced) and, for the Anthropic
// service, on ConfigService.get(key) — both trivially satisfiable here.
const noop = () => undefined;
const logger = {
  log: noop, // silence the very chatty per-label .log of the validation/enrichment services
  warn: (...a: unknown[]) => console.warn(...a),
  error: (...a: unknown[]) => console.error(...a),
  debug: noop,
  verbose: noop,
} as unknown as CustomLogger;

const config = { get: (k: string) => process.env[k] } as unknown as ConfigService;

// Lazy: the Anthropic service constructor throws if ANTHROPIC_API_KEY is missing,
// so we only build it when we actually call the API (never in --dry-run).
let _anthropic: ClassificationAnthropicService | undefined;
const getAnthropic = () => (_anthropic ??= new ClassificationAnthropicService(config, logger));
const validation = new ClassificationValidationService(logger);
const enrichment = new EnrichmentService(logger);
const teProbability = new TEProbabilityService(logger);

const isSiren = (s: string) => /^\d{9}$/.test(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ProjectRow {
  id: string;
  nom: string;
  description: string | null;
}

/** Resolve each --epci token (SIREN or name) to its EPCI SIREN. */
async function resolveEpciSirens(client: pg.Client, tokens: string[]): Promise<string[]> {
  const sirens: string[] = [];
  for (const tok of tokens) {
    if (isSiren(tok)) {
      sirens.push(tok);
      continue;
    }
    const r = await client.query<{ siren: string; nom: string }>(
      "SELECT siren, nom FROM api_referentiel.groupements WHERE nom ILIKE $1 ORDER BY nom",
      [`%${tok}%`],
    );
    if (r.rows.length === 0) throw new Error(`EPCI introuvable pour "${tok}"`);
    if (r.rows.length > 1) {
      throw new Error(
        `EPCI ambigu pour "${tok}": ${r.rows.map((x) => `${x.nom} (${x.siren})`).join(", ")} — précisez le SIREN.`,
      );
    }
    console.log(`  "${tok}" → ${r.rows[0].nom} (${r.rows[0].siren})`);
    sirens.push(r.rows[0].siren);
  }
  return Array.from(new Set(sirens));
}

/** Member communes (INSEE codes) of the given EPCIs. */
async function epciCommunes(client: pg.Client, epciSirens: string[]): Promise<string[]> {
  const r = await client.query<{ code_insee_commune: string }>(
    "SELECT DISTINCT code_insee_commune FROM api_referentiel.perimetres WHERE siren_groupement = ANY($1)",
    [epciSirens],
  );
  return r.rows.map((x) => x.code_insee_commune);
}

/** Unclassified DGCL projets attached to the perimeter (by commune link or by EPCI SIREN). */
async function selectDgclProjects(
  client: pg.Client,
  epciSirens: string[],
  communes: string[],
  limit?: number,
): Promise<ProjectRow[]> {
  const r = await client.query<ProjectRow>(
    `SELECT DISTINCT p.id, p.nom, p.description
     FROM schema_commun_v2.projets_operationnels p
     LEFT JOIN schema_commun_v2.liens_projets_communes l ON l.projet_id = p.id
     WHERE p.source_origine LIKE 'DGCL%'
       AND p.llm_classified_at IS NULL
       AND (l.insee_com = ANY($1) OR p."collectiviteResponsableSiren" = ANY($2))
     ${limit ? "LIMIT " + Number(limit) : ""}`,
    [communes, epciSirens],
  );
  return r.rows;
}

/** Build batch requests grouped by axis to maximize prompt-cache reuse. */
function buildRequests(projects: ProjectRow[]) {
  return CLASSIFICATION_AXES.flatMap((axis) =>
    projects.map((p) => ({
      custom_id: `${p.id}--${axis}`,
      params: getAnthropic().buildMessageParams(`${p.nom}\n${p.description ?? ""}`, axis, "projet"),
    })),
  );
}

function parseCustomId(customId: string): { projectId: string; axis: ClassificationAxis } {
  const i = customId.lastIndexOf("--");
  return { projectId: customId.slice(0, i), axis: customId.slice(i + 2) as ClassificationAxis };
}

const toItems = (labels: Record<string, number>) => Object.entries(labels).map(([label, score]) => ({ label, score }));
const sortedLabels = (labels: Record<string, number>) =>
  Object.entries(labels)
    .sort(([, a], [, b]) => b - a)
    .map(([label, score]) => ({ label, score }));

/** Wait for a batch to reach "ended", then process and write results. */
async function processBatch(client: pg.Client, batchId: string, pollSeconds: number): Promise<number> {
  const sdk = getAnthropic().getClient();

  // Poll
  for (;;) {
    const batch = await sdk.messages.batches.retrieve(batchId);
    if (batch.processing_status === "ended") break;
    console.log(`  batch ${batchId}: ${batch.processing_status} — re-check dans ${pollSeconds}s`);
    await sleep(pollSeconds * 1000);
  }

  // Stream + group by project
  const perProject = new Map<string, Map<ClassificationAxis, Record<string, number>>>();
  let failed = 0;
  const results = await sdk.messages.batches.results(batchId);
  for await (const result of results) {
    const { projectId, axis } = parseCustomId(result.custom_id);
    if (result.result.type !== "succeeded") {
      failed++;
      continue;
    }
    const textContent = result.result.message.content.find((b) => b.type === "text");
    if (textContent?.type !== "text") {
      failed++;
      continue;
    }
    const parsed = getAnthropic().parseResponse(textContent.text, projectId);
    if (parsed.errorMessage) {
      failed++;
      continue;
    }
    const labels: Record<string, number> = {};
    for (const item of parsed.json.items) labels[item.label] = item.score;
    if (!perProject.has(projectId)) perProject.set(projectId, new Map());
    perProject.get(projectId)!.set(axis, labels);
  }

  // Keep projects with all 3 axes
  const complete = [...perProject.entries()].filter(([, axes]) => axes.size === CLASSIFICATION_AXES.length);
  console.log(`  parsé: ${perProject.size} projets (${failed} requêtes échouées), ${complete.length} complets`);

  let written = 0;
  for (const [projectId, axes] of complete) {
    let thematiques = validation.validateAndCorrect({ projet: projectId, items: toItems(axes.get("thematiques")!) }, "thematiques");
    let sites = validation.validateAndCorrect({ projet: projectId, items: toItems(axes.get("sites")!) }, "sites");
    let interventions = validation.validateAndCorrect(
      { projet: projectId, items: toItems(axes.get("interventions")!) },
      "interventions",
    );

    const enriched = enrichment.enrich({ thematiques, sites, interventions });
    thematiques = enriched.thematiques;
    sites = enriched.sites;
    interventions = enriched.interventions;

    const probabiliteTe = teProbability.calculate(thematiques);

    // llm_* shape expected by the dedup/clustering: scored arrays; sites carry a
    // nom_propre slot (filled later by the dedicated nom-propre extraction pass).
    const llmThematiques = sortedLabels(thematiques);
    const llmSites = sortedLabels(sites).map((s) => ({ ...s, nom_propre: null }));
    const llmInterventions = sortedLabels(interventions);

    await client.query(
      `UPDATE schema_commun_v2.projets_operationnels
       SET llm_thematiques = $2::jsonb,
           llm_sites = $3::jsonb,
           llm_interventions = $4::jsonb,
           llm_probabilite_te = $5,
           llm_classified_at = now()
       WHERE id = $1`,
      [
        projectId,
        JSON.stringify(llmThematiques),
        JSON.stringify(llmSites),
        JSON.stringify(llmInterventions),
        probabiliteTe,
      ],
    );
    written++;
  }
  return written;
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (!args.batchId && args.epcis.length === 0) {
    console.error("--epci=<siren|nom>[,…] est requis (ou --batch-id pour reprendre un batch terminé)");
    process.exit(1);
  }
  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required (ou utilisez --dry-run)");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Recover mode: a batch already ended on Anthropic's side — just process it.
    if (args.batchId) {
      console.log(`Reprise du batch ${args.batchId}…`);
      const written = await processBatch(client, args.batchId, args.pollSeconds);
      console.log(`\n=== TERMINÉ === ${written} projets DGCL classifiés.`);
      return;
    }

    console.log("Résolution des EPCI…");
    const epciSirens = await resolveEpciSirens(client, args.epcis);
    const communes = await epciCommunes(client, epciSirens);
    console.log(`  ${epciSirens.length} EPCI, ${communes.length} communes.`);

    const projects = await selectDgclProjects(client, epciSirens, communes, args.limit);
    console.log(`Projets DGCL non classifiés dans le périmètre: ${projects.length}`);
    if (projects.length === 0) {
      console.log("Rien à classifier.");
      return;
    }

    if (args.dryRun) {
      console.log("(dry-run — aucun appel Anthropic, aucune écriture)");
      console.log(`Requêtes Anthropic qui seraient soumises: ${projects.length * CLASSIFICATION_AXES.length}`);
      console.log("Exemples:");
      for (const p of projects.slice(0, 10)) console.log(`  - ${p.id}  ${p.nom}`);
      return;
    }

    const requests = buildRequests(projects);
    console.log(`Soumission d'un batch: ${requests.length} requêtes (${projects.length} projets × ${CLASSIFICATION_AXES.length} axes, groupées par axe).`);
    const batch = await getAnthropic().getClient().messages.batches.create({ requests });
    console.log(`  batch créé: ${batch.id} (${batch.processing_status})`);
    console.log(`  (reprise possible si interrompu: --batch-id=${batch.id})`);

    const written = await processBatch(client, batch.id, args.pollSeconds);
    console.log(`\n=== TERMINÉ === ${written}/${projects.length} projets DGCL classifiés (colonnes llm_*).`);
  } finally {
    await client.end();
  }
}

void main();
