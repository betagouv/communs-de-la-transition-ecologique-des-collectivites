/**
 * Exporte les fiches action TeT du périmètre des 5 EPCI test au format attendu
 * par le pipeline de géolocalisation (extract-nom-propre.ts puis
 * geocode-nominatim.ts) : tableau d'items { id, nom, source, epciNom, communes }.
 *
 * Enchaînement :
 *   1. DATABASE_URL=… npx ts-node scripts/poc-epci/export-tet-for-geo.ts --out=tet-geo.json
 *   2. ANTHROPIC_API_KEY=… npx ts-node scripts/cluster-perimetre/extract-nom-propre.ts --in=tet-geo.json
 *   3. DATABASE_URL=… npx ts-node -r tsconfig-paths/register scripts/cluster-perimetre/geocode-nominatim.ts --in=tet-geo.json
 *   4. build-poc-data --tet-geo=tet-geo.json  → attache les coords aux items TeT.
 */
import * as fs from "node:fs";
import pg from "pg";

const EPCIS: { siren: string; nom: string }[] = [
  { siren: "200033579", nom: "CU d'Arras" },
  { siren: "200041523", nom: "CC de la Haute Saintonge" },
  { siren: "200067346", nom: "CA Pornic Agglo Pays de Retz" },
  { siren: "244400404", nom: "Nantes Métropole" },
  { siren: "245901160", nom: "CA Valenciennes Métropole" },
];
const SIRENS = EPCIS.map((e) => e.siren);

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return { out: get("out") ?? "tet-geo.json" };
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL requis"); process.exit(1); }
  const c = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Communes du périmètre (INSEE) par EPCI + EPCI de chaque commune.
  const peri = (await c.query<{ siren_groupement: string; code_insee_commune: string }>(
    "SELECT siren_groupement, code_insee_commune FROM api_referentiel.perimetres WHERE siren_groupement = ANY($1)",
    [SIRENS],
  )).rows;
  const epciOfCommune = new Map<string, string>();
  for (const r of peri) epciOfCommune.set(r.code_insee_commune, r.siren_groupement);
  const allCommunes = [...epciOfCommune.keys()];
  const nomOfSiren = new Map(EPCIS.map((e) => [e.siren, e.nom]));

  // Mêmes fiches que le build (racines classifiées du périmètre).
  const rows = (await c.query<{
    id: string; nom: string; territoire_communes: string[] | null; collectivite_responsable_siren: string | null;
  }>(
    `SELECT f.id::text AS id, f.nom, f.territoire_communes, f.collectivite_responsable_siren
     FROM data_tet.fiches_action f
     WHERE f.parent_id IS NULL AND f.classification_scores IS NOT NULL
       AND (f.territoire_communes && $1::text[] OR f.collectivite_responsable_siren = ANY($2))`,
    [allCommunes, SIRENS],
  )).rows;
  await c.end();

  const items = rows.map((f) => {
    // Communes du périmètre portées par la fiche (sinon toutes ses communes).
    const inPeri = (f.territoire_communes ?? []).filter((x) => epciOfCommune.has(x));
    const communes = inPeri.length ? inPeri : (f.territoire_communes ?? []);
    // EPCI : par commune membre, sinon par SIREN responsable.
    let siren = "";
    for (const x of communes) { const s = epciOfCommune.get(x); if (s) { siren = s; break; } }
    if (!siren && f.collectivite_responsable_siren && SIRENS.includes(f.collectivite_responsable_siren)) siren = f.collectivite_responsable_siren;
    return { id: f.id, nom: f.nom, source: "TeT", epciNom: nomOfSiren.get(siren) ?? "", communes };
  });

  fs.writeFileSync(args.out, JSON.stringify(items, null, 0));
  console.log(`${items.length} fiches TeT exportées → ${args.out} (avec communes: ${items.filter((i) => i.communes.length).length})`);
}

void main();
