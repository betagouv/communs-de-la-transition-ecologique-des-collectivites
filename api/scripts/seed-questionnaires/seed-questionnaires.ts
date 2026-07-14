import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { questionnaires } from "@/database/schema";
import { QUESTIONNAIRES } from "@/questionnaires/content";
import { validerDefinition } from "@/questionnaires/questionnaire-validation";
import { versLigne } from "@/questionnaires/questionnaires.repository";

/**
 * AMORÇAGE des questionnaires : verse en base les définitions du dépôt (content/).
 *
 * Le dépôt reste l'AMORÇAGE, la base devient la SOURCE DE VÉRITÉ — exactement comme le CSV du
 * benchmark DINUM pour le catalogue de services. Une fois amorcé, on édite depuis le back-office,
 * et ce script n'a plus vocation à tourner.
 *
 * IDEMPOTENT, mais NON DESTRUCTIF DES ÉDITIONS : il n'écrase QUE les questionnaires absents de la
 * base. Un questionnaire déjà présent a pu être édité depuis le back-office — le réécrire depuis le
 * dépôt annulerait ce travail sans prévenir. Pour forcer la réécriture : `--force`, en connaissance
 * de cause.
 *
 *   pnpm seed:questionnaires
 *   pnpm seed:questionnaires --force   ← écrase les éditions faites en back-office
 */
async function main() {
  const force = process.argv.includes("--force");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const existants = new Set((await db.select({ slug: questionnaires.slug }).from(questionnaires)).map((l) => l.slug));

  let inseres = 0;
  let ecrases = 0;
  let preserves = 0;

  for (const def of QUESTIONNAIRES) {
    // La MÊME validation qu'à l'écriture depuis le back-office. Un questionnaire du dépôt n'a
    // aucun privilège : s'il est incohérent, il ne doit pas entrer en base non plus.
    validerDefinition(def);

    if (existants.has(def.slug) && !force) {
      preserves++;
      console.log(`  ○ ${def.slug} — déjà en base, préservé (édité en back-office ?)`);
      continue;
    }

    const valeurs = versLigne(def, "amorçage (content/)");

    await db.insert(questionnaires).values(valeurs).onConflictDoUpdate({
      target: questionnaires.slug,
      set: valeurs,
    });

    if (existants.has(def.slug)) {
      ecrases++;
      console.log(`  ⚠ ${def.slug} — ÉCRASÉ depuis le dépôt (--force)`);
    } else {
      inseres++;
      console.log(`  ✓ ${def.slug} — inséré`);
    }
  }

  console.log();
  console.log(`${inseres} inséré(s), ${ecrases} écrasé(s), ${preserves} préservé(s).`);
  if (preserves > 0) {
    console.log("Les questionnaires préservés vivent leur vie en base. `--force` les ramènerait au dépôt.");
  }

  await pool.end();
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});
