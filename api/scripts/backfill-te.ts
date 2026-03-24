import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import * as schema from "../src/database/schema";
import { TE_PROBABILITIES } from "../src/projet-qualification/classification/const/probabilites-te";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const projets = await db
    .select({ id: schema.projets.id, scores: schema.projets.classificationScores })
    .from(schema.projets)
    .where(sql`classification_scores IS NOT NULL AND probabilite_te IS NULL`);

  console.log(`Found ${projets.length} projects to update`);

  let updated = 0;
  for (const p of projets) {
    if (!p.scores?.thematiques?.length) continue;

    let weightedSum = 0;
    let totalWeight = 0;
    for (const { label, score } of p.scores.thematiques) {
      const teProb = TE_PROBABILITIES[label];
      if (teProb !== undefined) {
        weightedSum += score * teProb;
        totalWeight += score;
      }
    }

    if (totalWeight === 0) continue;
    const te = Math.round((weightedSum / totalWeight) * 100) / 100;

    await db
      .update(schema.projets)
      .set({ probabiliteTE: String(te) })
      .where(eq(schema.projets.id, p.id));

    updated++;
    if (updated % 1000 === 0) console.log(`  Updated ${updated}...`);
  }

  console.log(`Done: ${updated} projects updated with probabiliteTE`);
  await pool.end();
}

main().catch(console.error);
