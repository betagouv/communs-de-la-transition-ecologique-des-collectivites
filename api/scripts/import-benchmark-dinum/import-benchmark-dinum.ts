import { join } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { servicesNumeriques } from "@database/schema";
import { currentEnv } from "@/shared/utils/currentEnv";
import { parserLigne, type ServiceImporte } from "./parse-benchmark";
import { lireBenchmark } from "./lire-csv";

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

function resumer(services: ServiceImporte[]): void {
  // Il n'y a plus de verrou de curation : le score seul décide. Ce qui compte donc, c'est
  // combien de services sont MATCHABLES (une thématique) ou remontent en fallback générique.
  const matchables = services.filter((s) => s.classification.thematiques.length > 0);
  const generiques = services.filter((s) => s.presentationGenerique === "oui");
  const muets = services.filter((s) => s.classification.thematiques.length === 0 && s.presentationGenerique !== "oui");
  const generalistes = services.filter((s) => s.profilGeneraliste === "oui");

  console.log(`\n${services.length} services lus`);
  console.log(`${matchables.length} matchables (au moins une thématique)`);
  console.log(`${generiques.length} remontent en fallback générique`);
  console.log(`${generalistes.length} marqués « profil généraliste » (propriété exposée, filtrable par le client)`);

  if (muets.length > 0) {
    // Ni thématique, ni fallback : ces lignes du benchmark ne sont pas renseignées. Elles ne
    // remonteront JAMAIS. Ce n'est pas un bug de code, c'est un trou dans les données — et il
    // ne doit pas passer inaperçu.
    console.log(`\n⚠ ${muets.length} services ne remonteront jamais (ni thématique, ni présentation générique).`);
    console.log(`  Ce sont des lignes non renseignées du benchmark, pas un défaut de l'API.`);
  }
}

async function importer(): Promise<void> {
  const chemin = join(__dirname, "benchmark-dinum.csv");
  const lignes = lireBenchmark(chemin);

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
