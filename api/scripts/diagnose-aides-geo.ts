/**
 * Diagnostic des filtrages de GET /aides — géographique PUIS thématique.
 *
 * Rejoue, pour un projet donné, les deux étages de filtrage de l'endpoint :
 *
 * Étage géographique :
 *   1. Résolution du projet (public.projets → data_mec → data_tet)
 *   2. Résolution des collectivités + extraction des codes INSEE (communes)
 *   3. Appel direct Aides-Territoires par code INSEE, ventilé par perimeter_scale
 *   4. Union / déduplication par aide.id
 *   5. Comparaison commune vs EPCI (détecte ce que le scope commune raterait)
 *
 * Étage matching :
 *   6. Couverture de classification des aides de l'union (aide_classifications)
 *   7. Profil thématique du projet (labels ≥ 0.8 par axe)
 *   8.   Simulation du matching thématique — score, labels communs, no_match
 *   8bis Simulation du matching textuel (BM25) + score combiné — reproduit le
 *        mode AIDES_TEXTUAL_MATCHING_ENABLED : rescue des aides sans match
 *        thématique mais texte pertinent (y compris non classifiées)
 *
 *   9. (optionnel) Diff avec la réponse réelle de GET /aides
 *
 * But : voir exactement ce qui entre et sort à chaque étape, pour être sûr
 * qu'aucune aide n'est silencieusement perdue — ni géographiquement, ni au
 * matching thématique, ni au matching textuel.
 *
 * Lecture seule — aucune écriture en base ni côté AT.
 *
 * Usage :
 *   AT_API_TOKEN=... DATABASE_URL=... npx tsx scripts/diagnose-aides-geo.ts <projetId>
 *
 *   # avec comparaison à l'endpoint réel :
 *   ... npx tsx scripts/diagnose-aides-geo.ts <projetId> \
 *       --api-url=https://les-communs-...-staging.osc-fr1.scalingo.io \
 *       --api-key=<clé_api>
 */

import { Pool, type PoolConfig } from "pg";
import { bm25Match } from "../src/aides/textual-matching.bm25";

const AT_BASE = "https://aides-territoires.beta.gouv.fr/api";

// Seuil et offset du matching thématique — alignés sur AidesMatchingService.
const SCORE_THRESHOLD = 0.8;
const SCORE_OFFSET = 0.1;

// Combinaison thématique/textuel — alignée sur aides.controller.ts.
const W_THEMATIC = 0.7;
const W_TEXTUAL = 0.3;
const MIN_TEXTUAL_RESCUE = 0.2;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Aide {
  id: number;
  name: string;
  short_title: string | null;
  description: string | null;
  eligibility: string | null;
  project_examples: string | null;
  categories: string[];
  perimeter: string | null;
  perimeter_scale: string | null;
}

/** Texte indexable d'une aide — aligné sur AidesTextualMatchingService.aideDocument. */
function aideDocument(aide: Aide): string {
  return [
    aide.name,
    aide.short_title ?? "",
    aide.description ?? "",
    aide.eligibility ?? "",
    aide.project_examples ?? "",
    ...(aide.categories ?? []),
  ].join(" ");
}

interface Collectivite {
  nom: string | null;
  type: string | null;
  code_insee: string | null;
  code_epci: string | null;
  siren: string | null;
}

interface LabelScore {
  label: string;
  score: number;
}

interface ClassificationScores {
  thematiques: LabelScore[];
  sites: LabelScore[];
  interventions: LabelScore[];
}

type Axis = "thematiques" | "sites" | "interventions";
const AXES: Axis[] = ["thematiques", "sites", "interventions"];

// ─── DB config (parse manuel pour ignorer sslmode de l'URL) ──────────────────

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

// ─── AT client ───────────────────────────────────────────────────────────────

async function getBearer(authToken: string): Promise<string> {
  const res = await fetch(`${AT_BASE}/connexion/`, {
    method: "POST",
    headers: { "X-AUTH-TOKEN": authToken },
  });
  if (!res.ok) {
    throw new Error(`AT auth failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

/** Récupère toutes les aides AT pour un jeu de params (paginé). */
async function fetchAides(bearer: string, params: Record<string, string>): Promise<Aide[]> {
  const all: Aide[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const qs = new URLSearchParams({ ...params, page_size: "50", page: String(page) });
    const res = await fetch(`${AT_BASE}/aids/?${qs}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) {
      throw new Error(`AT /aids/ error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { next: string | null; results: Aide[] };
    all.push(...data.results);
    hasMore = data.next !== null;
    page++;
    if (page > 200) {
      console.warn("  ⚠️  200 pages atteintes, arrêt pagination");
      break;
    }
  }
  return all;
}

// ─── Résolution du projet ────────────────────────────────────────────────────

type ProjetSource = "public" | "data_mec" | "data_tet";

interface ResolvedProjet {
  source: ProjetSource;
  collectivites: Collectivite[];
  classificationScores: ClassificationScores | null;
  nom: string | null;
  description: string | null;
}

async function resolveProjet(pool: Pool, projetId: string): Promise<ResolvedProjet | null> {
  // 1. public.projets
  const pub = await pool.query<{
    classification_scores: ClassificationScores | null;
    nom: string | null;
    description: string | null;
  }>(`SELECT classification_scores, nom, description FROM public.projets WHERE id = $1`, [projetId]);
  if (pub.rowCount && pub.rowCount > 0) {
    const cols = await pool.query<Collectivite>(
      `SELECT c.nom, c.type, c.code_insee, c.code_epci, c.siren
         FROM public.collectivites c
         JOIN public.projets_to_collectivites ptc ON ptc.collectivite_id = c.id
        WHERE ptc.projet_id = $1`,
      [projetId],
    );
    return {
      source: "public",
      collectivites: cols.rows,
      classificationScores: pub.rows[0].classification_scores,
      nom: pub.rows[0].nom,
      description: pub.rows[0].description,
    };
  }

  // 2. data_mec / 3. data_tet — résolution via territoire_communes + siren
  for (const [source, table] of [
    ["data_mec", "data_mec.projets_operationnels"],
    ["data_tet", "data_tet.fiches_action"],
  ] as const) {
    const row = await pool.query<{
      territoire_communes: string[] | null;
      siren: string | null;
      classification_scores: ClassificationScores | null;
      nom: string | null;
      description: string | null;
    }>(
      `SELECT territoire_communes, collectivite_responsable_siren AS siren, classification_scores, nom, description
         FROM ${table} WHERE id = $1`,
      [projetId],
    );
    if (row.rowCount && row.rowCount > 0) {
      const { territoire_communes, siren, classification_scores, nom, description } = row.rows[0];
      const collectivites = await resolveCollectivites(pool, territoire_communes, siren);
      return { source, collectivites, classificationScores: classification_scores, nom, description };
    }
  }

  return null;
}

/** Reproduit GetProjetsService.resolveCollectivitesFromTerritoire. */
async function resolveCollectivites(
  pool: Pool,
  codesInsee: string[] | null,
  siren: string | null,
): Promise<Collectivite[]> {
  if (codesInsee && codesInsee.length > 0) {
    const rows = await pool.query<Collectivite>(
      `SELECT nom, type, code_insee, code_epci, siren
         FROM public.collectivites WHERE code_insee = ANY($1)`,
      [codesInsee],
    );
    if (rows.rowCount && rows.rowCount > 0) return rows.rows;
  }
  if (siren) {
    const rows = await pool.query<Collectivite>(
      `SELECT nom, type, code_insee, code_epci, siren
         FROM public.collectivites WHERE siren = $1`,
      [siren],
    );
    if (rows.rowCount && rows.rowCount > 0) return rows.rows;
    // stub : SIREN connu mais pas dans collectivites
    return [{ nom: "(stub)", type: "Commune", code_insee: null, code_epci: null, siren }];
  }
  return [];
}

// ─── Helpers d'affichage ─────────────────────────────────────────────────────

function scaleBreakdown(aides: Aide[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of aides) {
    const scale = a.perimeter_scale ?? "(inconnu)";
    m.set(scale, (m.get(scale) ?? 0) + 1);
  }
  return m;
}

function printScaleBreakdown(aides: Aide[], indent = "    "): void {
  const breakdown = [...scaleBreakdown(aides).entries()].sort((a, b) => b[1] - a[1]);
  for (const [scale, n] of breakdown) {
    console.log(`${indent}${scale.padEnd(16)} ${n}`);
  }
}

// ─── Matching (port fidèle de AidesMatchingService) ──────────────────────────

/** Garde les labels ≥ seuil → Map<label, score>. */
function filterByThreshold(items: LabelScore[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of items) {
    if (it.score >= SCORE_THRESHOLD) map.set(it.label, it.score);
  }
  return map;
}

/** Score d'un axe : Σ((Sp-0.7)×(Sa-0.7)) / nb_labels_projet. */
function scoreAxis(
  projectItems: Map<string, number>,
  aideItems: Map<string, number>,
): { score: number; commonLabels: string[] } {
  if (projectItems.size === 0) return { score: 0, commonLabels: [] };
  let total = 0;
  const commonLabels: string[] = [];
  for (const [label, pScore] of projectItems) {
    const aScore = aideItems.get(label);
    if (aScore !== undefined) {
      total += (pScore - SCORE_THRESHOLD + SCORE_OFFSET) * (aScore - SCORE_THRESHOLD + SCORE_OFFSET);
      commonLabels.push(label);
    }
  }
  return { score: total / projectItems.size, commonLabels };
}

interface AideMatch {
  idAt: string;
  score: number;
  normalizedScore: number;
  perAxis: Record<Axis, { score: number; commonLabels: string[] }>;
}

/** Reproduit AidesMatchingService.match (sans le slice limit — on veut tout voir). */
function runMatching(projetScores: ClassificationScores, aidesScores: Map<string, ClassificationScores>): AideMatch[] {
  const projectByAxis: Record<Axis, Map<string, number>> = {
    thematiques: filterByThreshold(projetScores.thematiques),
    sites: filterByThreshold(projetScores.sites),
    interventions: filterByThreshold(projetScores.interventions),
  };

  // projectMax : score théorique si une aide matchait tous les labels à 1.0
  const maxAideContribution = 1.0 - SCORE_THRESHOLD + SCORE_OFFSET; // 0.3
  let projectMax = 0;
  for (const axis of AXES) {
    const labels = projectByAxis[axis];
    if (labels.size === 0) continue;
    let sum = 0;
    for (const pScore of labels.values()) {
      sum += (pScore - SCORE_THRESHOLD + SCORE_OFFSET) * maxAideContribution;
    }
    projectMax += sum / labels.size;
  }

  const results: AideMatch[] = [];
  for (const [idAt, aideScores] of aidesScores) {
    const perAxis = {
      thematiques: scoreAxis(projectByAxis.thematiques, filterByThreshold(aideScores.thematiques)),
      sites: scoreAxis(projectByAxis.sites, filterByThreshold(aideScores.sites)),
      interventions: scoreAxis(projectByAxis.interventions, filterByThreshold(aideScores.interventions)),
    };
    const total = perAxis.thematiques.score + perAxis.sites.score + perAxis.interventions.score;
    if (total > 0) {
      results.push({
        idAt,
        score: Math.round(total * 100) / 100,
        normalizedScore: projectMax > 0 ? Math.round((total / projectMax) * 100) / 100 : 0,
        perAxis,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const projetId = process.argv[2];
  if (!projetId) {
    console.error("Usage: npx tsx scripts/diagnose-aides-geo.ts <projetId> [--api-url=...] [--api-key=...]");
    process.exit(1);
  }
  const apiUrl = process.argv.find((a) => a.startsWith("--api-url="))?.split("=")[1];
  const apiKey = process.argv.find((a) => a.startsWith("--api-key="))?.split("=")[1];

  const atToken = process.env.AT_API_TOKEN;
  if (!atToken) {
    console.error("❌ AT_API_TOKEN manquant");
    process.exit(1);
  }

  const pool = new Pool(buildDbConfig());

  console.log(`\n=== Diagnostic filtrage géographique /aides — projet ${projetId} ===\n`);

  // ── Phase 1 — Résolution projet ────────────────────────────────────────────
  const resolved = await resolveProjet(pool, projetId);
  if (!resolved) {
    console.error(`❌ Projet introuvable dans public.projets, data_mec ni data_tet`);
    await pool.end();
    process.exit(1);
  }
  console.log(`Phase 1 — Projet trouvé. Source : ${resolved.source}\n`);

  // ── Phase 2 — Collectivités + extraction codes INSEE ───────────────────────
  console.log(`Phase 2 — Collectivités (${resolved.collectivites.length}) :`);
  for (const c of resolved.collectivites) {
    console.log(
      `  - ${(c.nom ?? "?").padEnd(28)} type=${(c.type ?? "?").padEnd(12)}` +
        ` insee=${c.code_insee ?? "—"}  epci=${c.code_epci ?? "—"}  siren=${c.siren ?? "—"}`,
    );
  }

  // Reproduit AidesController.extractCodesInsee : Communes uniquement
  const codesInsee = [
    ...new Set(resolved.collectivites.filter((c) => c.type === "Commune" && c.code_insee).map((c) => c.code_insee!)),
  ];
  console.log(`\n  Codes INSEE extraits (type=Commune) : ${codesInsee.length ? codesInsee.join(", ") : "(aucun)"}`);

  if (codesInsee.length === 0) {
    console.log(
      "\n  ⚠️  Aucun code INSEE — l'endpoint ferait un appel SANS filtre territorial\n" +
        "      (tout le catalogue AT). C'est le trou EPCI-only : un projet porté\n" +
        "      uniquement par un EPCI ne pré-filtre rien.",
    );
  }

  // ── Phase 3 — Appels AT par territoire ─────────────────────────────────────
  console.log(`\nPhase 3 — Appels Aides-Territoires (perimeter_codes[])\n`);
  const bearer = await getBearer(atToken);

  const seen = new Set<number>();
  const union: Aide[] = [];
  const perCode = new Map<string, Aide[]>();

  const codesToQuery = codesInsee.length > 0 ? codesInsee : ["(sans filtre)"];
  for (const code of codesToQuery) {
    const params: Record<string, string> = code === "(sans filtre)" ? {} : { "perimeter_codes[]": code };
    const aides = await fetchAides(bearer, params);
    perCode.set(code, aides);

    console.log(`  ${code} → ${aides.length} aides`);
    printScaleBreakdown(aides);

    for (const a of aides) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        union.push(a);
      }
    }
  }

  // ── Phase 4 — Union ────────────────────────────────────────────────────────
  console.log(`\nPhase 4 — Union dédupliquée : ${union.length} aides uniques`);
  console.log(`  Ventilation par échelle :`);
  printScaleBreakdown(union, "    ");

  // ── Phase 5 — Comparaison commune vs EPCI ──────────────────────────────────
  if (codesInsee.length > 0) {
    console.log(`\nPhase 5 — Comparaison commune vs EPCI (détection de manques)\n`);
    for (const code of codesInsee) {
      const epci = await pool.query<{ code_epci: string | null; nom: string }>(
        `SELECT code_epci, nom FROM api_referentiel.communes WHERE code_insee = $1`,
        [code],
      );
      const epciCode = epci.rows[0]?.code_epci ?? null;
      if (!epciCode) {
        console.log(`  ${code} : pas d'EPCI dans api_referentiel.communes, skip`);
        continue;
      }

      const epciAides = await fetchAides(bearer, { "perimeter_codes[]": epciCode });
      const communeAides = perCode.get(code) ?? [];
      const communeIds = new Set(communeAides.map((a) => a.id));
      const epciIds = new Set(epciAides.map((a) => a.id));

      const onlyEpci = epciAides.filter((a) => !communeIds.has(a.id));
      const onlyCommune = communeAides.filter((a) => !epciIds.has(a.id));

      console.log(
        `  ${code} (EPCI ${epciCode}) : commune=${communeAides.length} aides, ` + `EPCI=${epciAides.length} aides`,
      );
      console.log(`    aides vues par EPCI mais PAS par la commune : ${onlyEpci.length}`);
      console.log(`    aides vues par la commune mais PAS par l'EPCI : ${onlyCommune.length}`);
      if (onlyEpci.length > 0) {
        for (const a of onlyEpci.slice(0, 10)) {
          console.log(`      + [${a.perimeter_scale}] ${a.name.slice(0, 70)}`);
        }
        if (onlyEpci.length > 10) console.log(`      … +${onlyEpci.length - 10} autres`);
      }
    }
    console.log(
      "\n  Lecture : si « vues par EPCI mais pas par la commune » > 0, l'appel\n" +
        "  scope commune rate des aides. Inversement c'est normal qu'une aide\n" +
        "  ciblant une autre commune de l'EPCI n'apparaisse pas au scope commune.",
    );
  }

  // ══ ÉTAGE THÉMATIQUE (matching) ════════════════════════════════════════════

  // ── Phase 6 — Couverture de classification des aides ───────────────────────
  console.log(`\nPhase 6 — Classification des aides de l'union (aide_classifications)\n`);
  const unionIds = union.map((a) => String(a.id));
  const classifRows =
    unionIds.length > 0
      ? await pool.query<{ id_at: string; classification_scores: ClassificationScores }>(
          `SELECT id_at, classification_scores FROM public.aide_classifications WHERE id_at = ANY($1)`,
          [unionIds],
        )
      : { rows: [] as { id_at: string; classification_scores: ClassificationScores }[] };

  const aidesScores = new Map<string, ClassificationScores>();
  for (const r of classifRows.rows) aidesScores.set(r.id_at, r.classification_scores);

  const classifiedCount = aidesScores.size;
  const unclassifiedCount = union.length - classifiedCount;
  console.log(`  Aides de l'union          : ${union.length}`);
  console.log(`  → avec classification     : ${classifiedCount}`);
  console.log(`  → SANS classification     : ${unclassifiedCount}`);
  if (unclassifiedCount > 0) {
    console.log(
      `\n  ⚠️  ${unclassifiedCount} aide(s) sans classification ne pourront JAMAIS matcher.\n` +
        `      Elles sont exclues silencieusement du résultat. Si ce nombre est élevé,\n` +
        `      c'est que le cron de classification des aides n'a pas tout traité.`,
    );
    for (const a of union.filter((x) => !aidesScores.has(String(x.id))).slice(0, 10)) {
      console.log(`      · [${a.id}] ${a.name.slice(0, 70)}`);
    }
  }

  // ── Phase 7 — Profil thématique du projet ──────────────────────────────────
  console.log(`\nPhase 7 — Profil thématique du projet\n`);
  const projetScores = resolved.classificationScores;
  if (!projetScores) {
    console.log(
      `  ⚠️  Le projet n'a PAS de classification_scores.\n` +
        `      L'endpoint renverrait 202 classification_pending — aucun matching possible.`,
    );
  } else {
    for (const axis of AXES) {
      const kept = filterByThreshold(projetScores[axis] ?? []);
      const all = projetScores[axis] ?? [];
      console.log(`  ${axis} : ${kept.size} label(s) ≥ ${SCORE_THRESHOLD} (sur ${all.length} au total)`);
      for (const [label, score] of kept) {
        console.log(`    · ${label} (${score})`);
      }
      const dropped = all.filter((l) => l.score < SCORE_THRESHOLD);
      if (dropped.length > 0) {
        console.log(`    (ignorés <${SCORE_THRESHOLD} : ${dropped.map((d) => `${d.label}=${d.score}`).join(", ")})`);
      }
    }
    const totalKept = AXES.reduce((n, ax) => n + filterByThreshold(projetScores[ax] ?? []).size, 0);
    if (totalKept === 0) {
      console.log(
        `\n  ⚠️  Aucun label projet ≥ ${SCORE_THRESHOLD} sur les 3 axes → projectMax=0,\n` +
          `      aucune aide ne peut matcher. Résultat endpoint : no_match garanti.`,
      );
    }
  }

  // ── Phase 8 — Simulation du matching ───────────────────────────────────────
  console.log(`\nPhase 8 — Simulation du matching thématique\n`);
  if (!projetScores) {
    console.log(`  Sauté — pas de classification projet.`);
  } else {
    const matches = runMatching(projetScores, aidesScores);
    const matchedIds = new Set(matches.map((m) => m.idAt));

    console.log(`  Aides classifiées évaluées : ${aidesScores.size}`);
    console.log(`  → matchées (score > 0)     : ${matches.length}`);
    console.log(`  → no-match (score = 0)     : ${aidesScores.size - matches.length}`);
    console.log(
      `\n  Statut /aides attendu : ` +
        (union.length === 0 ? "no_aides_on_perimeter" : matches.length === 0 ? "no_match" : "ok") +
        `\n`,
    );

    // Couverture par label : pour chaque label du projet (≥ seuil), combien
    // d'aides du territoire partagent ce label exact (≥ seuil également).
    console.log(`  Nombre d'aides du territoire qui matchent, label par label :\n`);
    for (const axis of AXES) {
      const projectLabels = filterByThreshold(projetScores[axis] ?? []);
      if (projectLabels.size === 0) {
        console.log(`  [${axis}] aucun label projet ≥ ${SCORE_THRESHOLD}`);
        continue;
      }
      console.log(`  [${axis}]`);
      // tri décroissant par nombre d'aides
      const counts = [...projectLabels.keys()]
        .map((label) => {
          let n = 0;
          for (const aideScores of aidesScores.values()) {
            if (filterByThreshold(aideScores[axis] ?? []).has(label)) n++;
          }
          return { label, n };
        })
        .sort((a, b) => b.n - a.n);
      for (const { label, n } of counts) {
        const flag = n === 0 ? "  ⚠️ aucune aide" : "";
        console.log(`    ${String(n).padStart(4)}  ${label}${flag}`);
      }
    }
    console.log(
      `\n  (compté sur les ${aidesScores.size} aides classifiées du territoire ;\n` +
        `   une aide peut compter pour plusieurs labels)\n`,
    );

    if (matches.length > 0) {
      console.log(`  Top matches (triés par score) :`);
      for (const m of matches.slice(0, 15)) {
        const aide = union.find((a) => String(a.id) === m.idAt);
        console.log(
          `    ${m.score.toFixed(3)} (norm ${m.normalizedScore.toFixed(2)})  ` +
            `[${m.idAt}] ${(aide?.name ?? "?").slice(0, 55)}`,
        );
        for (const axis of AXES) {
          const ax = m.perAxis[axis];
          if (ax.commonLabels.length > 0) {
            console.log(`        ${axis}: ${ax.commonLabels.join(", ")}`);
          }
        }
      }
      if (matches.length > 15) console.log(`    … +${matches.length - 15} autres`);
    }

    // Aides classifiées mais non matchées — utile pour comprendre les no-match
    const noMatch = [...aidesScores.keys()].filter((id) => !matchedIds.has(id));
    if (noMatch.length > 0 && matches.length === 0) {
      console.log(
        `\n  Aucune aide ne partage de label ≥ ${SCORE_THRESHOLD} avec le projet.\n` +
          `  Vérifier que les labels projet (phase 7) existent bien dans la taxonomie\n` +
          `  utilisée pour classifier les aides — un écart de libellé = 0 match.`,
      );
    }
  }

  // ── Phase 8bis — Matching textuel (BM25) + score combiné ───────────────────
  // Reproduit le mode "textuel" de aides.controller.ts (flag
  // AIDES_TEXTUAL_MATCHING_ENABLED) : combiné = W·thématique + W·textuel,
  // avec rescue des aides sans match thématique mais texte pertinent.
  console.log(`\nPhase 8bis — Simulation du matching textuel (BM25) + combiné\n`);
  if (!projetScores) {
    console.log(`  Sauté — sans classification le projet renvoie 202, le matching n'est jamais atteint.`);
  } else {
    const projectText = `${resolved.nom ?? ""} ${resolved.description ?? ""}`.trim();
    if (projectText === "") {
      console.log(`  ⚠️  Projet sans nom ni description — score textuel nul partout.\n`);
    }

    const textual = bm25Match(
      projectText,
      union.map((a) => ({ id: String(a.id), text: aideDocument(a) })),
    );

    // Score thématique normalisé par aide (clé absente = aucun match thématique).
    const thematic = new Map<string, number>();
    for (const m of runMatching(projetScores, aidesScores)) thematic.set(m.idAt, m.normalizedScore);

    const combined = union.map((a) => {
      const idAt = String(a.id);
      const th = thematic.get(idAt) ?? 0;
      const tx = textual.get(idAt)?.score ?? 0;
      return {
        idAt,
        hasThematic: thematic.has(idAt),
        thematic: th,
        textual: tx,
        combined: W_THEMATIC * th + W_TEXTUAL * tx,
        matchedTerms: textual.get(idAt)?.matchedTerms ?? [],
      };
    });

    const kept = combined
      .filter((c) => c.hasThematic || c.textual >= MIN_TEXTUAL_RESCUE)
      .sort((a, b) => b.combined - a.combined);
    const rescued = kept.filter((c) => !c.hasThematic).sort((a, b) => b.textual - a.textual);

    console.log(`  Aides du territoire évaluées (texte)   : ${union.length}`);
    console.log(`  → retenues avec textuel activé         : ${kept.length}`);
    console.log(
      `  → dont rescue purement textuelles      : ${rescued.length}  ` +
        `(0 match thématique, textuel ≥ ${MIN_TEXTUAL_RESCUE})`,
    );
    console.log(
      `\n  Statut /aides attendu (textuel ON) : ` +
        (union.length === 0 ? "no_aides_on_perimeter" : kept.length === 0 ? "no_match" : "ok"),
    );

    if (rescued.length > 0) {
      console.log(`\n  Aides rescue par le textuel (invisibles au matching thématique seul) :`);
      for (const c of rescued.slice(0, 15)) {
        const aide = union.find((a) => String(a.id) === c.idAt);
        const tag = aidesScores.has(c.idAt) ? "" : " [non classifiée]";
        console.log(`    textuel ${c.textual.toFixed(2)}  [${c.idAt}] ${(aide?.name ?? "?").slice(0, 52)}${tag}`);
        if (c.matchedTerms.length > 0) {
          console.log(`        termes : ${c.matchedTerms.slice(0, 12).join(", ")}`);
        }
      }
      if (rescued.length > 15) console.log(`    … +${rescued.length - 15} autres`);
    }

    if (kept.length > 0) {
      console.log(`\n  Top matches combinés (W_thématique=${W_THEMATIC} / W_textuel=${W_TEXTUAL}) :`);
      for (const c of kept.slice(0, 15)) {
        const aide = union.find((a) => String(a.id) === c.idAt);
        console.log(
          `    combiné ${c.combined.toFixed(3)}  (thém ${c.thematic.toFixed(2)} / text ${c.textual.toFixed(2)})  ` +
            `[${c.idAt}] ${(aide?.name ?? "?").slice(0, 48)}`,
        );
      }
      if (kept.length > 15) console.log(`    … +${kept.length - 15} autres`);
    }

    console.log(
      `\n  Lecture : compare le « Statut attendu » thématique seul (phase 8) à\n` +
        `  celui-ci. Les aides rescue sont le gain net du matching textuel —\n` +
        `  en particulier les aides [non classifiée], invisibles au thématique.`,
    );
  }

  // ── Phase 9 — Diff avec l'endpoint réel ────────────────────────────────────
  if (apiUrl && apiKey) {
    console.log(`\nPhase 9 — Comparaison avec GET /aides réel\n`);
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/aides?projetId=${projetId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = (await res.json()) as { status?: string; total?: number; aides?: unknown[] };
    console.log(`  HTTP ${res.status} — status=${body.status ?? "?"}`);
    console.log(`  total (aides sur périmètre, avant matching) : ${body.total ?? "?"}`);
    console.log(`  aides matchées renvoyées                    : ${body.aides?.length ?? "?"}`);
    if (typeof body.total === "number") {
      const delta = body.total - union.length;
      if (delta === 0) {
        console.log(`  ✓ total endpoint == union diagnostic (${union.length})`);
      } else {
        console.log(
          `  ⚠️  écart de ${delta} entre l'endpoint (${body.total}) et le diagnostic (${union.length}).\n` +
            `      Causes possibles : cache AT obsolète d'un côté, ou divergence de codes INSEE.`,
        );
      }
    }
  } else {
    console.log(`\nPhase 6 — sautée (passer --api-url et --api-key pour comparer à l'endpoint réel)`);
  }

  console.log(`\n=== Fin du diagnostic ===\n`);
  await pool.end();
}

main().catch((err) => {
  console.error("Diagnostic failed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
