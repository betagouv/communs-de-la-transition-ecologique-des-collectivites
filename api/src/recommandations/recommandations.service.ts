import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { decisions } from "@database/schema";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { DecisionsService } from "@/decisions/decisions.service";
import { activeDecisionPredicate, notTombstonePredicate } from "@/decisions/active-decisions";
import { ANNULE_VERDICT, type RecommandationVerdict } from "@/decisions/decision-contract";
import { RECOMMANDATION_SOURCES, type RecommandationBrute, type RecommandationSource } from "./recommandation-source";
import { ProjetRecommandationsResponse } from "./dto/recommandation.dto";

const TYPE_DECISION = "recommandation_arbitrage";

// L'alias SQL de la table dans une requête drizzle `select().from(decisions)` est le nom
// de la table elle-même : les prédicats partagés du module decisions sont réutilisés tels
// quels, pour qu'il n'existe qu'UNE définition de « décision active ».
const ALIAS = "decisions";

@Injectable()
export class RecommandationsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
    private readonly decisionsService: DecisionsService,
    @Inject(RECOMMANDATION_SOURCES) private readonly sources: RecommandationSource[],
  ) {}

  /**
   * Toutes les recommandations du projet, toutes sources agrégées, avec leur arbitrage
   * courant. Les recommandations ne sont pas stockées : elles sont recalculées ici à
   * chaque lecture. Une liste vide est un 200, jamais un 404.
   */
  async findForProjet(projetId: string, plateformeSource: string): Promise<ProjetRecommandationsResponse> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);
    const [brutes, arbitrages] = await Promise.all([
      this.agreger(projet),
      this.arbitragesActifs(projetId, plateformeSource),
    ]);

    return {
      recommandations: brutes.map(({ source, brute, id }) => ({
        id,
        source: { type: source.type, ref: brute.ref, libelle: brute.libelleSource },
        icone: brute.icone,
        titre: brute.titre,
        description: brute.description,
        financements: brute.financements,
        ressources: brute.ressources,
        engagement: brute.engagement,
        decision: arbitrages.get(id) ?? null,
      })),
    };
  }

  /**
   * Tranche une recommandation, ciblée par son SEUL id. Écrit dans le journal append-only
   * des décisions humaines : aucune ligne n'est mutée.
   *  - décision non nulle : nouvel événement, qui supersède l'arbitrage courant s'il existe
   *    (on conserve ainsi une tête de chaîne unique par recommandation).
   *  - décision nulle : révocation (verdict "annule" + supersedes). Sans arbitrage courant,
   *    c'est un no-op — effacer ce qui n'existe pas n'est pas une erreur (idempotence).
   *
   * 404 si la recommandation n'est pas produite pour ce projet : on ne tranche pas une
   * recommandation qu'on ne se voit pas proposer.
   */
  async trancher(
    projetId: string,
    recommandationId: string,
    decision: RecommandationVerdict | null,
    plateformeSource: string,
  ): Promise<ProjetRecommandationsResponse> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);

    const brutes = await this.agreger(projet);
    if (!brutes.some((b) => b.id === recommandationId)) {
      throw new NotFoundException(`Recommandation "${recommandationId}" inconnue pour ce projet`);
    }

    const tete = await this.teteDeChaine(projetId, recommandationId, plateformeSource);

    if (decision == null) {
      // Rien à révoquer : soit aucun arbitrage, soit déjà révoqué (tête = pierre tombale).
      if (tete && tete.verdict !== ANNULE_VERDICT) {
        await this.decisionsService.create(
          {
            typeDecision: TYPE_DECISION,
            objetAType: "projet",
            objetAId: projetId,
            objetBType: "recommandation",
            objetBId: recommandationId,
            verdict: ANNULE_VERDICT,
            supersedes: tete.id,
          },
          plateformeSource,
        );
      }
    } else {
      await this.decisionsService.create(
        {
          typeDecision: TYPE_DECISION,
          objetAType: "projet",
          objetAId: projetId,
          objetBType: "recommandation",
          objetBId: recommandationId,
          verdict: decision,
          supersedes: tete?.id,
        },
        plateformeSource,
      );
    }

    return this.findForProjet(projetId, plateformeSource);
  }

  /**
   * Fait contribuer toutes les sources et namespace les ids. L'id est une fonction PURE de
   * (type de source, clé dans la source) : il est donc stable dans le temps, ce qui est la
   * condition pour que l'arbitrage survive à un recalcul. En cas de collision entre deux
   * sources, la première déclarée gagne — l'unicité à l'échelle du projet est garantie ici.
   */
  private async agreger(
    projet: ProjetResponse,
  ): Promise<{ source: RecommandationSource; brute: RecommandationBrute; id: string }[]> {
    const contributions = await Promise.all(
      this.sources.map(async (source) => ({ source, brutes: await source.contribuer(projet) })),
    );

    const parId = new Map<string, { source: RecommandationSource; brute: RecommandationBrute; id: string }>();
    for (const { source, brutes } of contributions) {
      for (const brute of brutes) {
        const id = `${source.type}:${brute.cle}`;
        if (!parId.has(id)) parId.set(id, { source, brute, id });
      }
    }
    return [...parId.values()];
  }

  /** Arbitrages effectifs du projet : tête de chaîne non révoquée, indexée par id de recommandation. */
  private async arbitragesActifs(
    projetId: string,
    plateformeSource: string,
  ): Promise<Map<string, RecommandationVerdict>> {
    const rows = await this.dbService.database
      .select({ objetBId: decisions.objetBId, verdict: decisions.verdict })
      .from(decisions)
      .where(
        and(
          eq(decisions.typeDecision, TYPE_DECISION),
          eq(decisions.objetAId, projetId),
          eq(decisions.plateformeSource, plateformeSource),
          activeDecisionPredicate(ALIAS),
          notTombstonePredicate(ALIAS),
        ),
      );

    return new Map(
      rows
        .filter(
          (r): r is { objetBId: string; verdict: RecommandationVerdict } => r.objetBId != null && r.verdict != null,
        )
        .map((r) => [r.objetBId, r.verdict]),
    );
  }

  /**
   * Dernier événement de la chaîne pour cette recommandation (celui que personne ne
   * supersède), pierre tombale comprise — c'est lui qu'un nouvel événement doit superséder.
   */
  private async teteDeChaine(
    projetId: string,
    recommandationId: string,
    plateformeSource: string,
  ): Promise<{ id: string; verdict: string | null } | undefined> {
    const [tete] = await this.dbService.database
      .select({ id: decisions.id, verdict: decisions.verdict })
      .from(decisions)
      .where(
        and(
          eq(decisions.typeDecision, TYPE_DECISION),
          eq(decisions.objetAId, projetId),
          eq(decisions.objetBId, recommandationId),
          eq(decisions.plateformeSource, plateformeSource),
          activeDecisionPredicate(ALIAS),
        ),
      )
      .limit(1);

    return tete;
  }
}
