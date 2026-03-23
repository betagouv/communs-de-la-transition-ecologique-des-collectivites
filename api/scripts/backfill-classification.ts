/**
 * Backfill classification script for MEC projects and AT aides
 * Uses Anthropic Batch API for cost efficiency (-50%)
 *
 * Usage:
 *   # Submit batch (creates batch jobs at Anthropic)
 *   npx tsx scripts/backfill-classification.ts submit-projets
 *   npx tsx scripts/backfill-classification.ts submit-aides
 *
 *   # Check batch status
 *   npx tsx scripts/backfill-classification.ts status <batch_id>
 *
 *   # Collect results and update DB
 *   npx tsx scripts/backfill-classification.ts collect <batch_id> projets
 *   npx tsx scripts/backfill-classification.ts collect <batch_id> aides
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY, DATABASE_URL, AT_API_TOKEN
 */

import Anthropic from "@anthropic-ai/sdk";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";
import * as crypto from "crypto";
import * as fs from "fs";
import * as schema from "../src/database/schema";

// Load env
import "dotenv/config";

const MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT = "Tu es un expert en classification sémantique.";

// ============================================================
// PROMPTS (imported inline to avoid module resolution issues)
// ============================================================

// Load labels from const files
import { thematiques } from "../src/projet-qualification/classification/const/thematiques";
import { sites } from "../src/projet-qualification/classification/const/sites";
import { interventions } from "../src/projet-qualification/classification/const/interventions";
import { ACRONYMES } from "../src/projet-qualification/classification/const/acronymes";

const ACRONYMES_LIST = ACRONYMES.map((a) => `${a.acronyme} : ${a.definition}`).join("\n");

const RULES_TH = `📌 Règles à considérer en priorité :
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Préciser rénovation énergétique seulement si le projet précise une volonté de réduction explicite de la consommation d'énergie.
- Si un site ou un bâtiment avait auparavant un usage (gare, friche, boulangerie, ...) et est transformé pour un usage complètement différent, utiliser 'Mutabilité, changement de fonction d'un bâtiment ou d'un site'
- L'Accessibilité ne concerne que les sujets handicap ou PMR explicitement mentionnés.
- Le Résidentiel concerne le logement, le tertiaire concerne les services publics, commerce, culture, sport, santé…
- Ne pas mettre 'Parc immobilier détenu par un acteur public' si il n'y qu'un bâtiment
- Toujours privilégier la thématique la plus précise. Si par exemple "Tourisme" et "Tourisme décarboné" conviennent, choisir "Tourisme décarboné"
- N'indiquer "Adaptation au changement climatique" seulement si il y fait explicitement référence
📌 Règles sur certains détails :
- Une salle d'évolution peut accueillir des activités sportives, des manifestations culturelles, des activités périscolaires, des événements, des expositions et des animations associatives`;

const RULES_SI = `📌 Règles à considérer en priorité :
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Toujours privilégier le lieu le plus précis et spécifique quand il y a le choix (ex: mairie > bâtiment public ou pont > ouvrage d'art)
- Si changement d'usage d'un lieu, prioriser sur l'état d'atterrissage
📌 Règles sur certains détails :
- Zone humide n'est utilisé que quand il est fait mention de biodiversité, biotope, de leur importance écologique
- Les édifices patrimoniaux traditionnels sont par exemple les lavoirs, fours, moulins…, et les édifices mémoriels sont par exemple les monuments aux morts. Mais ce ne sont pas les lieux religieux ou les monuments historiques importants.
- Une salle d'évolution peut accueillir des activités sportives, des manifestations culturelles, des activités périscolaires, des événements, des expositions et des animations associatives
- Les Micro-folies sont un mini-musée
- 'Monument historique' est utilisé quand on devine une vraie importance historique, culturelle ou patrimoniale`;

const RULES_IN = `📌 Règles à considérer en priorité :
- On parle de "Structuration du financement" dès qu'on se demande comment inciter financièrement, ou qu'il y a clairement une mention faite des sujets financiers dans l'intitulé
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Tout ce qui est création de campus ou lié à la formation professionnelle doit avoir "Formation" comme modalité
- Quand le projet parle d'un programme, c'est probablement associé à Stratégie/Plan`;

function buildPrompt(rules: string, axisName: string, labels: readonly string[], type: "projet" | "aide"): string {
  const listLabel = axisName.toUpperCase();
  const labelsList = labels.join("\n");

  if (type === "projet") {
    return `${rules}\n\n🎯 Objectif :\nIdentifier EXACTEMENT 3 **${axisName}** pertinentes pour ce projet.\n\nListe autorisée ${listLabel} :\n${labelsList}\n\nListe des acronymes :\n${ACRONYMES_LIST}\n\n🧩 Format strict attendu :\n{\n  "projet": "string",\n  "items": [\n    {"label": "string", "score": float},\n    {"label": "string", "score": float},\n    {"label": "string", "score": float}\n  ]\n}\n📌 Contraintes :\n- EXACTEMENT 3 items\n- Scores entre 0 et 1\n- Scores triés par ordre décroissant\n- Aucun texte hors JSON`;
  }

  return `${rules}\n\n🎯 Objectif :\nAttribuer un score de pertinence pour CHACUNE des ${axisName} de la liste.\n\nListe autorisée ${listLabel} :\n${labelsList}\n\nListe des acronymes :\n${ACRONYMES_LIST}\n\n🧩 Format strict attendu :\n{\n  "projet": "string",\n  "items": [\n    {"label": "string", "score": float},\n    {"label": "string", "score": float},\n    ...\n  ]\n}\n📌 Contraintes :\n- Retourner UNIQUEMENT les items ayant un score > 0.\n- Si aucun item n'a de score > 0, retourner les 5 items les plus pertinents avec un score faible.\n- Scores entre 0 et 1\n- Scores triés par ordre décroissant\n- Aucun texte hors JSON`;
}

// ============================================================
// DB SETUP
// ============================================================

function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return { db: drizzle(pool, { schema }), pool };
}

// ============================================================
// BATCH REQUEST BUILDER
// ============================================================

type BatchRequest = {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    temperature: number;
    system: string;
    messages: { role: "user"; content: string }[];
  };
};

function buildBatchRequests(items: { id: string; context: string }[], type: "projet" | "aide"): BatchRequest[] {
  const prompts = {
    th: buildPrompt(RULES_TH, "thématiques", thematiques, type),
    si: buildPrompt(RULES_SI, "lieux", sites, type),
    in: buildPrompt(RULES_IN, "modalités", interventions, type),
  };

  const contextLabel = type === "aide" ? "Aide" : "Projet";
  const requests: BatchRequest[] = [];

  for (const item of items) {
    for (const [axis, prompt] of Object.entries(prompts)) {
      requests.push({
        custom_id: `${item.id}_${axis}`,
        params: {
          model: MODEL,
          max_tokens: 4096,
          temperature: 0.4,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${prompt}\n\n${contextLabel} :\n- "${item.context}"`,
            },
          ],
        },
      });
    }
  }

  return requests;
}

// ============================================================
// SUBMIT COMMANDS
// ============================================================

async function submitProjets() {
  const { db, pool } = getDb();
  const client = new Anthropic();

  console.log("Fetching MEC projects without classification...");
  const projets = await db
    .select({ id: schema.projets.id, nom: schema.projets.nom, description: schema.projets.description })
    .from(schema.projets)
    .where(sql`${schema.projets.mecId} IS NOT NULL AND ${schema.projets.classificationThematiques} IS NULL`);

  console.log(`Found ${projets.length} MEC projects to classify`);

  const items = projets.map((p) => ({
    id: p.id,
    context: p.description ? `${p.nom} - ${p.description}` : p.nom,
  }));

  const requests = buildBatchRequests(items, "projet");
  console.log(`Built ${requests.length} batch requests (${items.length} projects × 3 axes)`);

  // Submit batch (Anthropic limits to 100k requests per batch)
  const BATCH_SIZE = 90000; // 30k projects × 3 axes = 90k requests
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    console.log(`Submitting batch ${i / BATCH_SIZE + 1} (${chunk.length} requests)...`);

    const batch = await client.messages.batches.create({ requests: chunk });
    console.log(`✅ Batch submitted: ${batch.id}`);
    console.log(`   Status: ${batch.processing_status}`);

    // Save batch info for later collection
    const batchInfo = {
      batchId: batch.id,
      type: "projets",
      count: chunk.length / 3,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(`scripts/batch-${batch.id}.json`, JSON.stringify(batchInfo, null, 2));
    console.log(`   Saved batch info to scripts/batch-${batch.id}.json`);
  }

  await pool.end();
}

async function submitAides() {
  const client = new Anthropic();

  // Fetch aides from AT API
  const authToken = process.env.AT_API_TOKEN!;
  console.log("Authenticating with AT API...");

  const authResp = await fetch("https://aides-territoires.beta.gouv.fr/api/connexion/", {
    method: "POST",
    headers: { "X-AUTH-TOKEN": authToken },
  });
  const { token: bearer } = (await authResp.json()) as { token: string };

  console.log("Fetching all aides from AT API...");
  const allAides: { id: number; name: string; description: string | null; eligibility: string | null }[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const resp = await fetch(`https://aides-territoires.beta.gouv.fr/api/aids/?page_size=50&page=${page}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    const data = (await resp.json()) as { results: typeof allAides; next: string | null };
    allAides.push(...data.results);
    hasMore = data.next !== null;
    page++;
    if (page % 10 === 0) console.log(`  Fetched ${allAides.length} aides (page ${page})...`);
  }

  console.log(`Fetched ${allAides.length} aides total`);

  const items = allAides.map((a) => {
    const parts = [`TITRE: ${a.name}`];
    if (a.description) parts.push(`DESCRIPTION: ${a.description}`);
    if (a.eligibility) parts.push(`ELIGIBILITÉ: ${a.eligibility}`);
    return { id: String(a.id), context: parts.join("\n") };
  });

  const requests = buildBatchRequests(items, "aide");
  console.log(`Built ${requests.length} batch requests (${items.length} aides × 3 axes)`);

  const batch = await client.messages.batches.create({ requests });
  console.log(`✅ Batch submitted: ${batch.id}`);

  const batchInfo = {
    batchId: batch.id,
    type: "aides",
    count: items.length,
    aideIds: items.map((i) => i.id),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(`scripts/batch-${batch.id}.json`, JSON.stringify(batchInfo, null, 2));

  await Promise.resolve(); // satisfy linter
}

// ============================================================
// STATUS & COLLECT
// ============================================================

async function checkStatus(batchId: string) {
  const client = new Anthropic();
  const batch = await client.messages.batches.retrieve(batchId);
  const counts = batch.request_counts;
  const total = counts.processing + counts.succeeded + counts.errored + counts.canceled + counts.expired;
  console.log(`Batch ${batchId}:`);
  console.log(`  Status: ${batch.processing_status}`);
  console.log(
    `  Progress: ${counts.succeeded}/${total} succeeded, ${counts.errored} errored, ${counts.processing} processing`,
  );
}

function parseJson(text: string): { items: { label: string; score: number }[] } | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function collectProjets(batchId: string) {
  const client = new Anthropic();
  const { db, pool } = getDb();

  console.log(`Collecting results for batch ${batchId}...`);

  // Group results by project ID
  const grouped: Record<
    string,
    {
      th: { label: string; score: number }[];
      si: { label: string; score: number }[];
      in: { label: string; score: number }[];
    }
  > = {};

  let count = 0;
  const decoder = await client.messages.batches.results(batchId);
  for await (const result of decoder) {
    if (result.result.type !== "succeeded") continue;

    const [projetId, axis] = result.custom_id.split("_");
    const text = result.result.message.content[0].type === "text" ? result.result.message.content[0].text : "";
    const parsed = parseJson(text);

    if (!grouped[projetId]) grouped[projetId] = { th: [], si: [], in: [] };
    if (parsed?.items) {
      grouped[projetId][axis as "th" | "si" | "in"] = parsed.items;
    }

    count++;
    if (count % 1000 === 0) console.log(`  Parsed ${count} results...`);
  }

  console.log(`Parsed ${count} results for ${Object.keys(grouped).length} projects`);

  // Update DB
  let updated = 0;
  for (const [projetId, axes] of Object.entries(grouped)) {
    const scores = { thematiques: axes.th, sites: axes.si, interventions: axes.in };
    const thLabels = axes.th.filter((t) => t.score >= 0.8).map((t) => t.label);
    const siLabels = axes.si.filter((s) => s.score >= 0.8).map((s) => s.label);
    const inLabels = axes.in.filter((i) => i.score >= 0.8).map((i) => i.label);

    await db
      .update(schema.projets)
      .set({
        classificationThematiques: thLabels,
        classificationSites: siLabels,
        classificationInterventions: inLabels,
        classificationScores: scores,
      })
      .where(eq(schema.projets.id, projetId));

    updated++;
    if (updated % 500 === 0) console.log(`  Updated ${updated} projects...`);
  }

  console.log(`✅ Updated ${updated} projects in DB`);
  await pool.end();
}

async function collectAides(batchId: string) {
  const client = new Anthropic();
  const { db, pool } = getDb();

  console.log(`Collecting aide results for batch ${batchId}...`);

  // Load batch info for aide IDs
  const batchInfoPath = `scripts/batch-${batchId}.json`;
  if (!fs.existsSync(batchInfoPath)) {
    console.error(`Batch info file not found: ${batchInfoPath}`);
    process.exit(1);
  }

  const grouped: Record<
    string,
    {
      th: { label: string; score: number }[];
      si: { label: string; score: number }[];
      in: { label: string; score: number }[];
      context: string;
    }
  > = {};

  let count = 0;
  const decoder = await client.messages.batches.results(batchId);
  for await (const result of decoder) {
    if (result.result.type !== "succeeded") continue;

    const [aideId, axis] = result.custom_id.split("_");
    const text = result.result.message.content[0].type === "text" ? result.result.message.content[0].text : "";
    const parsed = parseJson(text);

    if (!grouped[aideId]) grouped[aideId] = { th: [], si: [], in: [], context: "" };
    if (parsed?.items) {
      grouped[aideId][axis as "th" | "si" | "in"] = parsed.items;
    }
    const parsedAny = parsed as Record<string, unknown> | null;
    if (parsedAny?.projet) {
      grouped[aideId].context = String(parsedAny.projet);
    }

    count++;
    if (count % 1000 === 0) console.log(`  Parsed ${count} results...`);
  }

  console.log(`Parsed ${count} results for ${Object.keys(grouped).length} aides`);

  // Upsert into aide_classifications
  let upserted = 0;
  for (const [aideId, axes] of Object.entries(grouped)) {
    const scores = { thematiques: axes.th, sites: axes.si, interventions: axes.in };
    const contentHash = crypto
      .createHash("sha256")
      .update(axes.context || aideId)
      .digest("hex");

    await db
      .insert(schema.aideClassifications)
      .values({
        idAt: aideId,
        contentHash,
        classificationScores: scores,
        classifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.aideClassifications.idAt,
        set: {
          contentHash,
          classificationScores: scores,
          classifiedAt: new Date(),
        },
      });

    upserted++;
    if (upserted % 500 === 0) console.log(`  Upserted ${upserted} aide classifications...`);
  }

  console.log(`✅ Upserted ${upserted} aide classifications in DB`);
  await pool.end();
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const [, , command, arg1, arg2] = process.argv;

  switch (command) {
    case "submit-projets":
      await submitProjets();
      break;
    case "submit-aides":
      await submitAides();
      break;
    case "status":
      if (!arg1) {
        console.error("Usage: status <batch_id>");
        process.exit(1);
      }
      await checkStatus(arg1);
      break;
    case "collect":
      if (!arg1 || !arg2) {
        console.error("Usage: collect <batch_id> <projets|aides>");
        process.exit(1);
      }
      if (arg2 === "projets") await collectProjets(arg1);
      else if (arg2 === "aides") await collectAides(arg1);
      else {
        console.error("Type must be 'projets' or 'aides'");
        process.exit(1);
      }
      break;
    default:
      console.log(`
Backfill classification script — Batch API

Commands:
  submit-projets          Submit MEC projects for classification
  submit-aides            Submit AT aides for classification
  status <batch_id>       Check batch status
  collect <batch_id> projets|aides   Collect results and update DB

Environment:
  ANTHROPIC_API_KEY       Anthropic API key
  DATABASE_URL            PostgreSQL connection string
  AT_API_TOKEN            Aides-Territoires API token
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
