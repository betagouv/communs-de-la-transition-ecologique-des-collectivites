import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { decisions } from "@database/schema";
import { desc, eq, or } from "drizzle-orm";
import { CreateDecisionDto, DecisionCreatedResponse } from "./dto/create-decision.dto";

// Journal append-only des décisions humaines (schema decisions_humaines).
// Aucune méthode UPDATE/DELETE : une révocation est un nouvel événement
// référençant l'ancien via superseded_by (invariant applicatif).
@Injectable()
export class DecisionsService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Enregistre une décision. `plateformeSource` est DÉRIVÉE du service authentifié
   * (request.serviceType), jamais du corps de requête : un service ne peut pas se
   * faire passer pour un autre.
   */
  async create(dto: CreateDecisionDto, plateformeSource: string): Promise<DecisionCreatedResponse> {
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
      })
      .returning({ id: decisions.id, createdAt: decisions.createdAt });

    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }

  /**
   * Décisions référençant un objet, en A ou en B. Tri anté-chronologique,
   * bornée à 100 — vérification/audit d'un objet, pas de pagination.
   */
  async findByObjet(objetId: string) {
    const rows = await this.dbService.database
      .select()
      .from(decisions)
      .where(or(eq(decisions.objetAId, objetId), eq(decisions.objetBId, objetId)))
      .orderBy(desc(decisions.createdAt))
      .limit(100);

    return { items: rows };
  }
}
