/**
 * Remonte en base le dédoublonnage DGCL en MERGEANT dans le clustering existant
 * (schema_commun_v2.clusters / clusters_membres), sans créer de double-appartenance.
 *
 * Pour chaque cluster de l'analyse (clusters_5agglos.json) contenant >=1 projet DGCL :
 *  - on regarde où sont déjà ses membres NON-DGCL (projets + fiches TeT) dans
 *    clusters_membres :
 *      · exactement 1 cluster existant E  -> on AJOUTE les projets DGCL à E
 *        (insert clusters_membres, taille recalculée) ;
 *      · aucun cluster existant            -> on CRÉE un nouveau cluster (id UUIDv5
 *        déterministe) avec tous les membres ;
 *      · plusieurs clusters existants      -> AMBIGU, on saute et on liste.
 *  - les clusters sans aucun DGCL sont ignorés (domaine du clustering national).
 *
 * Idempotent : DGCL n'avait aucune appartenance avant -> on n'ajoute un membre DGCL que
 * s'il n'est pas déjà présent ; les nouveaux clusters ont un id déterministe (ON CONFLICT
 * DO NOTHING). Réversible : tout membre clusters_membres dont projet_id est un projet
 * source_origine LIKE 'DGCL%' a été ajouté par ce script.
 *
 * Usage (api repo root) :
 *   DATABASE_URL=… npx ts-node scripts/cluster-perimetre/persist-clusters-merge.ts \
 *     --in=…/clustering_5agglos.json [--dry-run]
 */
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

interface Member {
  id: string;
  source: string;
  nom?: string;
}
interface Cluster {
  confiance: string;
  taille: number;
  sources: string[];
  membres: Member[];
  epciNom: string;
}

const NAMESPACE = "7c2e1a4b-9d6f-5e3a-8b1c-2f4d6a8c0e12";
function uuidv5(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest();
  const b = h.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

const isDgcl = (s: string) => s.startsWith("DGCL");

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return { in: get("in") ?? "clustering_5agglos.json", dryRun: argv.includes("--dry-run"), reset: argv.includes("--reset") };
}

/**
 * Annule toutes les additions de ce script (pour re-synchroniser après changement de
 * l'analyse). Mes clusters CRÉÉS ont un UUIDv5 (15e car = '5') et contiennent toujours
 * >=1 DGCL ; le national est en v4. Mes MERGES = membres DGCL ajoutés à des clusters v4.
 */
async function reset(client: pg.Client) {
  // clusters v4 où j'ai ajouté du DGCL (à recalculer après suppression)
  const touched = (
    await client.query<{ id: string }>(
      `SELECT DISTINCT cm.cluster_id id FROM schema_commun_v2.clusters_membres cm
       JOIN schema_commun_v2.projets_operationnels p ON p.id = cm.projet_id
       WHERE p.source_origine LIKE 'DGCL%' AND substring(cm.cluster_id from 15 for 1) <> '5'`,
    )
  ).rows.map((r) => r.id);
  await client.query("BEGIN");
  // 1+2 : mes clusters créés (v5) et leurs membres
  await client.query(
    `DELETE FROM schema_commun_v2.clusters_membres
     WHERE cluster_id IN (SELECT id FROM schema_commun_v2.clusters WHERE substring(id from 15 for 1) = '5')`,
  );
  const delClusters = await client.query(`DELETE FROM schema_commun_v2.clusters WHERE substring(id from 15 for 1) = '5'`);
  // 3 : mes ajouts DGCL dans les clusters nationaux (v4)
  const delMembers = await client.query(
    `DELETE FROM schema_commun_v2.clusters_membres
     WHERE projet_id IN (SELECT id FROM schema_commun_v2.projets_operationnels WHERE source_origine LIKE 'DGCL%')`,
  );
  // 4 : recalcul taille des clusters nationaux dé-mergés
  if (touched.length)
    await client.query(
      `UPDATE schema_commun_v2.clusters cl SET taille =
         (SELECT count(*) FROM schema_commun_v2.clusters_membres cm WHERE cm.cluster_id = cl.id)
       WHERE cl.id = ANY($1)`,
      [touched],
    );
  await client.query("COMMIT");
  console.log(`RESET : ${delClusters.rowCount} clusters créés supprimés, ${delMembers.rowCount} membres DGCL retirés, ${touched.length} clusters nationaux recalculés.`);
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL requis");
    process.exit(1);
  }
  const all = JSON.parse(fs.readFileSync(args.in, "utf8")) as Cluster[];
  const dgclClusters = all.filter((c) => c.membres.some((m) => isDgcl(m.source)));
  console.log(`${all.length} clusters analyse, ${dgclClusters.length} incluant >=1 DGCL (les seuls remontés).`);

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();

  if (args.reset) {
    await reset(client);
    await client.end();
    return;
  }

  // FK : clusters_membres.fiche_action_id -> schema_commun_v2.fiches_action(id).
  // Certaines fiches data_tet (racines) n'y figurent pas (filtrées par l'ETL) -> on
  // ne peut pas les référencer. On pré-charge les ids valides pour les écarter.
  const allFiche = [...new Set(dgclClusters.flatMap((c) => c.membres.filter((m) => m.source === "TeT").map((m) => m.id)))];
  const validFiches = new Set<string>();
  if (allFiche.length) {
    const vf = await client.query<{ id: string }>(
      `SELECT id FROM schema_commun_v2.fiches_action WHERE id = ANY($1)`,
      [allFiche],
    );
    for (const r of vf.rows) validFiches.add(r.id);
  }
  const isValidMember = (m: Member) => m.source !== "TeT" || validFiches.has(m.id);

  const stats = { merged: 0, dgclAdded: 0, created: 0, ambiguous: 0, skippedExist: 0, skippedTooSmall: 0 };
  const ambiguousList: string[] = [];
  try {
    for (const c of dgclClusters) {
      const dgclIds = c.membres.filter((m) => isDgcl(m.source)).map((m) => m.id);
      const otherProjet = c.membres.filter((m) => !isDgcl(m.source) && m.source !== "TeT").map((m) => m.id);
      const otherFiche = c.membres.filter((m) => m.source === "TeT").map((m) => m.id);

      // Où sont déjà les membres non-DGCL ?
      const existing = await client.query<{ cluster_id: string }>(
        `SELECT DISTINCT cluster_id FROM schema_commun_v2.clusters_membres
         WHERE projet_id = ANY($1) OR fiche_action_id = ANY($2)`,
        [otherProjet, otherFiche],
      );
      const targetClusters = existing.rows.map((r) => r.cluster_id);

      if (targetClusters.length > 1) {
        stats.ambiguous++;
        ambiguousList.push(`${c.epciNom}: ${c.membres.map((m) => m.nom ?? m.id).slice(0, 3).join(" | ")}`);
        continue;
      }

      if (targetClusters.length === 1) {
        // MERGE : ajouter les DGCL au cluster existant
        const E = targetClusters[0];
        let added = 0;
        if (!args.dryRun) await client.query("BEGIN");
        for (const did of dgclIds) {
          const ex = await client.query(
            `SELECT 1 FROM schema_commun_v2.clusters_membres WHERE cluster_id=$1 AND projet_id=$2`,
            [E, did],
          );
          if (ex.rowCount === 0) {
            if (!args.dryRun)
              await client.query(
                `INSERT INTO schema_commun_v2.clusters_membres (cluster_id, projet_id) VALUES ($1,$2)`,
                [E, did],
              );
            added++;
          }
        }
        if (!args.dryRun && added > 0) {
          await client.query(
            `UPDATE schema_commun_v2.clusters SET taille =
               (SELECT count(*) FROM schema_commun_v2.clusters_membres WHERE cluster_id=$1) WHERE id=$1`,
            [E],
          );
        }
        if (!args.dryRun) await client.query("COMMIT");
        if (added > 0) {
          stats.merged++;
          stats.dgclAdded += added;
        } else {
          stats.skippedExist++;
        }
      } else {
        // CREATE : nouveau cluster. On écarte les membres TeT non référençables (FK),
        // et on saute le cluster s'il ne reste pas >=2 membres valides.
        const members = c.membres.filter(isValidMember);
        if (members.length < 2) {
          stats.skippedTooSmall++;
          continue;
        }
        const cid = uuidv5(members.map((m) => m.id).sort().join("|"));
        if (args.dryRun) {
          stats.created++;
          stats.dgclAdded += members.filter((m) => isDgcl(m.source)).length;
          continue;
        }
        await client.query("BEGIN");
        const ins = await client.query(
          `INSERT INTO schema_commun_v2.clusters (id, confiance, taille, type)
           VALUES ($1,$2,$3,'duplicate') ON CONFLICT (id) DO NOTHING RETURNING id`,
          [cid, c.confiance, members.length],
        );
        if (ins.rowCount && ins.rowCount > 0) {
          for (const m of members) {
            if (m.source === "TeT")
              await client.query(
                `INSERT INTO schema_commun_v2.clusters_membres (cluster_id, fiche_action_id) VALUES ($1,$2)`,
                [cid, m.id],
              );
            else
              await client.query(
                `INSERT INTO schema_commun_v2.clusters_membres (cluster_id, projet_id) VALUES ($1,$2)`,
                [cid, m.id],
              );
          }
          stats.created++;
          stats.dgclAdded += members.filter((m) => isDgcl(m.source)).length;
        } else {
          stats.skippedExist++;
        }
        await client.query("COMMIT");
      }
    }

    console.log(`\n=== ${args.dryRun ? "DRY-RUN (aucune écriture)" : "TERMINÉ"} ===`);
    console.log(`  cluster existant enrichi (DGCL ajouté) : ${stats.merged}`);
    console.log(`  nouveaux clusters créés                : ${stats.created}`);
    console.log(`  projets DGCL rattachés                 : ${stats.dgclAdded}`);
    console.log(`  ambigus (sautés, plusieurs clusters)   : ${stats.ambiguous}`);
    console.log(`  sautés (<2 membres valides)            : ${stats.skippedTooSmall}`);
    console.log(`  déjà présents (idempotent)             : ${stats.skippedExist}`);
    if (ambiguousList.length) {
      console.log("\n  exemples ambigus :");
      for (const a of ambiguousList.slice(0, 10)) console.log(`    - ${a}`);
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

void main();
