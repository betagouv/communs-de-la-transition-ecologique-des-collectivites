/**
 * Ventilation des aides par label de classification.
 *
 * Pour chaque axe (thematiques / sites / interventions), compte combien d'aides
 * portent chaque label. Donne une vue d'ensemble : quels labels sont riches en
 * aides, lesquels sont vides.
 *
 * Deux modes :
 *   - Global (défaut) : toutes les aides classifiées du catalogue.
 *   - Scopé projet (--projet=<id>) : seulement les aides du territoire du
 *     projet, pré-filtrées via l'index Redis (at:territory:*) — c'est-à-dire
 *     exactement le périmètre géographique que verrait GET /aides. Aucun filtre
 *     autre que géographique : on ventile TOUS les labels de ces aides.
 *     Ce mode ajoute un « Complément matching textuel » : combien d'aides du
 *     territoire le matching textuel (BM25) rattraperait — en particulier les
 *     aides NON classifiées, invisibles à la ventilation par label.
 *
 * Sources :
 *   - Labels de classification : Postgres public.aide_classifications.
 *   - Pré-filtre géographique (mode --projet) : index territoire dans Redis.
 *     ⚠️ Redis ne cache pas les classifications, seulement le contenu AT brut
 *     et l'index territoire→ids. Le mode --projet lit donc Redis pour la liste
 *     d'ids ET le texte des aides (matching textuel), puis Postgres pour les
 *     labels de ces ids.
 *
 * Lecture seule.
 *
 * Usage :
 *   # global
 *   DATABASE_URL=... npx tsx scripts/aides-labels-stats.ts
 *   DATABASE_URL=... npx tsx scripts/aides-labels-stats.ts --threshold=0
 *   DATABASE_URL=... npx tsx scripts/aides-labels-stats.ts --axis=sites
 *
 *   # scopé au territoire d'un projet (nécessite REDIS_URL)
 *   DATABASE_URL=... REDIS_URL=... npx tsx scripts/aides-labels-stats.ts --projet=<uuid>
 *
 * Le seuil par défaut (0.8) correspond à celui du matching : un label sous ce
 * score ne sert jamais à matcher un projet.
 */

import { Pool, type PoolConfig } from "pg";
import Redis from "ioredis";
import { bm25Match } from "../src/aides/textual-matching.bm25";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LabelScore {
  label: string;
  score: number;
}

interface ClassificationScores {
  thematiques: LabelScore[];
  sites: LabelScore[];
  interventions: LabelScore[];
}

interface Collectivite {
  type: string | null;
  code_insee: string | null;
}

type Axis = "thematiques" | "sites" | "interventions";
const AXES: Axis[] = ["thematiques", "sites", "interventions"];

type ProjetSource = "public" | "data_mec" | "data_tet";

const DEFAULT_THRESHOLD = 0.8;
const TERRITORY_PREFIX = "at:territory:";
const AIDE_PREFIX = "at:aide:";
// Plancher de rescue textuel — aligné sur aides.controller.ts.
const MIN_TEXTUAL_RESCUE = 0.2;

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

// ─── Clé de cache territoire (réplique AidesCacheService.buildKey) ───────────

function territoryKey(codeInsee: string): string {
  // buildKey({ "perimeter_codes[]": codeInsee }) → "perimeter_codes[]=<code>"
  return `${TERRITORY_PREFIX}perimeter_codes[]=${codeInsee}`;
}

// ─── Résolution du projet → codes INSEE + texte ──────────────────────────────

interface ResolvedProjet {
  source: ProjetSource;
  codes: string[];
  projectText: string;
}

function projectText(nom: string | null, description: string | null): string {
  return `${nom ?? ""} ${description ?? ""}`.trim();
}

async function resolveProjet(pool: Pool, projetId: string): Promise<ResolvedProjet> {
  // 1. public.projets
  const pub = await pool.query<{ nom: string | null; description: string | null }>(
    `SELECT nom, description FROM public.projets WHERE id = $1`,
    [projetId],
  );
  if (pub.rowCount && pub.rowCount > 0) {
    const cols = await pool.query<Collectivite>(
      `SELECT c.type, c.code_insee
         FROM public.collectivites c
         JOIN public.projets_to_collectivites ptc ON ptc.collectivite_id = c.id
        WHERE ptc.projet_id = $1`,
      [projetId],
    );
    return {
      source: "public",
      codes: extractCommuneCodes(cols.rows),
      projectText: projectText(pub.rows[0].nom, pub.rows[0].description),
    };
  }

  // 2. data_mec / 3. data_tet — territoire_communes est déjà une liste de codes INSEE
  for (const [source, table] of [
    ["data_mec", "data_mec.projets_operationnels"],
    ["data_tet", "data_tet.fiches_action"],
  ] as const) {
    const row = await pool.query<{
      territoire_communes: string[] | null;
      siren: string | null;
      nom: string | null;
      description: string | null;
    }>(
      `SELECT territoire_communes, collectivite_responsable_siren AS siren, nom, description
         FROM ${table} WHERE id = $1`,
      [projetId],
    );
    if (row.rowCount && row.rowCount > 0) {
      const { territoire_communes, siren, nom, description } = row.rows[0];
      const text = projectText(nom, description);
      if (territoire_communes && territoire_communes.length > 0) {
        return { source, codes: [...new Set(territoire_communes)], projectText: text };
      }
      // fallback siren → résolution via public.collectivites
      if (siren) {
        const cols = await pool.query<Collectivite>(
          `SELECT type, code_insee FROM public.collectivites WHERE siren = $1`,
          [siren],
        );
        return { source, codes: extractCommuneCodes(cols.rows), projectText: text };
      }
      return { source, codes: [], projectText: text };
    }
  }

  console.error(`❌ Projet ${projetId} introuvable dans public.projets, data_mec ni data_tet`);
  process.exit(1);
}

/** Reproduit AidesController.extractCodesInsee : Communes uniquement, dédupliqué. */
function extractCommuneCodes(collectivites: Collectivite[]): string[] {
  return [...new Set(collectivites.filter((c) => c.type === "Commune" && c.code_insee).map((c) => c.code_insee!))];
}

// ─── Lecture de l'index territoire dans Redis ────────────────────────────────

interface TerritoryEntry {
  ids: number[];
  storedAt: number;
}

/**
 * Pour chaque code INSEE, lit at:territory:perimeter_codes[]=<code> dans Redis.
 * Retourne l'union des id_at (string) + la liste des territoires absents du cache.
 */
async function readTerritoryIds(redis: Redis, codesInsee: string[]): Promise<{ ids: Set<string>; missing: string[] }> {
  const ids = new Set<string>();
  const missing: string[] = [];

  for (const code of codesInsee) {
    const raw = await redis.get(territoryKey(code));
    if (!raw) {
      missing.push(code);
      continue;
    }
    const entry = JSON.parse(raw) as TerritoryEntry;
    const ageH = ((Date.now() - entry.storedAt) / 3_600_000).toFixed(1);
    console.log(`  ${code} : ${entry.ids.length} aides en cache (âge ${ageH} h)`);
    for (const id of entry.ids) ids.add(String(id));
  }

  return { ids, missing };
}

// ─── Lecture du contenu des aides dans Redis (pour le matching textuel) ──────

interface CachedAide {
  id: number;
  name: string;
  short_title: string | null;
  description: string | null;
  eligibility: string | null;
  project_examples: string | null;
  categories: string[];
}

/** Texte indexable d'une aide — aligné sur AidesTextualMatchingService.aideDocument. */
function aideDocument(aide: CachedAide): string {
  return [
    aide.name,
    aide.short_title ?? "",
    aide.description ?? "",
    aide.eligibility ?? "",
    aide.project_examples ?? "",
    ...(aide.categories ?? []),
  ].join(" ");
}

/** MGET at:aide:{id} → Map<id_at, texte indexable>. Les ids absents sont ignorés. */
async function readAideTexts(redis: Redis, ids: string[]): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  if (ids.length === 0) return texts;
  const values = await redis.mget(...ids.map((id) => `${AIDE_PREFIX}${id}`));
  for (const value of values) {
    if (!value) continue;
    const aide = JSON.parse(value) as CachedAide;
    texts.set(String(aide.id), aideDocument(aide));
  }
  return texts;
}

// ─── Agrégation + affichage ──────────────────────────────────────────────────

function ventilate(
  rows: { classification_scores: ClassificationScores }[],
  axesToShow: Axis[],
  threshold: number,
): void {
  const total = rows.length;

  for (const axis of axesToShow) {
    const counts = new Map<string, { strong: number; any: number }>();
    let aidesWithAxisLabel = 0;

    for (const row of rows) {
      const labels = row.classification_scores?.[axis] ?? [];
      let hasStrong = false;
      const seenStrong = new Set<string>();
      const seenAny = new Set<string>();
      for (const { label, score } of labels) {
        if (typeof label !== "string" || typeof score !== "number") continue;
        const c = counts.get(label) ?? { strong: 0, any: 0 };
        if (!seenAny.has(label)) {
          c.any++;
          seenAny.add(label);
        }
        if (score >= threshold && !seenStrong.has(label)) {
          c.strong++;
          seenStrong.add(label);
          hasStrong = true;
        }
        counts.set(label, c);
      }
      if (hasStrong) aidesWithAxisLabel++;
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1].strong - a[1].strong || b[1].any - a[1].any);
    const emptyCount = sorted.filter(([, c]) => c.strong === 0).length;

    console.log(`─── [${axis}] ${sorted.length} labels distincts ───`);
    console.log(`    ${aidesWithAxisLabel}/${total} aides ont ≥1 label ≥ ${threshold} sur cet axe`);
    console.log(`    (colonne "≥seuil" = aides matchables sur ce label ; "tous" = présence à n'importe quel score)\n`);
    console.log(`     ≥seuil   tous   label`);
    for (const [label, c] of sorted) {
      const flag = c.strong === 0 ? "  ⚠️" : "";
      console.log(`    ${String(c.strong).padStart(6)} ${String(c.any).padStart(6)}   ${label}${flag}`);
    }
    if (emptyCount > 0) {
      console.log(
        `\n    ⚠️  ${emptyCount} label(s) jamais portés par une aide à un score ≥ ${threshold} :\n` +
          `        présents en classification mais inexploitables au matching.`,
      );
    }
    console.log("");
  }
}

/**
 * Complément (mode --projet) : ce que le matching textuel rattrape par rapport
 * à la ventilation par label. Reproduit le mode AIDES_TEXTUAL_MATCHING_ENABLED.
 */
function printTextualComplement(
  projectText: string,
  allIds: Set<string>,
  classifiedIds: Set<string>,
  aideTexts: Map<string, string>,
): void {
  console.log(`─── Complément matching textuel (BM25) ───`);

  if (projectText === "") {
    console.log(`  ⚠️  Projet sans nom ni description — matching textuel inopérant.\n`);
    return;
  }

  const docs = [...allIds].map((id) => ({ id, text: aideTexts.get(id) ?? "" }));
  const missingText = docs.filter((d) => d.text === "").length;

  const textual = bm25Match(projectText, docs);
  const aboveFloor = [...textual.entries()].filter(([, m]) => m.score >= MIN_TEXTUAL_RESCUE);
  const rescuedUnclassified = aboveFloor.filter(([id]) => !classifiedIds.has(id));

  console.log(`  Aides du territoire                       : ${allIds.size}`);
  console.log(`  → classifiées (ventilées ci-dessus)       : ${classifiedIds.size}`);
  console.log(`  → non classifiées                         : ${allIds.size - classifiedIds.size}`);
  if (missingText > 0) {
    console.log(`  → contenu absent du cache Redis           : ${missingText} (non évaluées textuellement)`);
  }
  console.log("");
  console.log(`  Aides avec score textuel ≥ ${MIN_TEXTUAL_RESCUE} (seuil rescue) : ${aboveFloor.length}`);
  console.log(`  → dont NON classifiées                    : ${rescuedUnclassified.length}`);
  console.log(
    `\n  Lecture : les ${rescuedUnclassified.length} aide(s) non classifiées au-dessus du seuil\n` +
      `  sont invisibles à la ventilation par label ci-dessus ET au matching\n` +
      `  thématique, mais seraient rattrapées par le matching textuel — gain net.\n`,
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const thresholdArg = process.argv.find((a) => a.startsWith("--threshold="))?.split("=")[1];
  const threshold = thresholdArg !== undefined ? Number(thresholdArg) : DEFAULT_THRESHOLD;
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error("❌ --threshold doit être un nombre entre 0 et 1");
    process.exit(1);
  }
  const axisArg = process.argv.find((a) => a.startsWith("--axis="))?.split("=")[1] as Axis | undefined;
  if (axisArg && !AXES.includes(axisArg)) {
    console.error(`❌ --axis doit être l'un de : ${AXES.join(", ")}`);
    process.exit(1);
  }
  const axesToShow = axisArg ? [axisArg] : AXES;
  const projetId = process.argv.find((a) => a.startsWith("--projet="))?.split("=")[1];

  const pool = new Pool(buildDbConfig());

  console.log(`\n=== Ventilation des aides par label de classification ===`);
  console.log(`Seuil de comptage : score ≥ ${threshold}`);

  let rows: { classification_scores: ClassificationScores }[];

  // Données du complément textuel (renseignées seulement en mode --projet).
  let textualCtx: {
    projectText: string;
    allIds: Set<string>;
    classifiedIds: Set<string>;
    aideTexts: Map<string, string>;
  } | null = null;

  if (projetId) {
    // ── Mode scopé projet ────────────────────────────────────────────────────
    console.log(`Mode : scopé au territoire du projet ${projetId}\n`);

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.error("❌ REDIS_URL manquant (requis pour le mode --projet)");
      await pool.end();
      process.exit(1);
    }

    const { source, codes, projectText } = await resolveProjet(pool, projetId);
    console.log(`Projet trouvé (source: ${source}). Codes INSEE : ${codes.length ? codes.join(", ") : "(aucun)"}\n`);

    if (codes.length === 0) {
      console.log("⚠️  Aucun code INSEE (projet EPCI-only ?) — impossible de pré-filtrer. Arrêt.");
      await pool.end();
      process.exit(1);
    }

    console.log(`Lecture de l'index territoire dans Redis :`);
    const redis = new Redis(redisUrl);
    const { ids, missing } = await readTerritoryIds(redis, codes);

    if (missing.length > 0) {
      console.log(
        `\n  ⚠️  ${missing.length} territoire(s) absent(s) du cache Redis : ${missing.join(", ")}\n` +
          `      Ces communes n'ont jamais été warmées/interrogées — leurs aides\n` +
          `      ne sont PAS comptées. Lancer GET /aides sur le projet pour peupler.`,
      );
    }
    console.log(`\n  → ${ids.size} aides uniques sur le territoire (union, dédupliqué)\n`);

    if (ids.size === 0) {
      console.log("Aucune aide en cache pour ce territoire. Arrêt.");
      await redis.quit();
      await pool.end();
      return;
    }

    // Contenu des aides (pour le matching textuel) — lu dans Redis avant de fermer.
    const aideTexts = await readAideTexts(redis, [...ids]);
    await redis.quit();

    const res = await pool.query<{ id_at: string; classification_scores: ClassificationScores }>(
      `SELECT id_at, classification_scores FROM public.aide_classifications WHERE id_at = ANY($1)`,
      [[...ids]],
    );
    rows = res.rows;
    const unclassified = ids.size - rows.length;
    console.log(`Aides du territoire avec classification : ${rows.length}/${ids.size}`);
    if (unclassified > 0) {
      console.log(`  (${unclassified} aide(s) du cache Redis sans classification — exclues de la ventilation)`);
    }
    console.log("");

    textualCtx = {
      projectText,
      allIds: ids,
      classifiedIds: new Set(res.rows.map((r) => r.id_at)),
      aideTexts,
    };
  } else {
    // ── Mode global ──────────────────────────────────────────────────────────
    console.log(`Mode : global (tout le catalogue classifié)\n`);
    const res = await pool.query<{ classification_scores: ClassificationScores }>(
      `SELECT classification_scores FROM public.aide_classifications`,
    );
    rows = res.rows;
    console.log(`Source : public.aide_classifications — ${rows.length} aides classifiées\n`);
  }

  if (rows.length === 0) {
    console.log("Aucune aide à ventiler.");
    await pool.end();
    return;
  }

  ventilate(rows, axesToShow, threshold);

  if (textualCtx) {
    printTextualComplement(textualCtx.projectText, textualCtx.allIds, textualCtx.classifiedIds, textualCtx.aideTexts);
  }

  console.log(`=== Fin ===\n`);
  await pool.end();
}

main().catch((err) => {
  console.error("Stats failed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
