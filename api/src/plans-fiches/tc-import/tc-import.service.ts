// Service to import TC opendata into plans_transition and fiches_action tables.
// Uses upsert (ON CONFLICT DO UPDATE) for idempotent reimport.

import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { sql } from "drizzle-orm";
import { plansTransition, fichesAction, fichesActionToPlansTransition } from "@database/schema";
import { refPerimetres } from "@database/referentiel-schema";
import { CustomLogger } from "@logging/logger.service";
import type { ParsedPlan, ParsedFicheAction, ImportStats } from "./tc-import.types";

@Injectable()
export class TcImportService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async importAll(plans: ParsedPlan[], fiches: ParsedFicheAction[]): Promise<ImportStats> {
    const db = this.dbService.database;
    const stats: ImportStats = {
      plansInserted: 0,
      plansUpdated: 0,
      fichesInserted: 0,
      fichesUpdated: 0,
      linksCreated: 0,
      fichesEnriched: 0,
      communesResolved: 0,
    };

    // 1. Resolve SIREN -> codes INSEE communes via ref_perimetres
    this.logger.log("Resolving SIREN -> communes...");
    const sirenSet = new Set<string>();
    for (const p of plans) {
      if (p.collectiviteResponsableSiren) sirenSet.add(p.collectiviteResponsableSiren);
    }
    for (const f of fiches) {
      if (f.collectiviteResponsableSiren) sirenSet.add(f.collectiviteResponsableSiren);
    }

    const sirenToCommunes = await this.resolveSirenToCommunes([...sirenSet]);
    this.logger.log(`Resolved ${sirenToCommunes.size}/${sirenSet.size} SIRENs to commune codes`);
    stats.communesResolved = sirenToCommunes.size;

    // Apply communes to plans and fiches
    for (const p of plans) {
      if (p.collectiviteResponsableSiren) {
        p.territoireCommunes = sirenToCommunes.get(p.collectiviteResponsableSiren) ?? null;
      }
    }
    for (const f of fiches) {
      if (f.collectiviteResponsableSiren) {
        f.territoireCommunes = sirenToCommunes.get(f.collectiviteResponsableSiren) ?? null;
      }
    }

    // 2. Upsert plans
    this.logger.log(`Upserting ${plans.length} plans...`);
    const planIdByDemarcheId = new Map<number, string>();

    for (let i = 0; i < plans.length; i += 500) {
      const batch = plans.slice(i, i + 500);
      for (const plan of batch) {
        const [result] = await db
          .insert(plansTransition)
          .values(plan)
          .onConflictDoUpdate({
            target: plansTransition.tcDemarcheId,
            set: {
              nom: sql`excluded.nom`,
              type: sql`excluded.type`,
              description: sql`excluded.description`,
              periodeDebut: sql`excluded.periode_debut`,
              periodeFin: sql`excluded.periode_fin`,
              collectiviteResponsableSiren: sql`excluded.collectivite_responsable_siren`,
              territoireCommunes: sql`excluded.territoire_communes`,
              tcVersion: sql`excluded.tc_version`,
              tcEtat: sql`excluded.tc_etat`,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: plansTransition.id,
            createdAt: plansTransition.createdAt,
            updatedAt: plansTransition.updatedAt,
          });

        planIdByDemarcheId.set(plan.tcDemarcheId, result.id);
        const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;
        if (isNew) stats.plansInserted++;
        else stats.plansUpdated++;
      }
      this.logger.debug(`Plans: ${Math.min(i + 500, plans.length)}/${plans.length}`);
    }

    // 3. Upsert fiches action
    this.logger.log(`Upserting ${fiches.length} fiches action...`);
    const ficheIdByHash = new Map<string, string>();

    for (let i = 0; i < fiches.length; i += 1000) {
      const batch = fiches.slice(i, i + 1000);
      for (const fiche of batch) {
        const [result] = await db
          .insert(fichesAction)
          .values(fiche)
          .onConflictDoUpdate({
            target: fichesAction.tcHash,
            set: {
              nom: sql`excluded.nom`,
              description: sql`excluded.description`,
              collectiviteResponsableSiren: sql`excluded.collectivite_responsable_siren`,
              territoireCommunes: sql`excluded.territoire_communes`,
              tcDemarcheId: sql`excluded.tc_demarche_id`,
              tcSecteurs: sql`excluded.tc_secteurs`,
              tcTypesPorteur: sql`excluded.tc_types_porteur`,
              tcVolets: sql`excluded.tc_volets`,
              tcTypeAction: sql`excluded.tc_type_action`,
              tcCibleAction: sql`excluded.tc_cible_action`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: fichesAction.id, createdAt: fichesAction.createdAt, updatedAt: fichesAction.updatedAt });

        ficheIdByHash.set(fiche.tcHash, result.id);
        const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;
        if (isNew) stats.fichesInserted++;
        else stats.fichesUpdated++;
      }
      if ((i + 1000) % 5000 < 1000) {
        this.logger.debug(`Fiches: ${Math.min(i + 1000, fiches.length)}/${fiches.length}`);
      }
    }
    this.logger.debug(`Fiches: ${fiches.length}/${fiches.length}`);

    // 4. Create N:N links (fiche_action <-> plan_transition)
    this.logger.log("Creating fiche<->plan links...");
    for (const fiche of fiches) {
      const ficheId = ficheIdByHash.get(fiche.tcHash);
      const planId = planIdByDemarcheId.get(fiche.tcDemarcheId);
      if (!ficheId || !planId) continue;

      await db
        .insert(fichesActionToPlansTransition)
        .values({ ficheActionId: ficheId, planTransitionId: planId })
        .onConflictDoNothing();
      stats.linksCreated++;
    }
    this.logger.log(`${stats.linksCreated} links created/confirmed`);

    return stats;
  }

  /**
   * Resolve SIREN groupements to their member commune INSEE codes
   * using the ref_perimetres table (seeded from Banatic).
   */
  private async resolveSirenToCommunes(sirens: string[]): Promise<Map<string, string[]>> {
    if (sirens.length === 0) return new Map();

    const db = this.dbService.database;
    const result = new Map<string, string[]>();

    // Query in batches to avoid huge IN clause
    for (let i = 0; i < sirens.length; i += 200) {
      const batch = sirens.slice(i, i + 200);
      const rows = await db
        .select({
          siren: refPerimetres.sirenGroupement,
          codeInsee: refPerimetres.codeInseeCommune,
        })
        .from(refPerimetres)
        .where(
          sql`${refPerimetres.sirenGroupement} IN (${sql.join(
            batch.map((s) => sql`${s}`),
            sql`, `,
          )})`,
        );

      for (const row of rows) {
        const existing = result.get(row.siren);
        if (existing) {
          existing.push(row.codeInsee);
        } else {
          result.set(row.siren, [row.codeInsee]);
        }
      }
    }

    return result;
  }
}
