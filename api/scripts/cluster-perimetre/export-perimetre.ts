/**
 * Export every projet_operationnel (all sources) attached to a set of EPCIs, with
 * the fields the cross-source dedup/clustering needs (llm_sites/thematiques, territory,
 * porteur). Output is a single JSON consumed by the Python clusterer
 * (analyse_extract/cluster_perimetre.py).
 *
 * Usage (from api repo root):
 *   DATABASE_URL=… npx ts-node -r tsconfig-paths/register \
 *     scripts/cluster-perimetre/export-perimetre.ts --epci=A,B,C --out=/path/to/out.json
 */
import * as fs from "node:fs";
import pg from "pg";

interface Args {
  epcis: string[];
  out: string;
}
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return {
    epcis: (get("epci") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    out: get("out") ?? "perimetre.json",
  };
}

const isSiren = (s: string) => /^\d{9}$/.test(s);

interface LlmLabel {
  label: string;
  score: number;
  nom_propre?: string | null;
}
interface ExportRow {
  id: string;
  nom: string;
  source: string; // source_origine (DGCL DETR / MEC / Fonds Vert / PVD / ACV …)
  epci: string;
  epciNom: string;
  communes: string[]; // INSEE codes (territoireCommunes ∪ liens_projets_communes)
  siren: string | null;
  siret: string | null;
  sites: LlmLabel[];
  thematiques: LlmLabel[];
  probaTe: number | null;
  budget: string | null;
}

async function resolveEpci(client: pg.Client, tok: string): Promise<{ siren: string; nom: string }> {
  if (isSiren(tok)) {
    const r = await client.query<{ nom: string }>("SELECT nom FROM api_referentiel.groupements WHERE siren=$1", [tok]);
    return { siren: tok, nom: r.rows[0]?.nom ?? tok };
  }
  const r = await client.query<{ siren: string; nom: string }>(
    "SELECT siren, nom FROM api_referentiel.groupements WHERE nom ILIKE $1 ORDER BY nom",
    [`%${tok}%`],
  );
  if (r.rows.length !== 1) throw new Error(`EPCI "${tok}" → ${r.rows.length} résultats, précisez le SIREN`);
  return r.rows[0];
}

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url || args.epcis.length === 0) {
    console.error("DATABASE_URL et --epci=<siren|nom>[,…] requis");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const all: ExportRow[] = [];
  for (const tok of args.epcis) {
    const epci = await resolveEpci(client, tok);
    const communes = (
      await client.query<{ c: string }>(
        "SELECT code_insee_commune c FROM api_referentiel.perimetres WHERE siren_groupement=$1",
        [epci.siren],
      )
    ).rows.map((x) => x.c);

    const r = await client.query<{
      id: string;
      nom: string;
      source_origine: string;
      territoireCommunes: string | null;
      collectiviteResponsableSiren: string | null;
      porteurOperationnelSiret: string | null;
      llm_sites: LlmLabel[] | null;
      llm_thematiques: LlmLabel[] | null;
      llm_probabilite_te: number | null;
      budgetPrevisionnel: string | null;
      lien_communes: string[] | null;
    }>(
      `SELECT p.id, p.nom, p.source_origine, p."territoireCommunes",
              p."collectiviteResponsableSiren", p."porteurOperationnelSiret",
              p.llm_sites, p.llm_thematiques, p.llm_probabilite_te, p."budgetPrevisionnel",
              (SELECT array_agg(l2.insee_com) FROM schema_commun_v2.liens_projets_communes l2 WHERE l2.projet_id = p.id) AS lien_communes
       FROM schema_commun_v2.projets_operationnels p
       WHERE p.id IN (
         SELECT DISTINCT p2.id
         FROM schema_commun_v2.projets_operationnels p2
         LEFT JOIN schema_commun_v2.liens_projets_communes l ON l.projet_id = p2.id
         WHERE l.insee_com = ANY($1) OR p2."collectiviteResponsableSiren" = $2
       )`,
      [communes, epci.siren],
    );

    for (const row of r.rows) {
      const comm = new Set<string>();
      for (const c of String(row.territoireCommunes ?? "").split(",")) if (c.trim()) comm.add(c.trim());
      for (const c of row.lien_communes ?? []) if (c) comm.add(c);
      all.push({
        id: row.id,
        nom: row.nom,
        source: row.source_origine,
        epci: epci.siren,
        epciNom: epci.nom,
        communes: [...comm],
        siren: row.collectiviteResponsableSiren,
        siret: row.porteurOperationnelSiret,
        sites: row.llm_sites ?? [],
        thematiques: row.llm_thematiques ?? [],
        probaTe: row.llm_probabilite_te,
        budget: row.budgetPrevisionnel,
      });
    }

    // TeT fiches action (root only). Different schema (data_tet.fiches_action): the
    // scored classification lives in classification_scores (same shape as llm_*),
    // territory in territoire_communes (INSEE array) + collectivite_responsable_siren.
    const tet = await client.query<{
      id: string;
      nom: string;
      collectivite_responsable_siren: string | null;
      territoire_communes: string[] | null;
      classification_scores: { thematiques?: LlmLabel[]; sites?: LlmLabel[] } | null;
      probabilite_te: string | null;
    }>(
      `SELECT f.id, f.nom, f.collectivite_responsable_siren, f.territoire_communes,
              f.classification_scores, f.probabilite_te
       FROM data_tet.fiches_action f
       WHERE f.parent_id IS NULL
         AND (f.territoire_communes && $1::text[] OR f.collectivite_responsable_siren = $2)`,
      [communes, epci.siren],
    );
    for (const row of tet.rows) {
      all.push({
        id: row.id,
        nom: row.nom,
        source: "TeT",
        epci: epci.siren,
        epciNom: epci.nom,
        communes: (row.territoire_communes ?? []).filter(Boolean),
        siren: row.collectivite_responsable_siren,
        siret: null,
        sites: row.classification_scores?.sites ?? [],
        thematiques: row.classification_scores?.thematiques ?? [],
        probaTe: row.probabilite_te ? Number(row.probabilite_te) : null,
        budget: null,
      });
    }
    console.log(`${epci.nom} (${epci.siren}): ${r.rows.length} projets + ${tet.rows.length} fiches TeT`);
  }

  fs.writeFileSync(args.out, JSON.stringify(all, null, 0));
  console.log(`\n${all.length} projets écrits dans ${args.out}`);
  await client.end();
}

void main();
