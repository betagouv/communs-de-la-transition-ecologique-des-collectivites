/**
 * Persiste le nom propre extrait (champ `nomPropre` de clustering_5agglos.json) dans
 * schema_commun_v2.projets_operationnels.llm_sites, SANS écraser les sites :
 * on ne modifie que le sous-champ `nom_propre` du PREMIER site (celui que lit le
 * dashboard via llm_sites->0->>'nom_propre'), via jsonb_set. Les `label`/`score` et le
 * reste du tableau sont préservés.
 *
 * Garde-fous :
 *  - uniquement les projets (source != "TeT") AYANT un nomPropre extrait non vide
 *    (on ne remplace jamais une valeur existante par null) ;
 *  - uniquement si llm_sites est un tableau non vide (sinon on saute, on ne crée rien).
 *
 * Idempotent. Usage (api repo root) :
 *   DATABASE_URL=… npx ts-node scripts/cluster-perimetre/persist-nom-propre.ts --in=…/clustering_5agglos.json [--dry-run]
 */
import * as fs from "node:fs";
import pg from "pg";

interface Item {
  id: string;
  source: string;
  nom: string;
  nomPropre?: string | null;
  [k: string]: unknown;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return { in: get("in") ?? "clustering_5agglos.json", dryRun: argv.includes("--dry-run") };
}

// Même nettoyage que le clusteriseur (cluster_perimetre.py) : on ne persiste QUE les
// noms propres distinctifs. Un nom réduit à des mots-types génériques ("Hôtel de Ville",
// "église", "cantine municipale") n'identifie pas un lieu précis -> on ne l'écrit pas.
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "en", "un", "une", "a", "au", "aux", "sur", "pour", "dans"]);
const GENERIC = new Set([
  ...STOP,
  "hotel", "ville", "mairie", "eglise", "chapelle", "cantine", "restaurant", "municipale", "municipal",
  "communal", "communale", "communaux", "salle", "salles", "fete", "fetes", "polyvalente", "sport", "sports",
  "sportif", "sportive", "ecole", "maternelle", "elementaire", "primaire", "groupe", "scolaire", "piscine",
  "gymnase", "stade", "complexe", "mediatheque", "bibliotheque", "creche", "cimetiere", "espace", "espaces",
  "pole", "batiment", "batiments", "public", "publique", "publics", "voirie", "rue", "route", "impasse",
  "place", "parking", "local", "locaux", "logement", "logements", "terrain", "hall", "foyer", "maison",
  "services", "service", "france", "accueil", "atelier", "ateliers", "centre", "bourg", "equipement",
  "equipements", "site", "vestiaires", "vestiaire", "tennis",
]);

function distinctive(np: string): boolean {
  const norm = np
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ");
  return norm.split(/\s+/).some((w) => w.length > 1 && !GENERIC.has(w));
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL requis");
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(args.in, "utf8")) as Item[];
  const rows = items.filter((it) => it.source !== "TeT" && it.nomPropre?.trim() && distinctive(it.nomPropre));
  const generic = items.filter((it) => it.source !== "TeT" && it.nomPropre?.trim() && !distinctive(it.nomPropre)).length;
  console.log(`${rows.length} projets avec nom_propre DISTINCTIF à persister (${generic} génériques ignorés, sur ${items.length} items).`);

  if (args.dryRun) {
    for (const it of rows.slice(0, 8)) console.log(`  ${it.id}  "${it.nomPropre}"  <- ${it.nom.slice(0, 50)}`);
    console.log("(dry-run — aucune écriture)");
    return;
  }

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();
  let updated = 0;
  let skippedNoSites = 0;
  const BATCH = 500;
  try {
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await client.query("BEGIN");
      for (const it of chunk) {
        // jsonb_set ne touche QUE {0,nom_propre} ; la garde WHERE évite de créer un
        // tableau sur un llm_sites absent/vide (on ne fabrique pas de site).
        const res = await client.query(
          `UPDATE schema_commun_v2.projets_operationnels
           SET llm_sites = jsonb_set(llm_sites, '{0,nom_propre}', to_jsonb($2::text), true)
           WHERE id = $1
             AND jsonb_typeof(llm_sites) = 'array'
             AND jsonb_array_length(llm_sites) > 0`,
          [it.id, it.nomPropre],
        );
        if (res.rowCount && res.rowCount > 0) updated++;
        else skippedNoSites++;
      }
      await client.query("COMMIT");
      console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} traités (${updated} écrits)`);
    }
    console.log(`\n=== TERMINÉ === ${updated} llm_sites enrichis (nom_propre), ${skippedNoSites} sautés (pas de llm_sites).`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

void main();
