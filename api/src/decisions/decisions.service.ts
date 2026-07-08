import { BadRequestException, Injectable } from "@nestjs/common";
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
    if (dto.supersedes) {
      await this.assertSupersedesCompatible(dto.supersedes, dto.typeDecision, plateformeSource);
    }

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
   * Une révision (`supersedes`) ne peut désactiver qu'une décision COMPATIBLE : même
   * plateforme émettrice (cloisonnement — on ne révoque pas la décision d'un autre
   * service) ET même `typeDecision`. Sans ce garde-fou, une décision anodine
   * (ex. correction_signalee) pourrait désactiver silencieusement un verrou dur d'une
   * autre plateforme (ex. doublon_infirme), car le prédicat « décision active » est
   * type-agnostique. 400 explicite sinon.
   */
  private async assertSupersedesCompatible(
    supersedesId: string,
    typeDecision: string,
    plateformeSource: string,
  ): Promise<void> {
    const [target] = await this.dbService.database
      .select({ plateformeSource: decisions.plateformeSource, typeDecision: decisions.typeDecision })
      .from(decisions)
      .where(eq(decisions.id, supersedesId))
      .limit(1);

    if (!target) {
      throw new BadRequestException(`supersedes : décision cible ${supersedesId} introuvable`);
    }
    if (target.plateformeSource !== plateformeSource) {
      throw new BadRequestException(
        "supersedes : une décision ne peut réviser que les décisions de sa propre plateforme",
      );
    }
    if (target.typeDecision !== typeDecision) {
      throw new BadRequestException(
        `supersedes : type incompatible (cible « ${target.typeDecision} », révision « ${typeDecision} ») — ` +
          "une révision doit être du même type que la décision révoquée",
      );
    }
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
