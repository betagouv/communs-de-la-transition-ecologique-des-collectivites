/**
 * Détecte et corrige les géocodages fautifs (Nominatim ayant renvoyé un homonyme dans
 * une AUTRE commune) : pour chaque projet géocodé rattaché à une (des) commune(s), on
 * compare la coordonnée au centroïde de la commune (API geo.api.gouv.fr). Si la distance
 * minimale dépasse MAX_KM, le géocodage est jugé fautif -> on le retire (geo=null dans le
 * JSON + colonnes localisation NULL en base pour les projets concernés).
 *
 * Les items sans commune (fiches TeT) ne sont pas vérifiables par distance -> conservés.
 *
 * Usage (api repo root) :
 *   DATABASE_URL=… npx ts-node scripts/cluster-perimetre/fix-geo.ts --in=…/clustering_5agglos.json [--dry-run] [--max-km=10]
 */
import * as fs from "node:fs";
import pg from "pg";

interface Geo { lat: number; lon: number; displayName?: string }
interface Item { id: string; source: string; nom: string; communes?: string[]; geo?: Geo | null; nomPropre?: string | null; [k: string]: unknown }

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k: string) => a.find((x) => x.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return { in: get("in") ?? "clustering_5agglos.json", dryRun: a.includes("--dry-run"), maxKm: get("max-km") ? Number(get("max-km")) : 10 };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, r = Math.PI / 180;
  const dphi = (lat2 - lat1) * r, dl = (lon2 - lon1) * r;
  const x = Math.sin(dphi / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function communeCentroids(insee: string[]): Promise<Map<string, [number, number]>> {
  const m = new Map<string, [number, number]>();
  for (const code of insee) {
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes/${code}?fields=centre&format=json`);
      if (!res.ok) continue;
      const j = (await res.json()) as { centre?: { coordinates: [number, number] } };
      if (j.centre) m.set(code, [j.centre.coordinates[1], j.centre.coordinates[0]]); // [lat, lon]
    } catch {
      /* ignore */
    }
  }
  return m;
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL requis"); process.exit(1); }
  const items = JSON.parse(fs.readFileSync(args.in, "utf8")) as Item[];
  const geocoded = items.filter((i) => i.geo && (i.communes?.length ?? 0) > 0);
  const insee = [...new Set(geocoded.flatMap((i) => i.communes ?? []))];
  console.log(`${geocoded.length} projets géocodés avec commune ; récupération de ${insee.length} centroïdes…`);
  const cen = await communeCentroids(insee);

  const faulty: { it: Item; km: number }[] = [];
  for (const it of geocoded) {
    const dists: number[] = [];
    for (const code of it.communes ?? []) {
      const ce = cen.get(code);
      if (ce) dists.push(haversineKm(it.geo!.lat, it.geo!.lon, ce[0], ce[1]));
    }
    if (!dists.length) continue; // centroïde introuvable -> on ne juge pas
    const min = Math.min(...dists);
    if (min > args.maxKm) faulty.push({ it, km: Math.round(min) });
  }
  faulty.sort((a, b) => b.km - a.km);
  console.log(`\n${faulty.length} géocodages fautifs (> ${args.maxKm} km du centroïde commune) :`);
  for (const { it, km } of faulty.slice(0, 25))
    console.log(`  ${km} km  [${it.source.split(" ")[0]}] np="${it.nomPropre}" -> ${String(it.geo!.displayName).slice(0, 60)}`);

  if (args.dryRun) { console.log("\n(dry-run — aucune correction)"); return; }

  // Correction : geo=null dans le JSON, et localisation NULL en base (projets only)
  const faultyIds = new Set(faulty.map((f) => f.it.id));
  for (const it of items) if (faultyIds.has(it.id)) it.geo = null;
  fs.writeFileSync(args.in, JSON.stringify(items, null, 0));

  const projIds = faulty.filter((f) => f.it.source !== "TeT").map((f) => f.it.id);
  if (projIds.length) {
    const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
    await client.connect();
    const r = await client.query(
      `UPDATE schema_commun_v2.projets_operationnels
       SET "localisationLatitude" = NULL, "localisationLongitude" = NULL, "localisationAdresse" = NULL
       WHERE id = ANY($1)`,
      [projIds],
    );
    await client.end();
    console.log(`\n=== CORRIGÉ === ${faulty.length} geo retirés du JSON ; ${r.rowCount} projets dé-localisés en base.`);
  } else {
    console.log(`\n=== CORRIGÉ === ${faulty.length} geo retirés du JSON (aucun projet en base concerné).`);
  }
}

void main();
