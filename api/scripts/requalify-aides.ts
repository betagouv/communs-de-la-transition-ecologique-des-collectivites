/**
 * Requalification du catalogue d'aides — invalide les classifications
 * existantes pour forcer leur recalcul par le LLM (ex. après un changement
 * de prompt).
 *
 * Méthode "douce" : on ne TRUNCATE pas la table — on réécrit content_hash
 * avec un sentinel. Les classification_scores actuels restent servis par
 * GET /aides jusqu'à ce que chaque aide soit individuellement reclassifiée.
 * Aucune fenêtre no_match : remplacement progressif, pas de coupure.
 *
 * Le déclenchement passe par un job BullMQ (queue aides-sync) — le processor
 * tourne en arrière-plan, sans timeout HTTP (contrairement à GET /aides/sync
 * qui est synchrone et couperait sur un run complet de plusieurs heures).
 *
 * Modes :
 *   (défaut)       dry-run : compte les lignes, n'écrit rien
 *   --apply        invalide les content_hash + enqueue le job de sync
 *   --apply --no-trigger   invalide seulement (sync laissé au cron 3h UTC)
 *   --watch        suit la progression de la reclassification (lecture seule)
 *
 * Usage :
 *   DATABASE_URL=... npx tsx scripts/requalify-aides.ts
 *   DATABASE_URL=... REDIS_URL=... npx tsx scripts/requalify-aides.ts --apply
 *   DATABASE_URL=... npx tsx scripts/requalify-aides.ts --watch
 *
 * Coût : --apply déclenche un run LLM complet (~ nb_aides × 3 appels Claude,
 * séquentiel, plusieurs heures). À lancer en heures creuses.
 */

import { Pool, type PoolConfig } from "pg";
import Redis from "ioredis";
import { Queue } from "bullmq";

// Sentinel écrit dans content_hash — ne peut pas entrer en collision avec un
// vrai hash (SHA256 = 64 caractères hexadécimaux).
const STALE_SENTINEL = "requalify-pending";

// cf. api/src/aides/aides-sync.processor.ts
const AIDES_SYNC_QUEUE_NAME = "aides-sync";
const AIDES_SYNC_JOB_NAME = "aides-sync-classification";

const WATCH_INTERVAL_MS = 30_000;
const WATCH_STALL_LIMIT = 10; // arrêt si aucune progression sur N tours

// ─── Config ──────────────────────────────────────────────────────────────────

function buildDbConfig(): PoolConfig {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL manquant");
    process.exit(1);
  }
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
  };
}

function buildRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("❌ REDIS_URL manquant (requis pour --apply sans --no-trigger)");
    process.exit(1);
  }
  return new Redis(url, {
    maxRetriesPerRequest: null, // requis par BullMQ
    ...(url.startsWith("rediss://") ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

// ─── Progression ─────────────────────────────────────────────────────────────

interface Progress {
  total: number;
  done: number;
  pending: number;
}

async function readProgress(pool: Pool): Promise<Progress> {
  const { rows } = await pool.query<{ total: string; done: string; pending: string }>(
    `SELECT
       count(*)::text                                       AS total,
       count(*) FILTER (WHERE content_hash <> $1)::text     AS done,
       count(*) FILTER (WHERE content_hash =  $1)::text     AS pending
     FROM public.aide_classifications`,
    [STALE_SENTINEL],
  );
  return {
    total: Number(rows[0].total),
    done: Number(rows[0].done),
    pending: Number(rows[0].pending),
  };
}

function pct(p: Progress): string {
  return p.total === 0 ? "0%" : `${Math.round((p.done / p.total) * 100)}%`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const watch = argv.includes("--watch");
  const noTrigger = argv.includes("--no-trigger");

  const pool = new Pool(buildDbConfig());

  console.log(`\n=== Requalification des aides ===\n`);

  // ── Mode --watch seul ──────────────────────────────────────────────────────
  if (watch && !apply) {
    await watchProgress(pool);
    await pool.end();
    return;
  }

  const before = await readProgress(pool);
  console.log(`Table public.aide_classifications : ${before.total} aides classifiées`);
  console.log(`  déjà invalidées (sentinel)       : ${before.pending}`);
  console.log(`  avec un hash valide              : ${before.done}\n`);

  if (!apply) {
    // ── Dry-run ──────────────────────────────────────────────────────────────
    console.log(`Mode DRY-RUN — aucune écriture.\n`);
    console.log(`Avec --apply, le script :`);
    console.log(`  1. réécrit content_hash = "${STALE_SENTINEL}" sur les ${before.total} lignes`);
    console.log(`     (classification_scores INCHANGÉS — toujours servis par GET /aides)`);
    console.log(`  2. enqueue un job "${AIDES_SYNC_JOB_NAME}" sur la queue "${AIDES_SYNC_QUEUE_NAME}"`);
    console.log(`     → le worker reclassifie chaque aide au LLM, en arrière-plan`);
    console.log(`\n⚠️  Coût : ~${before.total} aides × 3 appels Claude, séquentiel, plusieurs heures.`);
    console.log(`   À lancer en heures creuses. Suivre ensuite avec --watch.\n`);
    await pool.end();
    return;
  }

  // ── --apply : invalidation ─────────────────────────────────────────────────
  console.log(`Invalidation des content_hash…`);
  const res = await pool.query(`UPDATE public.aide_classifications SET content_hash = $1`, [STALE_SENTINEL]);
  console.log(`  ✓ ${res.rowCount} ligne(s) invalidée(s) — classification_scores conservés.\n`);

  // ── --apply : déclenchement ────────────────────────────────────────────────
  if (noTrigger) {
    console.log(`--no-trigger : job de sync NON enqueué.`);
    console.log(`La reclassification se fera au prochain cron (3h UTC).\n`);
  } else {
    const redis = buildRedis();
    const queue = new Queue(AIDES_SYNC_QUEUE_NAME, { connection: redis });
    const job = await queue.add(
      AIDES_SYNC_JOB_NAME,
      {},
      { attempts: 3, backoff: { type: "exponential", delay: 60_000 } },
    );
    console.log(`✓ Job de sync enqueué (id=${job.id}) sur la queue "${AIDES_SYNC_QUEUE_NAME}".`);
    console.log(`  Le worker va reclassifier les aides en arrière-plan.\n`);
    await queue.close();
    redis.disconnect();
  }

  console.log(`Suivre la progression :`);
  console.log(`  DATABASE_URL=... npx tsx scripts/requalify-aides.ts --watch\n`);

  if (watch) {
    await watchProgress(pool);
  }
  await pool.end();
}

/** Boucle de suivi : affiche done/total jusqu'à la fin (ou un plateau). */
async function watchProgress(pool: Pool): Promise<void> {
  console.log(`Suivi de la reclassification (Ctrl-C pour arrêter)\n`);
  let lastDone = -1;
  let stall = 0;

  for (;;) {
    const p = await readProgress(pool);
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`  [${ts}] ${p.done}/${p.total} reclassifiées (${pct(p)}) — ${p.pending} en attente`);

    if (p.pending === 0) {
      console.log(`\n✅ Reclassification terminée — toutes les aides ont un hash valide.\n`);
      return;
    }

    stall = p.done === lastDone ? stall + 1 : 0;
    lastDone = p.done;
    if (stall >= WATCH_STALL_LIMIT) {
      console.log(
        `\n⚠️  Aucune progression depuis ${(WATCH_STALL_LIMIT * WATCH_INTERVAL_MS) / 60_000} min.\n` +
          `   Les ${p.pending} aide(s) restantes sont probablement des orphelines\n` +
          `   (retirées du catalogue Aides-Territoires, donc jamais revues par le sync).\n` +
          `   Le job de sync est peut-être aussi terminé/échoué — vérifier Bull Board.\n`,
      );
      return;
    }

    await new Promise((r) => setTimeout(r, WATCH_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Requalify failed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
