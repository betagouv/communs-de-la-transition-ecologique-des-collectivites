import fs from "fs";
import { join } from "path";
import { parse } from "csv-parse";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { servicesNumeriques } from "@database/schema";
import { currentEnv } from "@/shared/utils/currentEnv";
import { parserLigne, type ServiceImporte } from "./parse-benchmark";

dotenv.config({ path: `.env.${currentEnv}` });

/**
 * Importe le benchmark DINUM « API Projets » dans public.services_numeriques.
 *
 * Ré-exécutable : upsert sur `slug`. Le fichier est en CP1252 (export Excel français) et
 * séparé par des points-virgules — pas de la mauvaise volonté, juste la réalité.
 *
 * L'import ÉCHOUE si une étiquette de taxonomie est inconnue et non déclarée dans
 * alias-taxonomie.ts (cf. resoudreEtiquette). C'est délibéré : un libellé silencieusement
 * ignoré, c'est un critère de matching perdu et un service qui ne remonte plus, sans témoin.
 */
async function lireCsv(chemin: string): Promise<Record<string, string>[]> {
  // CP1252 : décodé explicitement, sinon les accents cassent (0xe9 n'est pas de l'UTF-8).
  const contenu = fs.readFileSync(chemin);
  const texte = new TextDecoder("windows-1252").decode(contenu);

  return new Promise((resolve, reject) => {
    parse(texte, { columns: true, delimiter: ";", relax_quotes: true, skip_empty_lines: true }, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as Record<string, string>[]);
    });
  });
}

function resumer(services: ServiceImporte[]): void {
  const cures = services.filter((s) => s.aIntegrerMec === "oui");
  const generiques = cures.filter((s) => s.presentationGenerique === "oui");
  const sansThematique = cures.filter((s) => s.classification.thematiques.length === 0);

  console.log(`\n${services.length} services lus`);
  console.log(`${cures.length} curés (A intégrer MEC = oui) — seuls ceux-là seront proposés`);
  console.log(`${generiques.length} d'entre eux remontent en fallback générique`);

  if (sansThematique.length > 0) {
    // Sans thématique fine, le score est nul : ces services ne remontent QUE par le fallback
    // générique. Ceux qui n'en bénéficient pas seraient invisibles — on le dit.
    const invisibles = sansThematique.filter((s) => s.presentationGenerique !== "oui");
    console.log(`\n⚠ ${sansThematique.length} services curés sans aucune thématique fine (score toujours nul).`);
    if (invisibles.length > 0) {
      console.log(`  Dont ${invisibles.length} SANS fallback générique — ils ne seront jamais affichés :`);
      for (const s of invisibles) console.log(`    - ${s.nom}`);
    }
  }
}

async function importer(): Promise<void> {
  const chemin = join(__dirname, "benchmark-dinum.csv");
  const lignes = await lireCsv(chemin);

  const services = lignes
    .map((ligne, i) => {
      try {
        return parserLigne(ligne);
      } catch (e) {
        throw new Error(`Ligne ${i + 2} (${ligne["Nom du service"]}) : ${(e as Error).message}`);
      }
    })
    .filter((s): s is ServiceImporte => s !== null);

  resumer(services);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    for (const service of services) {
      await db
        .insert(servicesNumeriques)
        .values(service)
        .onConflictDoUpdate({ target: servicesNumeriques.slug, set: { ...service, updatedAt: new Date() } });
    }
    console.log(`\n✅ ${services.length} services importés dans public.services_numeriques`);
  } finally {
    await pool.end();
  }
}

importer().catch((e) => {
  console.error(`\n❌ Import interrompu : ${(e as Error).message}`);
  process.exit(1);
});
