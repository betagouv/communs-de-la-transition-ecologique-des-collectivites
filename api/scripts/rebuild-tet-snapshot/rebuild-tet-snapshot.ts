// Reconstruit snapshot_tet_api.plans depuis l'API tRPC publique de TeT, en résolvant
// le SIREN du porteur (absent de l'API TeT) via api_referentiel + overrides audités.
// Ce schéma n'est alimenté par aucun autre process : ce script en est la seule source.
//
// Usage : TET_AUTH_COOKIE='sb-...-auth-token=base64-...' pnpm rebuild:tet-snapshot
// Le cookie de session TeT n'est jamais commité ; il est lu dans l'environnement.
// One-shot pour l'instant (jeton perso) ; à terme, un jeton de service TeT.

import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "path";
import { sql } from "drizzle-orm";
import { currentEnv } from "@/shared/utils/currentEnv";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { refCommunes, refGroupements, snapshotTetPlans } from "@database/schema";
import { buildResolver, RefEntry } from "./resolution";

const TET_TRPC = "https://api.territoiresentransitions.fr/trpc/collectivites.recherches.plans";
const PAGE_SIZE = 100;

interface TetPlan {
  collectiviteId: number;
  collectiviteNom: string | null;
  planId: number;
  planNom: string | null;
  planType: string | null;
  contacts: unknown;
}

function buildInput(page: number): string {
  const input = {
    nom: "",
    typesPlan: [] as number[], // tous types (on reconstruit l'intégralité du snapshot)
    typesCollectivite: [],
    regions: [],
    departments: [],
    population: [],
    referentiel: [],
    niveauDeLabellisation: [],
    realiseCourant: [],
    tauxDeRemplissage: [],
    trierPar: ["nom"],
    page,
    nbCards: PAGE_SIZE,
  };
  return encodeURIComponent(JSON.stringify(input));
}

async function fetchAllPlans(cookie: string): Promise<TetPlan[]> {
  const headers = {
    Cookie: cookie,
    Accept: "*/*",
    Referer: "https://app.territoiresentransitions.fr/",
    Origin: "https://app.territoiresentransitions.fr",
    "User-Agent": "communs-rebuild-tet-snapshot",
  };
  const all: TetPlan[] = [];
  let page = 1;
  let count = Infinity;
  while (all.length < count) {
    const res = await fetch(`${TET_TRPC}?input=${buildInput(page)}`, { headers });
    if (!res.ok) throw new Error(`TeT recherches.plans HTTP ${res.status} (page ${page})`);
    const body = (await res.json()) as { result: { data: { count: number; items: TetPlan[] } } };
    const data = body.result.data;
    count = data.count;
    if (data.items.length === 0) break;
    all.push(...data.items);
    console.log(`  page ${page}: +${data.items.length} (${all.length}/${count})`);
    page += 1;
  }
  // Dédup par planId (la pagination peut se recouvrir si le tri bouge).
  const byId = new Map<number, TetPlan>();
  for (const p of all) byId.set(p.planId, p);
  return [...byId.values()];
}

async function main() {
  const cookie = process.env.TET_AUTH_COOKIE;
  if (!cookie) {
    console.error("TET_AUTH_COOKIE manquant (cookie de session TeT). Abandon.");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(RebuildModule);
  const db = app.get(DatabaseService).database;

  try {
    console.log("=== Reconstruction snapshot_tet_api.plans (avec résolution SIREN) ===\n");
    const startTime = Date.now();

    console.log("1. Récupération des plans TeT…");
    const plans = await fetchAllPlans(cookie);
    console.log(`   ${plans.length} plans uniques.\n`);

    console.log("2. Chargement du référentiel…");
    const grp: RefEntry[] = (
      await db.select({ siren: refGroupements.siren, nom: refGroupements.nom }).from(refGroupements)
    ).map((r) => ({ siren: r.siren, nom: r.nom }));
    const com: RefEntry[] = (await db.select({ siren: refCommunes.siren, nom: refCommunes.nom }).from(refCommunes)).map(
      (r) => ({ siren: r.siren, nom: r.nom }),
    );
    console.log(`   ${grp.length} groupements, ${com.length} communes.\n`);

    console.log("3. Résolution SIREN + upsert…");
    const resolver = buildResolver(grp, com);
    const now = new Date();
    const stats: Record<string, number> = {};
    let resolved = 0;

    const rows = plans.map((p) => {
      const r = resolver.resolve(p.collectiviteId, p.collectiviteNom);
      const source = r?.source ?? "unresolved";
      stats[source] = (stats[source] ?? 0) + 1;
      if (r) resolved += 1;
      return {
        planId: p.planId,
        planNom: p.planNom,
        planType: p.planType,
        collectiviteId: p.collectiviteId,
        collectiviteNom: p.collectiviteNom,
        contacts: p.contacts as object | null,
        siren: r?.siren ?? null,
        sirenSource: r ? source : null,
        sirenResolvedAt: r ? now : null,
        fetchedAt: now,
      };
    });

    // Upsert par lot (PK = plan_id) : rafraîchit l'existant, insère le nouveau.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      await db
        .insert(snapshotTetPlans)
        .values(batch)
        .onConflictDoUpdate({
          target: snapshotTetPlans.planId,
          set: {
            planNom: sql`excluded.plan_nom`,
            planType: sql`excluded.plan_type`,
            collectiviteId: sql`excluded.collectivite_id`,
            collectiviteNom: sql`excluded.collectivite_nom`,
            contacts: sql`excluded.contacts`,
            siren: sql`excluded.siren`,
            sirenSource: sql`excluded.siren_source`,
            sirenResolvedAt: sql`excluded.siren_resolved_at`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        });
    }

    const pcaet = rows.filter((r) => r.planType === "Plan Climat Air Énergie Territorial");
    const pcaetResolved = pcaet.filter((r) => r.siren).length;

    console.log("\n=== Terminé ===");
    console.log(`Plans upsertés : ${rows.length}`);
    console.log(`SIREN résolus : ${resolved}/${rows.length} (${Math.round((100 * resolved) / rows.length)}%)`);
    console.log(`  dont PCAET : ${pcaetResolved}/${pcaet.length}`);
    console.log(`Par méthode : ${JSON.stringify(stats)}`);
    console.log(`Durée : ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error("Reconstruction échouée :", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

@Module({
  imports: [ConfigModule.forRoot({ envFilePath: join(__dirname, `../../.env.${currentEnv}`) })],
  providers: [DatabaseService, CustomLogger],
})
class RebuildModule {}

void main();
