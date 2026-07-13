/**
 * Persiste en base les coordonnées géocodées (Nominatim) de l'export de clustering vers
 * schema_commun_v2.projets_operationnels.localisationLatitude/Longitude/Adresse.
 *
 * Source = le champ `geo` produit par geocode-nominatim.ts dans clustering_5agglos.json.
 * Seuls les projets (source != "TeT") sont concernés : les fiches data_tet.fiches_action
 * n'ont pas de colonnes localisation. localisationBanId est laissé NULL (Nominatim/OSM
 * n'est pas la BAN). Idempotent : un re-run réécrit les mêmes valeurs.
 *
 * Usage (api repo root) :
 *   DATABASE_URL=… npx ts-node scripts/cluster-perimetre/persist-geo.ts --in=…/clustering_5agglos.json [--dry-run]
 */
import * as fs from "node:fs";
import pg from "pg";

interface Geo {
  lat: number;
  lon: number;
  displayName: string;
}
interface Item {
  id: string;
  source: string;
  geo?: Geo | null;
  [k: string]: unknown;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return { in: get("in") ?? "clustering_5agglos.json", dryRun: argv.includes("--dry-run") };
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL requis");
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(args.in, "utf8")) as Item[];
  // projets opérationnels uniquement (pas les fiches TeT) + géo présente
  const rows = items.filter((it) => it.geo && it.source !== "TeT");
  console.log(`${rows.length} projets avec coordonnées à persister (sur ${items.length} items).`);

  if (args.dryRun) {
    for (const it of rows.slice(0, 8)) console.log(`  ${it.id} -> (${it.geo!.lat}, ${it.geo!.lon})`);
    console.log("(dry-run — aucune écriture)");
    return;
  }

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();
  let written = 0;
  const BATCH = 500;
  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await client.query("BEGIN");
      for (const it of chunk) {
        const g = it.geo!;
        await client.query(
          `UPDATE schema_commun_v2.projets_operationnels
           SET "localisationLatitude" = $2, "localisationLongitude" = $3, "localisationAdresse" = $4
           WHERE id = $1`,
          [it.id, String(g.lat), String(g.lon), g.displayName ?? null],
        );
      }
      await client.query("COMMIT");
      written += chunk.length;
      console.log(`  ${written}/${rows.length} écrits`);
    }
    // contrôle
    const ids = rows.map((r) => r.id);
    const check = await client.query<{ n: string }>(
      `SELECT count(*)::text n FROM schema_commun_v2.projets_operationnels
       WHERE id = ANY($1) AND "localisationLatitude" IS NOT NULL`,
      [ids],
    );
    console.log(`\n=== TERMINÉ === ${written} updates ; vérif : ${check.rows[0].n} projets avec localisationLatitude.`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

void main();
