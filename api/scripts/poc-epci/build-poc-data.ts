/**
 * Assemble les données du PoC "5 EPCI test" pour le dashboard, en JSON statique.
 * Sortie : deux fichiers dans --outdir (défaut public/data du dashboard) :
 *   - poc-summary.json : agrégats PUBLICS + points de carte non sensibles (id, source, coord).
 *   - poc-detail.json  : détail par projet (gated) + requalif fiches TeT + membres de clusters.
 *
 * Sources :
 *   - base prod schema_commun_v2 (projets_operationnels, clusters) + api_referentiel ;
 *   - enrichissements.json (enrichissement web par projetId) ;
 *   - requalif_fiches_v3.csv (requalif fiches TeT, clé = nom EPCI + libellé, pas de projetId).
 *
 * Usage (depuis fresh/api, DATABASE_URL inline) :
 *   DATABASE_URL=… npx ts-node scripts/poc-epci/build-poc-data.ts \
 *     --enrich=<dashboard>/public/data/enrichissements.json \
 *     --requalif=/Users/.../requalif_fiches_v3.csv \
 *     --outdir=<dashboard>/public/data
 */
import * as fs from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { bm25Match } from "@/aides/textual-matching.bm25";
import type { AideClassification } from "@/aides/dto/aides.dto";

// Matching fiche → projets. Le score thématique reprend la formule des aides
// (axes pondérés 0.45/0.35/0.20, offset 0.1) MAIS le seuil de confiance des
// labels est RÉGLABLE côté front : on précalcule donc, pour chaque match, les
// labels communs (avec leurs deux scores) dès un plancher bas, et le front
// recalcule score thématique + score combiné selon le seuil choisi.
const MATCH_FLOOR = 0.5; // plancher de confiance du précalcul (seuil front ≥ ce plancher)
const AXIS_W = { th: 0.45, si: 0.35, in: 0.2 }; // poids des axes (provisoire, pour classer/plafonner)
const OFFSET = 0.1;
// Émission des candidats : tous les matchs thématiques (plafonnés) + candidats
// textuels (BM25) au-dessus d'un plancher bas, pour que le mode composé soit additif.
const LABEL_CAP = 20;
const TEXTUAL_EMIT_FLOOR = 0.1;
const TEXTUAL_RESCUE_CAP = 15;

// Périmètre figé : les 5 EPCI test (SIREN + variantes de nom dans le CSV requalif).
const EPCIS: { siren: string; csvNames: string[] }[] = [
  { siren: "200033579", csvNames: ["CU d'Arras", "CU d’Arras"] },
  { siren: "200041523", csvNames: ["CC Haute Saintonge", "CC de la Haute Saintonge"] },
  { siren: "200067346", csvNames: ["CA Pornic Agglo", "CA Pornic Agglo Pays de Retz"] },
  { siren: "244400404", csvNames: ["Nantes Métropole"] },
  { siren: "245901160", csvNames: ["CA Valenciennes Métropole"] },
];
const SIRENS = EPCIS.map((e) => e.siren);

interface LlmLabel { label: string; score: number; nom_propre?: string | null }
interface EnrichSource { url: string; type?: string; date?: string }
interface Enrichment {
  projetId: string;
  intitule?: string;
  confiance?: string;
  subvention?: string;
  calendrier?: string;
  maitrise_oeuvre?: string;
  entreprises?: string;
  surface?: string;
  descriptif?: string;
  avancement?: string;
  sources?: EnrichSource[];
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k: string) => a.find((x) => x.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
  return {
    enrich: get("enrich"),
    requalif: get("requalif"),
    outdir: get("outdir") ?? ".",
  };
}

/** Parseur CSV RFC-4180 minimal (gère les champs quotés contenant virgules / sauts de ligne). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* ignore */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const toNum = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Les descriptions de fiches TeT sont du HTML (éditeur BlockNote) — on les
// convertit en texte lisible (sauts de ligne sur les blocs, balises retirées).
const stripHtml = (h: string | null): string | null => {
  if (!h) return null;
  const t = h
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
  return t || null;
};

async function main() {
  const args = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL requis"); process.exit(1); }

  const client = new pg.Client({ connectionString: url.replace(/\?.*$/, ""), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // ── 1. Référentiel : communes par EPCI + noms communes + nom EPCI ──
  const epciNom = new Map<string, string>();
  const epciCommunes = new Map<string, string[]>();
  const communeOfEpci = new Map<string, string>(); // insee -> siren (premier EPCI qui la contient)
  for (const { siren } of EPCIS) {
    epciNom.set(
      siren,
      (await client.query<{ nom: string }>("SELECT nom FROM api_referentiel.groupements WHERE siren=$1", [siren])).rows[0]?.nom ?? siren,
    );
    const communes = (
      await client.query<{ c: string }>("SELECT code_insee_commune c FROM api_referentiel.perimetres WHERE siren_groupement=$1", [siren])
    ).rows.map((x) => x.c);
    epciCommunes.set(siren, communes);
    for (const c of communes) if (!communeOfEpci.has(c)) communeOfEpci.set(c, siren);
  }
  const allCommunes = [...new Set([...epciCommunes.values()].flat())];
  const communeRows = (await client.query<{ code_insee: string; nom: string; siren: string }>(
    "SELECT code_insee, nom, siren FROM api_referentiel.communes WHERE code_insee = ANY($1)", [allCommunes],
  )).rows;
  const communeNom = new Map(communeRows.map((r) => [r.code_insee, r.nom]));
  // SIREN d'une commune membre -> EPCI (pour rattacher les projets portés par la commune,
  // qui ont collectiviteResponsableSiren = SIREN commune et souvent pas de lien commune).
  const communeSirenToEpci = new Map<string, string>();
  for (const r of communeRows) { const s = communeOfEpci.get(r.code_insee); if (s && r.siren) communeSirenToEpci.set(r.siren, s); }
  const responsableSirens = [...new Set([...SIRENS, ...communeSirenToEpci.keys()])];

  // ── 2. Projets du périmètre (toutes sources) ──
  const projRows = (await client.query<{
    id: string; nom: string; description: string | null; source_origine: string;
    territoireCommunes: string | null; collectiviteResponsableSiren: string | null;
    budgetPrevisionnel: string | null; dateDebut: string | null; dateFin: string | null;
    llm_thematiques: LlmLabel[] | null; llm_sites: LlmLabel[] | null; llm_interventions: LlmLabel[] | null;
    llm_probabilite_te: number | null;
    lat: string | null; lon: string | null; adresse: string | null;
    lien_communes: string[] | null;
  }>(
    `SELECT p.id, p.nom, p.description, p.source_origine, p."territoireCommunes", p."collectiviteResponsableSiren",
            p."budgetPrevisionnel", p."dateDebut", p."dateFin",
            p.llm_thematiques, p.llm_sites, p.llm_interventions, p.llm_probabilite_te,
            p."localisationLatitude" lat, p."localisationLongitude" lon, p."localisationAdresse" adresse,
            (SELECT array_agg(l2.insee_com) FROM schema_commun_v2.liens_projets_communes l2 WHERE l2.projet_id = p.id) AS lien_communes
     FROM schema_commun_v2.projets_operationnels p
     WHERE p.id IN (
       SELECT DISTINCT p2.id FROM schema_commun_v2.projets_operationnels p2
       LEFT JOIN schema_commun_v2.liens_projets_communes l ON l.projet_id = p2.id
       WHERE l.insee_com = ANY($1) OR p2."collectiviteResponsableSiren" = ANY($2)
     )`,
    [allCommunes, responsableSirens],
  )).rows;

  // Résolution EPCI de chaque projet (par commune membre, sinon par SIREN responsable)
  type Proj = typeof projRows[number] & { epciSiren: string; communeNoms: string[]; coord: [number, number] | null };
  const projets: Proj[] = [];
  for (const r of projRows) {
    const comm = new Set<string>();
    for (const c of String(r.territoireCommunes ?? "").split(",")) if (c.trim()) comm.add(c.trim());
    for (const c of r.lien_communes ?? []) if (c) comm.add(c);
    let epciSiren = "";
    for (const c of comm) { const s = communeOfEpci.get(c); if (s) { epciSiren = s; break; } }
    const resp = r.collectiviteResponsableSiren ?? "";
    if (!epciSiren && SIRENS.includes(resp)) epciSiren = resp;             // porté par l'EPCI
    if (!epciSiren && communeSirenToEpci.has(resp)) epciSiren = communeSirenToEpci.get(resp)!; // porté par une commune membre
    if (!epciSiren) continue; // hors périmètre (sécurité)
    const la = toNum(r.lat), lo = toNum(r.lon);
    projets.push({
      ...r, epciSiren,
      communeNoms: [...comm].map((c) => communeNom.get(c)).filter(Boolean) as string[],
      coord: la != null && lo != null ? [la, lo] : null,
    });
  }
  const projById = new Map(projets.map((p) => [p.id, p]));
  const projetIds = projets.map((p) => p.id);

  // ── 3. Clusters (membership des projets du périmètre + membres complets) ──
  const memb = (await client.query<{ projet_id: string; cluster_id: string; confiance: string; taille: number; type: string }>(
    `SELECT cm.projet_id, cm.cluster_id, c.confiance, c.taille, c.type
     FROM schema_commun_v2.clusters_membres cm JOIN schema_commun_v2.clusters c ON c.id = cm.cluster_id
     WHERE cm.projet_id = ANY($1)`, [projetIds],
  )).rows;
  const clusterOfProj = new Map(memb.map((m) => [m.projet_id, m]));
  const clusterIds = [...new Set(memb.map((m) => m.cluster_id))];
  const allMembers = (await client.query<{ cluster_id: string; projet_id: string | null; fiche_action_id: string | null }>(
    `SELECT cluster_id, projet_id, fiche_action_id FROM schema_commun_v2.clusters_membres WHERE cluster_id = ANY($1)`, [clusterIds],
  )).rows;
  // noms/sources des membres (projets et fiches, y compris hors périmètre)
  const memberProjetIds = [...new Set(allMembers.map((m) => m.projet_id).filter(Boolean) as string[])];
  const memberFicheIds = [...new Set(allMembers.map((m) => m.fiche_action_id).filter(Boolean) as string[])];
  const projNomSrc = new Map(
    (await client.query<{ id: string; nom: string; source_origine: string }>(
      `SELECT id, nom, source_origine FROM schema_commun_v2.projets_operationnels WHERE id = ANY($1)`, [memberProjetIds],
    )).rows.map((r) => [r.id, r]),
  );
  const ficheNom = new Map(
    memberFicheIds.length
      ? (await client.query<{ id: string; nom: string }>(
          `SELECT id, nom FROM schema_commun_v2.fiches_action WHERE id = ANY($1)`, [memberFicheIds],
        )).rows.map((r) => [r.id, r.nom])
      : [],
  );

  // ── 3bis. Fiches action TeT du périmètre (racines, avec classification scorée) ──
  // Servent à la recherche de fiches et au matching fiche→projets (formule aides).
  const ficheRows = (await client.query<{
    id: string; nom: string; description: string | null;
    territoire_communes: string[] | null; collectivite_responsable_siren: string | null;
    classification_scores: { thematiques?: LlmLabel[]; sites?: LlmLabel[]; interventions?: LlmLabel[] } | null;
    competences_m57: string[] | null; leviers_sgpe: string[] | null;
  }>(
    `SELECT f.id::text AS id, f.nom, f.description, f.territoire_communes, f.collectivite_responsable_siren,
            f.classification_scores, f.competences_m57, f.leviers_sgpe
     FROM data_tet.fiches_action f
     WHERE f.parent_id IS NULL AND f.classification_scores IS NOT NULL
       AND (f.territoire_communes && $1::text[] OR f.collectivite_responsable_siren = ANY($2))`,
    [allCommunes, responsableSirens],
  )).rows;
  await client.end();

  // ── 4. Enrichissements web ──
  // Deux usages : (a) join par projetId pour enrichir les popups carte (226 matchent les
  // ids schema_commun_v2) ; (b) dataset autonome bucketé par EPCI pour la TABLE — car
  // 453 enrichissements ont des projetId d'un autre espace (ids natifs) inexistants en
  // base, mais leurs champs (commune, intitulé, montant, sources) sont autosuffisants.
  const enrichByProj = new Map<string, Enrichment>(); // join carte (projetId ∈ périmètre)
  const enrichByEpci = new Map<string, Enrichment[]>(); // table (bucket par commune→EPCI)
  let enrichIdUnmatched = 0; // projetId hors schema_commun_v2 (info)
  let enrichCommuneUnmatched = 0; // commune non rattachable à un des 5 EPCI
  const epciNomToSiren = new Map<string, string>();
  for (const { siren } of EPCIS) epciNomToSiren.set((epciNom.get(siren) ?? "").trim().toLowerCase(), siren);
  const communeNomToSiren = new Map<string, string>();
  for (const r of communeRows) { const s = communeOfEpci.get(r.code_insee); if (s) communeNomToSiren.set(r.nom.trim().toLowerCase(), s); }
  if (args.enrich && fs.existsSync(args.enrich)) {
    const e = JSON.parse(fs.readFileSync(args.enrich, "utf8")) as { enrichissements: (Enrichment & { commune?: string })[] };
    for (const item of e.enrichissements ?? []) {
      if (projById.has(item.projetId)) enrichByProj.set(item.projetId, item);
      else enrichIdUnmatched++;
      const key = (item.commune ?? "").trim().toLowerCase();
      const siren = epciNomToSiren.get(key) ?? communeNomToSiren.get(key);
      if (siren) { if (!enrichByEpci.has(siren)) enrichByEpci.set(siren, []); enrichByEpci.get(siren)!.push(item); }
      else enrichCommuneUnmatched++;
    }
  }

  // ── 5. Requalif fiches TeT (dataset autonome bucketé par EPCI) ──
  const requalifByEpci = new Map<string, { nom_brut: string; nom_nettoye: string; p_fiche: number; p_projet: number; p_tache: number; pred: string }[]>();
  const requalifUnmatched = new Map<string, number>();
  const csvNameToSiren = new Map<string, string>();
  for (const e of EPCIS) for (const n of e.csvNames) csvNameToSiren.set(n.trim().toLowerCase(), e.siren);
  if (args.requalif && fs.existsSync(args.requalif)) {
    const rows = parseCsv(fs.readFileSync(args.requalif, "utf8"));
    const header = rows.shift() ?? [];
    const col = (name: string) => header.indexOf(name);
    const [iEpci, iNom, iNet, iPf, iPp, iPt, iPred] =
      ["epci", "nom", "nom_nettoye", "p_fiche", "p_projet", "p_tache", "pred"].map(col);
    for (const r of rows) {
      if (!r[iEpci]) continue;
      const siren = csvNameToSiren.get(r[iEpci].trim().toLowerCase());
      if (!siren) { requalifUnmatched.set(r[iEpci], (requalifUnmatched.get(r[iEpci]) ?? 0) + 1); continue; }
      if (!requalifByEpci.has(siren)) requalifByEpci.set(siren, []);
      requalifByEpci.get(siren)!.push({
        nom_brut: r[iNom] ?? "", nom_nettoye: r[iNet] ?? "",
        p_fiche: toNum(r[iPf]) ?? 0, p_projet: toNum(r[iPp]) ?? 0, p_tache: toNum(r[iPt]) ?? 0,
        pred: r[iPred] ?? "",
      });
    }
  }

  // ── 5bis. "Vraies" fiches action + matching fiche→projets (MÊME formule que les aides) ──
  const norm = (s: string) =>
    s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  // pred par (EPCI, nom normalisé) depuis la requalif (clé de "vraie fiche").
  const predByEpciNom = new Map<string, string>();
  for (const [siren, rows] of requalifByEpci)
    for (const r of rows) {
      // Le nom des fiches data_tet correspond au nom BRUT du CSV ; on indexe aussi
      // le nom nettoyé pour maximiser la correspondance.
      predByEpciNom.set(siren + "|" + norm(r.nom_brut), r.pred);
      if (r.nom_nettoye) predByEpciNom.set(siren + "|" + norm(r.nom_nettoye), r.pred);
    }

  const ficheEpci = (f: { territoire_communes: string[] | null; collectivite_responsable_siren: string | null }): string => {
    for (const c of f.territoire_communes ?? []) { const s = communeOfEpci.get(c); if (s) return s; }
    const resp = f.collectivite_responsable_siren ?? "";
    return SIRENS.includes(resp) ? resp : (communeSirenToEpci.get(resp) ?? "");
  };
  const asClassif = (
    c: { thematiques?: LlmLabel[] | null; sites?: LlmLabel[] | null; interventions?: LlmLabel[] | null } | null,
  ): AideClassification =>
    ({ thematiques: c?.thematiques ?? [], sites: c?.sites ?? [], interventions: c?.interventions ?? [] }) as AideClassification;

  // Labels communs sur un axe entre fiche et projet : égalité APRÈS normalisation
  // (corrige les variantes de vocabulaire — ponctuation/accents/casse), au-dessus
  // du plancher, en conservant les deux scores. Libellé retenu = celui de la fiche.
  const r2 = (x: number) => Math.round(x * 100) / 100; // arrondis pour limiter la taille du JSON
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  type Common = { label: string; ps: number; as: number };
  const commonAxis = (fiche: LlmLabel[], proj: LlmLabel[]): Common[] => {
    const am = new Map<string, number>();
    for (const p of proj)
      if (p.score >= MATCH_FLOOR) { const k = norm(p.label); if ((am.get(k) ?? 0) < p.score) am.set(k, p.score); }
    const out: Common[] = [];
    for (const f of fiche)
      if (f.score >= MATCH_FLOOR) { const as = am.get(norm(f.label)); if (as !== undefined) out.push({ label: f.label, ps: r2(f.score), as: r2(as) }); }
    return out;
  };
  // Score d'axe provisoire (au plancher) — sert uniquement à classer/plafonner les
  // candidats ; le score affiché est recalculé côté front selon le seuil réglable.
  const axisProvis = (nFiche: number, common: Common[]): number => {
    if (!nFiche) return 0;
    let s = 0;
    for (const c of common) s += (c.ps - MATCH_FLOOR + OFFSET) * (c.as - MATCH_FLOOR + OFFSET);
    return s / nFiche;
  };

  // Candidats du matching = projets de l'EPCI : classification scorée (thématique)
  // + document textuel (nom + description) pour le BM25.
  const projetsClassifByEpci = new Map<string, Map<string, AideClassification>>();
  const projetDocsByEpci = new Map<string, { id: string; text: string }[]>();
  for (const { siren } of EPCIS) {
    const m = new Map<string, AideClassification>();
    const docs: { id: string; text: string }[] = [];
    for (const p of projets)
      if (p.epciSiren === siren) {
        m.set(p.id, asClassif({ thematiques: p.llm_thematiques, sites: p.llm_sites, interventions: p.llm_interventions }));
        docs.push({ id: p.id, text: `${p.nom} ${p.description ?? ""}` });
      }
    projetsClassifByEpci.set(siren, m);
    projetDocsByEpci.set(siren, docs);
  }

  const fichesByEpci: Record<string, { nom: string; fiches: unknown[] }> = {};
  for (const { siren } of EPCIS) fichesByEpci[siren] = { nom: epciNom.get(siren) ?? siren, fiches: [] };
  let nbFichesMatched = 0;
  for (const f of ficheRows) {
    const siren = ficheEpci(f);
    if (!siren) continue;
    // Catégorie requalifiée du TeT : fiche / projet / tache. On garde les trois
    // (3 onglets côté front) ; on ignore les items sans requalif ou "indéterminé".
    const pred = predByEpciNom.get(siren + "|" + norm(f.nom));
    if (pred !== "fiche" && pred !== "projet" && pred !== "tache") continue;
    const ficheDesc = stripHtml(f.description);

    const fTh = f.classification_scores?.thematiques ?? [];
    const fSi = f.classification_scores?.sites ?? [];
    const fIn = f.classification_scores?.interventions ?? [];
    const nTh = fTh.filter((x) => x.score >= MATCH_FLOOR).length;
    const nSi = fSi.filter((x) => x.score >= MATCH_FLOOR).length;
    const nIn = fIn.filter((x) => x.score >= MATCH_FLOOR).length;

    // (a) Matching thématique : labels communs (au plancher) par axe, avec les deux
    // scores — le score final est recalculé côté front selon le seuil réglable.
    const projClassif = projetsClassifByEpci.get(siren)!;
    const commonOf = (pc: AideClassification) => ({
      thematiques: commonAxis(fTh, pc.thematiques),
      sites: commonAxis(fSi, pc.sites),
      interventions: commonAxis(fIn, pc.interventions),
    });

    // (b) Matching textuel (BM25) — fiche (nom + description) vs corpus projets EPCI.
    const textualMap = bm25Match(`${f.nom} ${ficheDesc ?? ""}`, projetDocsByEpci.get(siren)!);

    const entry = (pid: string, common: ReturnType<typeof commonOf>) => {
      const t = textualMap.get(pid);
      const p = projById.get(pid);
      return {
        projetId: pid,
        nom: p?.nom ?? pid,
        source: p?.source_origine ?? "?",
        textualScore: r3(t?.score ?? 0),
        matchedTerms: t?.matchedTerms ?? [],
        common, // labels communs par axe (label + score fiche + score projet)
      };
    };

    // (c) Candidats thématiques = projets partageant ≥ 1 label (au plancher),
    // classés par score provisoire, plafonnés. Le mode composé (front) reste
    // ADDITIF : on ajoute les candidats textuels (BM25) au-dessus d'un plancher bas.
    const labelCands: { pid: string; common: ReturnType<typeof commonOf>; prov: number }[] = [];
    for (const [pid, pc] of projClassif) {
      const common = commonOf(pc);
      if (!common.thematiques.length && !common.sites.length && !common.interventions.length) continue;
      const prov =
        AXIS_W.th * axisProvis(nTh, common.thematiques) +
        AXIS_W.si * axisProvis(nSi, common.sites) +
        AXIS_W.in * axisProvis(nIn, common.interventions);
      labelCands.push({ pid, common, prov });
    }
    labelCands.sort((a, b) => b.prov - a.prov);
    const kept = labelCands.slice(0, LABEL_CAP);
    const labelIds = new Set(kept.map((c) => c.pid));
    const labelEntries = kept.map((c) => entry(c.pid, c.common));

    const empty = { thematiques: [], sites: [], interventions: [] };
    const rescueEntries = [...textualMap.entries()]
      .filter(([pid, t]) => t.score >= TEXTUAL_EMIT_FLOOR && !labelIds.has(pid))
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, TEXTUAL_RESCUE_CAP)
      .map(([pid]) => entry(pid, empty));
    const matchedProjets = [...labelEntries, ...rescueEntries];

    const keepLabels = (arr: LlmLabel[]) =>
      arr.filter((t) => t.score >= MATCH_FLOOR).map((t) => ({ label: t.label, score: r2(t.score) }));
    fichesByEpci[siren].fiches.push({
      id: f.id,
      nom: f.nom,
      pred, // catégorie requalifiée : fiche | projet | tache
      description: ficheDesc,
      thematiques: keepLabels(fTh),
      sites: keepLabels(fSi),
      interventions: keepLabels(fIn),
      // Codes compétences M57 + noms de leviers SGPE (pour la recherche thématique
      // par labels pondérés, comme la Recherche). On écarte les leviers réduits à
      // un code numérique (axes 1/2/3, non exploitables comme libellé).
      competences: f.competences_m57 ?? [],
      leviers: (f.leviers_sgpe ?? []).filter((l) => l && !/^\d+$/.test(l.trim())),
      matchedProjets,
    });
    nbFichesMatched++;
  }

  // ── 6. Agrégats + assemblage des deux fichiers ──
  const byEpciSummary: Record<string, unknown> = {};
  const detailProjets: Record<string, unknown> = {};
  const clustersByEpci: Record<string, unknown[]> = {};
  const points: { id: string; epciSiren: string; source: string; commune: string | null; coord: [number, number] }[] = [];

  // index clusters par EPCI (clusters contenant ≥1 projet de l'EPCI)
  const clustersSeen = new Map<string, Set<string>>(); // siren -> set(clusterId)
  for (const p of projets) {
    const m = clusterOfProj.get(p.id);
    if (m) { if (!clustersSeen.has(p.epciSiren)) clustersSeen.set(p.epciSiren, new Set()); clustersSeen.get(p.epciSiren)!.add(m.cluster_id); }
  }

  for (const { siren } of EPCIS) {
    const ps = projets.filter((p) => p.epciSiren === siren);
    const parSource: Record<string, number> = {};
    let budgetTotal = 0, nbGeoloc = 0;
    for (const p of ps) {
      const fam = p.source_origine ?? "?";
      parSource[fam] = (parSource[fam] ?? 0) + 1;
      budgetTotal += toNum(p.budgetPrevisionnel) ?? 0;
      if (p.coord) { nbGeoloc++; points.push({ id: p.id, epciSiren: siren, source: p.source_origine, commune: p.communeNoms[0] ?? null, coord: p.coord }); }
      // détail (gated)
      const m = clusterOfProj.get(p.id);
      const en = enrichByProj.get(p.id);
      detailProjets[p.id] = {
        epciSiren: siren, source: p.source_origine, nom: p.nom,
        budget: toNum(p.budgetPrevisionnel), dateDebut: p.dateDebut, dateFin: p.dateFin,
        adresse: p.adresse, probaTe: p.llm_probabilite_te,
        thematiques: p.llm_thematiques ?? [], sites: p.llm_sites ?? [], interventions: p.llm_interventions ?? [],
        clusterId: m?.cluster_id ?? null, clusterConfiance: m?.confiance ?? null,
        coord: p.coord, communeNoms: p.communeNoms,
        enrich: en
          ? {
              intitule: en.intitule, confiance: en.confiance, subvention: en.subvention, calendrier: en.calendrier,
              maitrise_oeuvre: en.maitrise_oeuvre, entreprises: en.entreprises, surface: en.surface,
              descriptif: en.descriptif, avancement: en.avancement, sources: en.sources ?? [],
            }
          : null,
      };
    }

    // requalif agrégat
    const rqRows = requalifByEpci.get(siren) ?? [];
    const pred: Record<string, number> = { fiche: 0, projet: 0, tache: 0, "indéterminé": 0 };
    const sumP = { fiche: 0, projet: 0, tache: 0 };
    for (const r of rqRows) {
      pred[r.pred] = (pred[r.pred] ?? 0) + 1;
      sumP.fiche += r.p_fiche; sumP.projet += r.p_projet; sumP.tache += r.p_tache;
    }
    const n = rqRows.length || 1;
    const meanP = { fiche: +(sumP.fiche / n).toFixed(3), projet: +(sumP.projet / n).toFixed(3), tache: +(sumP.tache / n).toFixed(3) };

    // enrich agrégat (bucket par commune→EPCI, dataset autonome)
    const enr = enrichByEpci.get(siren) ?? [];
    const parConfiance: Record<string, number> = { forte: 0, moyenne: 0, faible: 0 };
    for (const e of enr) parConfiance[e.confiance ?? "?"] = (parConfiance[e.confiance ?? "?"] ?? 0) + 1;

    // clusters de l'EPCI
    const cids = [...(clustersSeen.get(siren) ?? new Set())];
    const clParConfiance: Record<string, number> = { CERTAIN: 0, PROBABLE: 0 };
    const clusterList: unknown[] = [];
    for (const cid of cids) {
      const head = memb.find((m) => m.cluster_id === cid)!;
      clParConfiance[head.confiance] = (clParConfiance[head.confiance] ?? 0) + 1;
      const membres = allMembers.filter((m) => m.cluster_id === cid).map((m) => {
        if (m.projet_id) { const x = projNomSrc.get(m.projet_id); return { projetId: m.projet_id, nom: x?.nom ?? m.projet_id, source: x?.source_origine ?? "?" }; }
        return { ficheActionId: m.fiche_action_id, nom: ficheNom.get(m.fiche_action_id!) ?? m.fiche_action_id, source: "TeT" };
      });
      clusterList.push({ clusterId: cid, confiance: head.confiance, taille: head.taille, type: head.type, membres });
    }
    clustersByEpci[siren] = clusterList;

    byEpciSummary[siren] = {
      nom: epciNom.get(siren), nbProjets: ps.length, nbProjetsGeoloc: nbGeoloc, budgetTotal,
      parSource,
      requalif: { nbFiches: rqRows.length, pred, meanP },
      enrich: { nbEnrichis: enr.length, parConfiance },
      clusters: { nbClusters: cids.length, parConfiance: clParConfiance },
    };
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    perimetre: "5 EPCI test",
    epcis: EPCIS.map((e) => ({ siren: e.siren, nom: epciNom.get(e.siren) ?? e.siren, nbCommunes: (epciCommunes.get(e.siren) ?? []).length })),
    enrichTotal: enrichByProj.size + enrichIdUnmatched,
    enrichJointsCarte: enrichByProj.size,
    enrichIdHorsSchema: enrichIdUnmatched,
    enrichCommuneNonRattachee: enrichCommuneUnmatched,
    requalifUnmatchedEpcis: [...requalifUnmatched.entries()].map(([nom, n]) => ({ nom, n })),
  };

  const outdir = args.outdir;
  fs.mkdirSync(outdir, { recursive: true });
  fs.writeFileSync(join(outdir, "poc-summary.json"), JSON.stringify({ meta, byEpci: byEpciSummary, points }));
  fs.writeFileSync(
    join(outdir, "poc-detail.json"),
    JSON.stringify({
      meta,
      projets: detailProjets,
      requalifByEpci: Object.fromEntries(EPCIS.map((e) => [e.siren, { nom: epciNom.get(e.siren), rows: requalifByEpci.get(e.siren) ?? [] }])),
      enrichByEpci: Object.fromEntries(EPCIS.map((e) => [e.siren, { nom: epciNom.get(e.siren), rows: enrichByEpci.get(e.siren) ?? [] }])),
      clustersByEpci,
      fichesByEpci,
    }),
  );

  console.log(`PoC data écrit dans ${outdir}/`);
  console.log(`  projets: ${projets.length} (géoloc ${points.length}) | enrich: ${enrichByProj.size} joints carte, ${enrichIdUnmatched} ids hors schema (table OK), ${enrichCommuneUnmatched} communes non rattachées`);
  console.log(`  requalif EPCI non mappés: ${JSON.stringify(meta.requalifUnmatchedEpcis)}`);
  const predCounts = { fiche: 0, projet: 0, tache: 0 };
  for (const { siren } of EPCIS) for (const f of fichesByEpci[siren].fiches as { pred: "fiche" | "projet" | "tache" }[]) predCounts[f.pred]++;
  console.log(`  items TeT requalifiés avec matching projets: ${nbFichesMatched} (sur ${ficheRows.length} racines) — ${JSON.stringify(predCounts)}`);
  for (const { siren } of EPCIS) {
    const s = byEpciSummary[siren] as { nom: string; nbProjets: number; nbProjetsGeoloc: number; enrich: { nbEnrichis: number }; requalif: { nbFiches: number }; clusters: { nbClusters: number } };
    console.log(`  ${s.nom}: ${s.nbProjets} projets (${s.nbProjetsGeoloc} géo), ${s.enrich.nbEnrichis} enrichis, ${s.requalif.nbFiches} fiches, ${s.clusters.nbClusters} clusters`);
  }
}

void main();
