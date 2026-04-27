import { Injectable } from "@nestjs/common";
import { eq, and, sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { dispositifsTerritoriaux, refGroupements } from "@database/schema";
import { DispositifQueryDto } from "./dto/dispositif-query.dto";
import { DispositifResponse, DispositifStatsResponse, DispositifsDataResponse } from "./dto/dispositif.response";

@Injectable()
export class DispositifsService {
  constructor(private readonly dbService: DatabaseService) {}

  async search(query: DispositifQueryDto): Promise<DispositifResponse[]> {
    const conditions = [];
    if (query.type) {
      conditions.push(eq(dispositifsTerritoriaux.dispositif, query.type));
    }
    if (query.statut) {
      conditions.push(eq(dispositifsTerritoriaux.statut, query.statut));
    }
    if (query.epciSiren) {
      conditions.push(eq(dispositifsTerritoriaux.epciSiren, query.epciSiren));
    }

    const rows = await this.dbService.database
      .select({
        epciSiren: dispositifsTerritoriaux.epciSiren,
        dispositif: dispositifsTerritoriaux.dispositif,
        dateSignature: dispositifsTerritoriaux.dateSignature,
        statut: dispositifsTerritoriaux.statut,
        crteCode: dispositifsTerritoriaux.crteCode,
        metadata: dispositifsTerritoriaux.metadata,
        epciNomRef: refGroupements.nom,
      })
      .from(dispositifsTerritoriaux)
      .leftJoin(refGroupements, eq(refGroupements.siren, dispositifsTerritoriaux.epciSiren))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(dispositifsTerritoriaux.dispositif, dispositifsTerritoriaux.epciSiren);

    return rows.map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, string | undefined>;
      return {
        epciSiren: r.epciSiren,
        epciNom: r.epciNomRef ?? meta.epci_nom ?? "",
        dispositif: r.dispositif,
        dateSignature: r.dateSignature,
        statut: r.statut ?? "",
        crteCode: r.crteCode ?? null,
        crteNom: meta.crte_nom ?? null,
        region: meta.region ?? null,
      };
    });
  }

  async getAll(): Promise<DispositifsDataResponse> {
    const dispositifs = await this.search({});

    // Compute stats per type
    const byType = new Map<string, DispositifResponse[]>();
    for (const d of dispositifs) {
      if (!byType.has(d.dispositif)) byType.set(d.dispositif, []);
      byType.get(d.dispositif)!.push(d);
    }

    const stats: Record<string, DispositifStatsResponse> = {};
    for (const [type, items] of byType) {
      const parStatut: Record<string, number> = {};
      for (const i of items) {
        parStatut[i.statut] = (parStatut[i.statut] ?? 0) + 1;
      }

      const epciSirens = items.map((i) => i.epciSiren);
      const countResult = await this.dbService.database.execute(
        sql`SELECT
          COUNT(*) FILTER (WHERE source_origine = 'MEC') as nb_mec,
          COUNT(*) as nb_all
        FROM schema_commun_v2.projets_operationnels
        WHERE "collectiviteResponsableSiren" = ANY(${epciSirens})`,
      );
      const row = countResult.rows[0] as { nb_mec: string; nb_all: string } | undefined;

      stats[type] = {
        totalEpci: items.length,
        nbProjetsMec: Number(row?.nb_mec ?? 0),
        nbProjetsToutesSources: Number(row?.nb_all ?? 0),
        parStatut,
      };
    }

    return { dispositifs, stats };
  }
}
