/**
 * Passe "nom propre" : extrait, pour chaque projet de l'export de clustering, le NOM
 * PROPRE DISTINCTIF du lieu/équipement concerné (ex. "École Jules Ferry", "Îlot
 * Daubresse", "6 rue Léon Blum"), en excluant les types génériques et les noms de
 * commune/EPCI/département/région. Enrichit le JSON en place avec un champ `nomPropre`.
 *
 * Pourquoi : le tier de confiance CERTAIN du clustering peut s'appuyer sur le nom propre
 * (même nom propre distinctif -> même projet, même si les libellés diffèrent). Les
 * nom_propre hérités de la classification nationale n'étaient pas nettoyés (noms de lieux
 * génériques) ; DGCL n'en avait aucun. Cette passe en produit un, propre, pour TOUTES les
 * sources du périmètre.
 *
 * Modèle : Haiku (extraction simple, peu coûteuse), via la Batch API (remise 50%) avec
 * prompt caching sur la consigne système.
 *
 * Usage (api repo root) :
 *   ANTHROPIC_API_KEY=… npx ts-node scripts/cluster-perimetre/extract-nom-propre.ts \
 *     --in=…/clustering_5agglos.json [--out=…] [--batch-id=ID] [--poll-seconds=30] [--dry-run]
 */
import * as fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

interface Item {
  id: string;
  nom: string;
  source: string;
  epciNom: string;
  nomPropre?: string | null;
  [k: string]: unknown;
}
interface Args {
  in: string;
  out: string;
  batchId?: string;
  pollSeconds: number;
  dryRun: boolean;
  model: string;
}
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  const inPath = get("in") ?? "clustering_5agglos.json";
  return {
    in: inPath,
    out: get("out") ?? inPath,
    batchId: get("batch-id"),
    pollSeconds: get("poll-seconds") ? Number(get("poll-seconds")) : 30,
    dryRun: argv.includes("--dry-run"),
    model: get("model") ?? "claude-haiku-4-5",
  };
}

const SYSTEM = `Tu reçois l'intitulé d'un projet d'investissement d'une collectivité française et le nom de son territoire. Extrais le NOM PROPRE DISTINCTIF du lieu, de l'équipement ou de l'ouvrage concerné : le nom qui identifie spécifiquement l'objet (ex. « École Jules Ferry », « Médiathèque intercommunale de Montcuq », « Îlot Daubresse », « 6 rue Léon Blum », « Salle Delaune », « Friche Sofanor »).

Règles STRICTES :
- N'extrais PAS un type générique seul : « école », « piscine », « mairie », « salle des fêtes », « gymnase », « centre-bourg », « voirie », « église » sans nom propre attaché.
- N'extrais PAS le nom de la commune, de l'intercommunalité (EPCI/CA/CC/CU/métropole), du département ou de la région utilisé seul.
- Conserve le nom propre tel qu'il identifie le lieu (ex. « église Saint-Pierre de Mons » est valide ; « Mons » seul ne l'est pas).
- Réponds UNIQUEMENT en JSON, sans texte autour : {"nom_propre": "..."} ou {"nom_propre": null}.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildParams(item: Item, model: string): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: 200,
    temperature: 0,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Territoire : ${item.epciNom}\nIntitulé : ${item.nom}` }],
  };
}

function parseNomPropre(text: string): string | null {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  try {
    const v = JSON.parse(t.trim()) as { nom_propre?: string | null };
    const np = (v.nom_propre ?? null);
    if (!np || typeof np !== "string") return null;
    const trimmed = np.trim();
    return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
  } catch {
    return null;
  }
}

async function processBatch(client: Anthropic, items: Item[], batchId: string, pollSeconds: number) {
  for (;;) {
    const b = await client.messages.batches.retrieve(batchId);
    if (b.processing_status === "ended") break;
    console.log(`  batch ${batchId}: ${b.processing_status} — re-check dans ${pollSeconds}s`);
    await sleep(pollSeconds * 1000);
  }
  let ok = 0,
    withNp = 0;
  const results = await client.messages.batches.results(batchId);
  for await (const r of results) {
    const it = items[Number(r.custom_id)];
    if (!it) continue;
    if (r.result.type !== "succeeded") {
      it.nomPropre = null;
      continue;
    }
    const txt = r.result.message.content.find((b) => b.type === "text");
    const np = txt?.type === "text" ? parseNomPropre(txt.text) : null;
    it.nomPropre = np;
    ok++;
    if (np) withNp++;
  }
  console.log(`  ${ok} réponses, ${withNp} avec nom_propre`);
}

async function main() {
  const args = parseArgs();
  const items = JSON.parse(fs.readFileSync(args.in, "utf8")) as Item[];
  console.log(`${items.length} items chargés depuis ${args.in}`);

  if (args.dryRun) {
    console.log(`(dry-run) ${items.length} requêtes Haiku seraient soumises. Exemples :`);
    for (const it of items.slice(0, 8)) console.log(`  [${it.source}] ${it.nom.slice(0, 70)}`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY requis");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (args.batchId) {
    await processBatch(client, items, args.batchId, args.pollSeconds);
  } else {
    const requests = items.map((it, i) => ({ custom_id: String(i), params: buildParams(it, args.model) }));
    console.log(`Soumission batch nom_propre : ${requests.length} requêtes (${args.model}).`);
    const batch = await client.messages.batches.create({ requests });
    console.log(`  batch ${batch.id} (${batch.processing_status}) — reprise: --batch-id=${batch.id}`);
    await processBatch(client, items, batch.id, args.pollSeconds);
  }

  fs.writeFileSync(args.out, JSON.stringify(items, null, 0));
  const withNp = items.filter((it) => it.nomPropre).length;
  console.log(`\n=== TERMINÉ === ${withNp}/${items.length} items avec nom_propre. Écrit: ${args.out}`);
}

void main();
