/**
 * Géocode (Nominatim/OSM) les projets de l'export de clustering qui portent un nom
 * propre distinctif (champ `nomPropre`, produit par extract-nom-propre.ts) : requête
 * "<nom propre>, <commune>, France" -> coordonnées précises (POI/adresse). Enrichit le
 * JSON en place avec un champ `geo` = { lat, lon, type, class, importance, displayName }.
 *
 * On ne géocode QUE les items avec nom_propre : les libellés génériques ne donneraient
 * que le centroïde commune (aucune valeur ajoutée vs "même commune"). On rejette aussi
 * les résultats de niveau commune (class=place/boundary type village|town|municipality)
 * pour ne garder que le sous-communal.
 *
 * Respect ToS Nominatim : 1 requête/seconde, User-Agent explicite, cache par (nomPropre,
 * commune). Idempotent : un item déjà géocodé (champ `geo` présent) est sauté.
 *
 * Usage (api repo root) :
 *   DATABASE_URL=… npx ts-node -r tsconfig-paths/register \
 *     scripts/cluster-perimetre/geocode-nominatim.ts --in=…/clustering_5agglos.json
 */
import * as fs from "node:fs";
import pg from "pg";

interface Item {
  id: string;
  nom: string;
  source: string;
  communes: string[];
  nomPropre?: string | null;
  geo?: GeoResult | null;
  [k: string]: unknown;
}
interface GeoResult {
  lat: number;
  lon: number;
  type: string;
  category: string; // jsonv2 "category" (ex. amenity, place, highway)
  importance: number;
  displayName: string;
  query: string;
}

const UA = "convergence-dedup-poc/1.0 (clustering analysis; contact: perretjea@gmail.com)";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1100; // ≥ 1 req/s
// Résultats de niveau commune : sans valeur ajoutée pour la dédup -> rejetés.
const COMMUNE_LEVEL = new Set(["village", "town", "municipality", "city", "administrative", "hamlet"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  const inPath = get("in") ?? "clustering_5agglos.json";
  return { in: inPath, out: get("out") ?? inPath, limit: get("limit") ? Number(get("limit")) : undefined };
}

async function communeNames(insee: string[]): Promise<Map<string, string>> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL requis (noms de communes)");
  const c = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query<{ code_insee: string; nom: string }>(
    "SELECT code_insee, nom FROM api_referentiel.communes WHERE code_insee = ANY($1)",
    [insee],
  );
  await c.end();
  return new Map(r.rows.map((x) => [x.code_insee, x.nom]));
}

async function geocode(query: string): Promise<GeoResult | null> {
  const u = new URL(ENDPOINT);
  u.searchParams.set("q", query);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "fr");
  u.searchParams.set("addressdetails", "1");
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.warn(`  HTTP ${res.status} pour "${query}"`);
    return null;
  }
  const arr = (await res.json()) as {
    lat: string;
    lon: string;
    type: string;
    category?: string;
    importance?: number;
    display_name: string;
  }[];
  if (!arr.length) return null;
  const f = arr[0];
  if (COMMUNE_LEVEL.has(f.type)) return null; // niveau commune -> rejet
  return {
    lat: Number(f.lat),
    lon: Number(f.lon),
    type: f.type,
    category: f.category ?? "",
    importance: f.importance ?? 0,
    displayName: f.display_name,
    query,
  };
}

async function main() {
  const args = parseArgs();
  const items = JSON.parse(fs.readFileSync(args.in, "utf8")) as Item[];
  const targets = items.filter((it) => it.nomPropre && it.geo === undefined);
  console.log(`${items.length} items, ${targets.length} à géocoder (avec nom_propre, non déjà géocodés)`);

  const allInsee = [...new Set(targets.flatMap((it) => it.communes || []))];
  const names = await communeNames(allInsee);

  const cache = new Map<string, GeoResult | null>();
  let done = 0,
    hits = 0;
  const slice = args.limit ? targets.slice(0, args.limit) : targets;
  for (const it of slice) {
    const commune = names.get((it.communes || [])[0] ?? "") ?? "";
    const query = [it.nomPropre, commune, "France"].filter(Boolean).join(", ");
    let geo = cache.get(query);
    if (geo === undefined) {
      geo = await geocode(query);
      cache.set(query, geo);
      await sleep(DELAY_MS);
    }
    it.geo = geo;
    done++;
    if (geo) hits++;
    if (done % 50 === 0) {
      console.log(`  ${done}/${slice.length} (${hits} localisés)`);
      fs.writeFileSync(args.out, JSON.stringify(items, null, 0)); // checkpoint
    }
  }

  fs.writeFileSync(args.out, JSON.stringify(items, null, 0));
  console.log(`\n=== TERMINÉ === ${hits}/${slice.length} géocodés (sous-communal). Écrit: ${args.out}`);
}

void main();
