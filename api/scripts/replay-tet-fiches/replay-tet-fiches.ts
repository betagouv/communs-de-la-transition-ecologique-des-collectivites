// Rejoue un export de fiches action TeT vers notre webhook POST /tet/v1/actions.
// Sert au backfill : (1) récupérer les fiches créées avant la mise en place des webhooks,
// (2) renseigner collectiviteId sur l'existant. L'ingestion est idempotente (upsert par
// externalId, UUID préservé) : rejouer ne crée pas de doublon et ne casse pas les décisions.
//
// Format d'entrée : NDJSON — une ligne = un payload webhook (CreateFicheActionRequest) tel quel.
//   {"externalId":"144374","nom":"...","collectivites":[{"type":"EPCI","code":"200023778","collectiviteId":"4936"}],"plans":[{"externalId":"6819","nom":"...","type":"PCAET"}],"parentExternalId":null,...}
// Le fichier DOIT être trié parents avant sous-actions (parentExternalId résolu au POST).
//
// Usage :
//   API_BASE_URL=https://api.collectivites.beta.gouv.fr \
//   TET_API_KEY=<clé TeT> \
//   pnpm replay:tet-fiches <chemin/export.ndjson> [--dry-run]
//
// Débit throttlé sous la limite de 500 req/min de l'endpoint (cf. @Throttle du contrôleur).

import "dotenv/config";
import * as fs from "fs";
import * as readline from "readline";

const BASE_URL = process.env.API_BASE_URL;
const API_KEY = process.env.TET_API_KEY;
const REQS_PER_MIN = Number(process.env.REPLAY_RATE_PER_MIN ?? 400); // marge sous 500/min
const DELAY_MS = Math.ceil(60000 / REQS_PER_MIN);
const MAX_RETRIES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Payload {
  externalId?: string;
  nom?: string;
  collectivites?: { type: string; code: string; collectiviteId?: string }[];
  parentExternalId?: string | null;
}

async function postOne(payload: Payload): Promise<{ ok: boolean; status: number; body?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/tet/v1/actions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      if (attempt === MAX_RETRIES) return { ok: false, status: 0, body: String(e) };
      await sleep(1000 * (attempt + 1));
      continue;
    }
    // 429 (rate limit) ou 5xx : backoff + retry. 4xx (payload invalide) : échec définitif, on log.
    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) return { ok: false, status: res.status, body: await res.text() };
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: false, status: -1 };
}

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("Usage: pnpm replay:tet-fiches <export.ndjson> [--dry-run]");
    process.exit(1);
  }
  if (!dryRun && (!BASE_URL || !API_KEY)) {
    console.error("API_BASE_URL et TET_API_KEY requis (sauf --dry-run).");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let total = 0;
  let ok = 0;
  let missingCollId = 0;
  const failures: { externalId?: string; status: number; body?: string }[] = [];
  const startedAt = Date.now();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    total++;

    let payload: Payload;
    try {
      payload = JSON.parse(trimmed) as Payload;
    } catch {
      failures.push({ status: -2, body: `JSON invalide ligne ${total}` });
      continue;
    }
    if (!payload.externalId || !payload.nom || !payload.collectivites?.length) {
      failures.push({ externalId: payload.externalId, status: -3, body: "champs requis manquants" });
      continue;
    }
    // Sentinelle : le but du backfill est le collectiviteId — on compte ceux qui l'omettent
    // (un POST sans collectiviteId REMETTRAIT le champ à null côté data_tet).
    if (!payload.collectivites.some((c) => c.collectiviteId)) missingCollId++;

    if (dryRun) {
      ok++;
    } else {
      const r = await postOne(payload);
      if (r.ok) ok++;
      else failures.push({ externalId: payload.externalId, status: r.status, body: r.body?.slice(0, 200) });
      await sleep(DELAY_MS);
    }

    if (total % 500 === 0) {
      const rate = Math.round((total / (Date.now() - startedAt)) * 60000);
      console.log(`  ${total} traitées (${ok} ok, ${failures.length} échecs) — ~${rate}/min`);
    }
  }

  console.log("\n=== Replay terminé ===");
  console.log(`Total lignes : ${total}`);
  console.log(`Succès : ${ok} | Échecs : ${failures.length}`);
  console.log(
    `⚠️  Payloads SANS collectiviteId : ${missingCollId}` +
      (missingCollId ? " (ces fiches n'auront pas le deep-link — écrasent le champ à null)" : ""),
  );
  console.log(`Durée : ${((Date.now() - startedAt) / 1000).toFixed(0)}s${dryRun ? " (dry-run, aucun POST)" : ""}`);
  if (failures.length) {
    const out = file.replace(/\.[^.]+$/, "") + ".failures.json";
    fs.writeFileSync(out, JSON.stringify(failures, null, 2));
    console.log(`Échecs détaillés → ${out}`);
  }
}

void main();
