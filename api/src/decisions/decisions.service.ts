import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { decisions } from "@database/schema";
import { and, desc, eq, or, SQL } from "drizzle-orm";
import { CreateDecisionDto, DecisionCreatedResponse } from "./dto/create-decision.dto";
import { validateDecisionContract } from "./decision-contract";

// Journal append-only des décisions humaines (schema decisions_humaines).
// Aucune méthode UPDATE/DELETE : une révocation est un nouvel événement
// référençant l'ancien via `supersedes` (invariant applicatif).
@Injectable()
export class DecisionsService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Enregistre une décision. `plateformeSource` est DÉRIVÉE du service authentifié
   * (request.serviceType), jamais du corps de requête : un service ne peut pas se
   * faire passer pour un autre. Les contraintes croisées propres au type (objetB,
   * verdict, payload) sont validées ici — 400 explicite en cas d'écart.
   */
  async create(dto: CreateDecisionDto, plateformeSource: string): Promise<DecisionCreatedResponse> {
    validateDecisionContract(dto);

    const [row] = await this.dbService.database
      .insert(decisions)
      .values({
        typeDecision: dto.typeDecision,
        objetAType: dto.objetAType,
        objetAId: dto.objetAId,
        objetBType: dto.objetBType ?? null,
        objetBId: dto.objetBId ?? null,
        verdict: dto.verdict ?? null,
        auteur: dto.auteur ?? null,
        plateformeSource,
        commentaire: dto.commentaire ?? null,
        payload: dto.payload ?? null,
        supersedes: dto.supersedes ?? null,
      })
      .returning({ id: decisions.id, createdAt: decisions.createdAt });

    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  /**
   * Décisions filtrées par objet (référencé en A ou en B) ET/OU par type. Tri
   * anté-chronologique, bornée à 100 — vérification/audit, pas de pagination.
   * Cloisonnement : chaque plateforme ne lit QUE ses propres décisions
   * (plateformeSource = service authentifié). Au moins un des deux filtres
   * (objetId, type) est garanti fourni par le contrôleur.
   */
  async find(filters: { objetId?: string; type?: string }, plateformeSource: string) {
    const conditions: SQL[] = [eq(decisions.plateformeSource, plateformeSource)];
    if (filters.objetId) {
      conditions.push(or(eq(decisions.objetAId, filters.objetId), eq(decisions.objetBId, filters.objetId))!);
    }
    if (filters.type) {
      conditions.push(eq(decisions.typeDecision, filters.type));
    }

    const rows = await this.dbService.database
      .select()
      .from(decisions)
      .where(and(...conditions))
      .orderBy(desc(decisions.createdAt))
      .limit(100);

    return { items: rows };
  }
}
