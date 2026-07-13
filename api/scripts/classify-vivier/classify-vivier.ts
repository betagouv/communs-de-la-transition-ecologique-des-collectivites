/**
 * Qualifie le "vivier d'adaptation" Hauts-de-France (dashboard) avec le MÊME
 * classifieur LLM que le stock, sans ingestion DB : on lit le texte des projets
 * depuis un JSON, on réutilise les briques de batch-classification (Anthropic
 * Batch API), et on écrit la qualif dans un JSON que le build dashboard fusionne.
 *
 * Contrairement à classify-dgcl-by-epci, ce script ne touche AUCUNE base : ni
 * sélection DB, ni écriture DB. Les services validation/enrichment/te-probability
 * tournent en standalone (ils ne dépendent que du logger), et le service Anthropic
 * ne lit que ANTHROPIC_API_KEY / ANTHROPIC_MODEL. DATABASE_URL n'est PAS requis.
 *
 * Usage (depuis la racine du repo api, ANTHROPIC_API_KEY dans .env) :
 *   npx ts-node -r tsconfig-paths/register \
 *     scripts/classify-vivier/classify-vivier.ts \
 *     --input=../../api-projets-collectivites-demo-dashboard-main/public/data/vivier-hdf.raw.json \
 *     --output=../../api-projets-collectivites-demo-dashboard-main/public/data/vivier-hdf.qualif.json
 * Options :
 *   --input=PATH      JSON source { projets: [{ id, intitule, description }] } (défaut: chemin dashboard)
 *   --output=PATH     JSON cible { [id]: { thematiques, sites, interventions, probabiliteTE } }
 *   --limit=N         échantillonnage / contrôle de coût
 *   --dry-run         compte les requêtes, aucun appel Anthropic, aucune écriture
 *   --batch-id=ID     reprend un batch déjà terminé côté Anthropic
 *   --poll-seconds=N  intervalle de polling (défaut: 30)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigService } from "@nestjs/config";
import type { CustomLogger } from "@logging/logger.service";
import { ClassificationAnthropicService } from "@/projet-qualification/classification/llm/classification-anthropic.service";
import { ClassificationValidationService } from "@/projet-qualification/classification/validation/classification-validation.service";
import { EnrichmentService } from "@/projet-qualification/classification/post-processing/enrichment.service";
import { TEProbabilityService } from "@/projet-qualification/classification/post-processing/te-probability.service";
import { CLASSIFICATION_AXES, ClassificationAxis } from "@/batch-classification/batch-classification.const";

// __dirname = <repo>/fresh/api/scripts/classify-vivier → 4 niveaux jusqu'à convergence-thomas/
const DASHBOARD = resolve(__dirname, "../../../../api-projets-collectivites-demo-dashboard-main");

interface Args {
  input: string;
  output: string;
  limit?: number;
  batchId?: string;
  pollSeconds: number;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return {
    input: get("input") ?? resolve(DASHBOARD, "public/data/vivier-hdf.raw.json"),
    output: get("output") ?? resolve(DASHBOARD, "public/data/vivier-hdf.qualif.json"),
    limit: get("limit") ? Number(get("limit")) : undefined,
    batchId: get("batch-id"),
    pollSeconds: get("poll-seconds") ? Number(get("poll-seconds")) : 30,
    dryRun: argv.includes("--dry-run"),
  };
}

// --- stubs pour faire tourner les @Injectable en standalone (cf. classify-dgcl-by-epci) ---
const noop = () => undefined;
const logger = {
  log: noop,
  warn: (...a: unknown[]) => console.warn(...a),
  error: (...a: unknown[]) => console.error(...a),
  debug: noop,
  verbose: noop,
} as unknown as CustomLogger;
const config = { get: (k: string) => process.env[k] } as unknown as ConfigService;

let _anthropic: ClassificationAnthropicService | undefined;
const getAnthropic = () => (_anthropic ??= new ClassificationAnthropicService(config, logger));
const validation = new ClassificationValidationService(logger);
const enrichment = new EnrichmentService(logger);
const teProbability = new TEProbabilityService(logger);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ProjectRow {
  id: string;
  nom: string;
  description: string | null;
}

function loadProjects(input: string, limit?: number): ProjectRow[] {
  const raw = JSON.parse(readFileSync(input, "utf8")) as { projets: Array<Record<string, unknown>> };
  const rows = (raw.projets ?? [])
    .map((p) => ({
      id: String(p.id ?? ""),
      nom: String(p.intitule ?? ""),
      description: (p.description as string) ?? "",
    }))
    .filter((p) => p.id && (p.nom || p.description));
  return limit ? rows.slice(0, limit) : rows;
}

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
// validateAndCorrect / enrich renvoient un Record<label, score> (cf. classify-dgcl-by-epci).
const sortedLabels = (labels: Record<string, number>) =>
  Object.entries(labels)
    .sort(([, a], [, b]) => b - a)
    .map(([label, score]) => ({ label, score }));

interface Qualif {
  thematiques: { label: string; score: number }[];
  sites: { label: string; score: number }[];
  interventions: { label: string; score: number }[];
  probabiliteTE: number | null;
}

/** Attend la fin du batch puis produit la qualif par projet (sans DB). */
async function processBatch(batchId: string, pollSeconds: number): Promise<Record<string, Qualif>> {
  const sdk = getAnthropic().getClient();
  for (;;) {
    const batch = await sdk.messages.batches.retrieve(batchId);
    if (batch.processing_status === "ended") break;
    console.log(`  batch ${batchId}: ${batch.processing_status} — re-check dans ${pollSeconds}s`);
    await sleep(pollSeconds * 1000);
  }

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

  const complete = [...perProject.entries()].filter(([, axes]) => axes.size === CLASSIFICATION_AXES.length);
  console.log(`  parsé: ${perProject.size} projets (${failed} requêtes échouées), ${complete.length} complets`);

  const out: Record<string, Qualif> = {};
  for (const [projectId, axes] of complete) {
    let thematiques = validation.validateAndCorrect({ projet: projectId, items: toItems(axes.get("thematiques")!) }, "thematiques");
    let sites = validation.validateAndCorrect({ projet: projectId, items: toItems(axes.get("sites")!) }, "sites");
    let interventions = validation.validateAndCorrect({ projet: projectId, items: toItems(axes.get("interventions")!) }, "interventions");
    const enriched = enrichment.enrich({ thematiques, sites, interventions });
    thematiques = enriched.thematiques;
    sites = enriched.sites;
    interventions = enriched.interventions;
    out[projectId] = {
      thematiques: sortedLabels(thematiques),
      sites: sortedLabels(sites),
      interventions: sortedLabels(interventions),
      probabiliteTE: teProbability.calculate(thematiques),
    };
  }
  return out;
}

function writeOut(output: string, qualif: Record<string, Qualif>) {
  // Fusionne avec un éventuel fichier existant (reprise incrémentale).
  const prev: Record<string, Qualif> = existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : {};
  const merged = { ...prev, ...qualif };
  writeFileSync(output, JSON.stringify(merged));
  console.log(`-> ${output} (${Object.keys(merged).length} projets qualifiés au total)`);
}

async function main() {
  const args = parseArgs();
  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY est requis (ou utilisez --dry-run)");
    process.exit(1);
  }

  if (args.batchId) {
    console.log(`Reprise du batch ${args.batchId}…`);
    const qualif = await processBatch(args.batchId, args.pollSeconds);
    writeOut(args.output, qualif);
    return;
  }

  const projects = loadProjects(args.input, args.limit);
  console.log(`Vivier à qualifier: ${projects.length} projets (source ${args.input})`);
  if (projects.length === 0) return;

  if (args.dryRun) {
    console.log(`(dry-run) requêtes Anthropic qui seraient soumises: ${projects.length * CLASSIFICATION_AXES.length}`);
    for (const p of projects.slice(0, 8)) console.log(`  - ${p.id}  ${p.nom.slice(0, 60)}`);
    return;
  }

  const requests = buildRequests(projects);
  console.log(`Soumission d'un batch: ${requests.length} requêtes (${projects.length} projets × ${CLASSIFICATION_AXES.length} axes).`);
  const batch = await getAnthropic().getClient().messages.batches.create({ requests });
  console.log(`  batch créé: ${batch.id} (${batch.processing_status})`);
  console.log(`  (reprise possible si interrompu: --batch-id=${batch.id})`);
  const qualif = await processBatch(batch.id, args.pollSeconds);
  writeOut(args.output, qualif);
  console.log(`\n=== TERMINÉ === ${Object.keys(qualif).length}/${projects.length} projets du vivier qualifiés.`);
}

void main();
