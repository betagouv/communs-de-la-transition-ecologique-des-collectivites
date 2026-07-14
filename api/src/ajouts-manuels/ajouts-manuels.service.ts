import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { decisions, servicesNumeriques } from "@database/schema";
import { activeDecisionPredicate, notTombstonePredicate } from "@/decisions/active-decisions";
import { ANNULE_VERDICT } from "@/decisions/decision-contract";
import { DecisionsService } from "@/decisions/decisions.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AidesPerimetreService } from "@/aides/aides-perimetre.service";
import { TYPE_AJOUT, type AjoutManuel, type ObjetAjoutable, type PayloadAjout } from "./ajout-manuel-contract";
import { AjoutAideRequest, AjoutServiceRequest } from "./dto/ajout-manuel.dto";

const ALIAS = "decisions";

/**
 * Ajouts manuels d'aides et de services numériques sur un projet.
 *
 * Ce service N'ÉCRIT PAS EN BASE lui-même : il délègue à `DecisionsService`, qui porte déjà les
 * invariants du journal (append-only, plateforme dérivée de la clé, compatibilité de `supersedes`).
 * Écrire directement dans la table aurait contourné ces garde-fous — et il aurait fallu les
 * réimplémenter à l'identique, donc les laisser diverger.
 */
@Injectable()
export class AjoutsManuelsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly decisionsService: DecisionsService,
    private readonly getProjetsService: GetProjetsService,
    private readonly perimetreService: AidesPerimetreService,
  ) {}

  /**
   * `findOneWithSource` d'abord : ajouter une aide à un projet inexistant doit être un 404, pas
   * une décision orpheline dans le journal. Le journal ne référence pas ses objets par clé
   * étrangère (ils vivent dans plusieurs schémas), donc rien ne l'empêcherait sans cette garde.
   */
  async ajouterAide(projetId: string, dto: AjoutAideRequest, plateforme: string): Promise<{ decisionId: string }> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);

    // LA GARDE QUI COMPTE. Une aide n'est résolue qu'à travers les aides du périmètre du projet —
    // Aides-territoires ne sait pas la récupérer par son id. Accepter une aide hors périmètre
    // créerait donc un ajout que la lecture ne saurait JAMAIS résoudre : invisible, sans le moindre
    // message. Une panne parfaitement silencieuse. On refuse à l'écriture, là où on peut encore
    // l'expliquer.
    const codesInsee = this.perimetreService.extractCodesInsee(projet.collectivites);
    const aides = await this.perimetreService.fetchAidesForPerimeterCodes(codesInsee);

    if (!aides.some((a) => a.id === dto.aideId)) {
      throw new BadRequestException(
        `L'aide ${dto.aideId} n'est pas disponible sur le territoire de ce projet. Elle ne pourrait ` +
          `pas être affichée : une aide n'est résolue que parmi celles du périmètre du projet.`,
      );
    }

    return this.enregistrer(projetId, "aide", String(dto.aideId), dto.message, dto.auteur, plateforme);
  }

  /**
   * Deux façons d'ajouter un service, et exactement une des deux.
   *
   * `slug` — le service est AU CATALOGUE. On ne recopie rien : sa fiche reste la source de vérité,
   * et elle continuera d'évoluer (logo, description, lien). La figer ici l'aurait dédoublée, et les
   * deux copies auraient divergé. Le slug doit exister (404 sinon) : un slug inconnu produirait un
   * ajout qu'aucune lecture ne saurait résoudre — invisible, donc un bug silencieux.
   *
   * `service` — il n'y est PAS : un outil local, un service partenaire pas encore benchmarké.
   * L'agent le décrit lui-même, et c'est lui la source. On le fige donc dans le payload : il n'y a
   * aucune autorité extérieure à tenir en phase, contrairement à une aide.
   *
   * L'identifiant d'un service libre est un UUID : il n'a pas de slug, et en dériver un de son nom
   * exposerait à des collisions entre deux services homonymes du même projet.
   */
  async ajouterService(
    projetId: string,
    dto: AjoutServiceRequest,
    plateforme: string,
  ): Promise<{ decisionId: string }> {
    await this.getProjetsService.findOneWithSource(projetId);

    // class-validator garantit « au moins un des deux » ; « pas les deux » se dit ici, où on peut
    // l'expliquer. Choisir en silence lequel afficher serait pire que refuser.
    if (dto.slug !== undefined && dto.service !== undefined) {
      throw new BadRequestException(
        "Fournissez `slug` (service du catalogue) OU `service` (service hors catalogue), pas les deux.",
      );
    }

    if (dto.slug !== undefined) {
      const [service] = await this.dbService.database
        .select({ slug: servicesNumeriques.slug })
        .from(servicesNumeriques)
        .where(eq(servicesNumeriques.slug, dto.slug))
        .limit(1);

      if (!service) {
        throw new NotFoundException(
          `Service numérique "${dto.slug}" inconnu du catalogue. S'il n'y figure pas, décrivez-le ` +
            `via le champ \`service\` plutôt que par un slug.`,
        );
      }

      return this.enregistrer(projetId, "service_numerique", dto.slug, dto.message, dto.auteur, plateforme);
    }

    return this.enregistrer(projetId, "service_numerique", randomUUID(), dto.message, dto.auteur, plateforme, {
      service: dto.service,
    });
  }

  private async enregistrer(
    projetId: string,
    objetBType: ObjetAjoutable,
    objetBId: string,
    message: string | undefined,
    auteur: string | undefined,
    plateforme: string,
    payload?: PayloadAjout,
  ): Promise<{ decisionId: string }> {
    const { id } = await this.decisionsService.create(
      {
        typeDecision: TYPE_AJOUT,
        objetAType: "projet",
        objetAId: projetId,
        objetBType,
        objetBId,
        // Le message vit dans `commentaire`, le champ que toute décision porte déjà. Le dupliquer
        // dans le payload aurait créé deux endroits où écrire la même chose.
        commentaire: message,
        auteur,
        payload: payload as Record<string, unknown> | undefined,
      },
      plateforme,
    );

    return { decisionId: id };
  }

  /**
   * Retirer un ajout = RÉVOQUER la décision (verdict='annule' + supersedes).
   *
   * Pas de DELETE, pas de verdict « retire » : le journal est append-only, et la révocation
   * universelle existe déjà. `DecisionsService` vérifie que la cible appartient bien à la même
   * plateforme — une plateforme ne peut pas défaire l'ajout d'une autre.
   */
  async retirer(decisionId: string, plateforme: string): Promise<{ decisionId: string }> {
    const cible = await this.chargerAjout(decisionId, plateforme);

    const { id } = await this.decisionsService.create(
      {
        typeDecision: TYPE_AJOUT,
        objetAType: "projet",
        objetAId: cible.objetAId,
        objetBType: cible.objetBType,
        objetBId: cible.objetBId,
        verdict: ANNULE_VERDICT,
        supersedes: decisionId,
      },
      plateforme,
    );

    return { decisionId: id };
  }

  /** 404 plutôt qu'un 400 obscur venant de `assertSupersedesCompatible` sur un id inconnu. */
  private async chargerAjout(
    decisionId: string,
    plateforme: string,
  ): Promise<{ objetAId: string; objetBType: ObjetAjoutable; objetBId: string }> {
    const [row] = await this.dbService.database
      .select({
        objetAId: decisions.objetAId,
        objetBType: decisions.objetBType,
        objetBId: decisions.objetBId,
      })
      .from(decisions)
      .where(
        and(
          eq(decisions.id, decisionId),
          eq(decisions.typeDecision, TYPE_AJOUT),
          eq(decisions.plateformeSource, plateforme),
        ),
      )
      .limit(1);

    if (!row?.objetBType || !row.objetBId) {
      throw new NotFoundException(`Ajout manuel "${decisionId}" inconnu.`);
    }
    return { objetAId: row.objetAId, objetBType: row.objetBType as ObjetAjoutable, objetBId: row.objetBId };
  }

  /**
   * Les ajouts actifs d'un projet, indexés par l'id de l'objet ajouté.
   *
   * `activeDecisionPredicate` exclut les décisions révoquées ; `notTombstonePredicate` exclut les
   * pierres tombales elles-mêmes (verdict='annule'), qui ne sont pas des ajouts mais des retraits.
   * Sans le second, retirer un ajout le ferait réapparaître.
   *
   * Cloisonné par plateforme : MEC ne voit pas les ajouts d'une autre plateforme, comme pour
   * toutes les décisions.
   */
  async actifs(
    projetId: string,
    objetBType: ObjetAjoutable,
    plateforme: string,
  ): Promise<Map<string, { ajout: AjoutManuel; service?: PayloadAjout["service"] }>> {
    const rows = await this.dbService.database
      .select({
        id: decisions.id,
        objetBId: decisions.objetBId,
        commentaire: decisions.commentaire,
        payload: decisions.payload,
        createdAt: decisions.createdAt,
      })
      .from(decisions)
      .where(
        and(
          eq(decisions.typeDecision, TYPE_AJOUT),
          eq(decisions.objetAId, projetId),
          eq(decisions.objetBType, objetBType),
          eq(decisions.plateformeSource, plateforme),
          activeDecisionPredicate(ALIAS),
          notTombstonePredicate(ALIAS),
        ),
      );

    return new Map(
      rows
        .filter((r): r is typeof r & { objetBId: string } => r.objetBId != null)
        .map((r) => {
          const service = (r.payload as PayloadAjout | null)?.service;
          return [
            r.objetBId,
            {
              ajout: {
                decisionId: r.id,
                message: r.commentaire ?? undefined,
                plateforme,
                date: r.createdAt.toISOString(),
                // Le client doit pouvoir distinguer un service du catalogue d'un service saisi à
                // la main : le second n'a pas de classification, et ses `categories` / `thematiques`
                // vides sont une ABSENCE d'information, pas une information.
                ...(service ? { horsCatalogue: true } : {}),
              },
              service,
            },
          ];
        }),
    );
  }
}
