import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { servicesNumeriques } from "@database/schema";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AideClassification } from "@/aides/dto/aides.dto";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import {
  facteurPhase,
  SEUIL_PERTINENCE,
  type Categorie,
  type NiveauExpertise,
  type PoidsParPhase,
} from "./service-numerique-contract";
import { ProjetServicesResponse, ServiceResponse } from "./dto/service-numerique.dto";

type LigneCatalogue = typeof servicesNumeriques.$inferSelect;

@Injectable()
export class ServicesNumeriquesService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
    private readonly matchingService: AidesMatchingService,
  ) {}

  /**
   * Services numériques pertinents pour un projet, prêts à afficher.
   *
   * `findOneWithSource` : le projet peut vivre dans public.projets, data_mec ou data_tet.
   * Aucun service → 200 avec une liste vide, jamais 404.
   */
  async findForProjet(projetId: string): Promise<ProjetServicesResponse> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);

    // 1. CURATION — le benchmark porte 125 services, 28 seulement sont « À intégrer MEC ».
    const cures = await this.dbService.database
      .select()
      .from(servicesNumeriques)
      .where(eq(servicesNumeriques.aIntegrerMec, "oui"));

    const scores = this.scorer(projet, cures);

    // 2. PERTINENCE — au-dessus du seuil, trié par score décroissant.
    const pertinents = scores.filter((s) => s.score >= SEUIL_PERTINENCE).sort((a, b) => b.score - a.score);

    // 3. FALLBACK — les services transverses (« à présenter dans une présentation générique »)
    //    remontent même sans correspondance fine, APRÈS les pertinents. Sans cela, les 7
    //    services curés dépourvus de thématique fine ne seraient jamais affichés, et un projet
    //    non encore classifié ne verrait aucun service du tout.
    const generiques = scores
      .filter((s) => s.score < SEUIL_PERTINENCE && s.ligne.presentationGenerique === "oui")
      .sort((a, b) => b.score - a.score || a.ligne.nom.localeCompare(b.ligne.nom));

    return { services: [...pertinents, ...generiques].map(({ ligne }) => this.toResponse(ligne)) };
  }

  /**
   * Score de pertinence = score de matching sur les trois axes (le MÊME moteur que les aides
   * et les questionnaires), modulé par la phase du projet.
   *
   * Un projet non classifié (le job LLM n'a pas tourné) donne un score nul à tout le monde :
   * seuls les services génériques remonteront. C'est voulu.
   */
  private scorer(projet: ProjetResponse, lignes: LigneCatalogue[]): { ligne: LigneCatalogue; score: number }[] {
    const scoresProjet = projet.classificationScores;
    if (!scoresProjet) return lignes.map((ligne) => ({ ligne, score: 0 }));

    const parSlug = new Map<string, AideClassification>(lignes.map((l) => [l.slug, l.classification]));
    const matches = new Map(
      this.matchingService.match(scoresProjet, parSlug, lignes.length).map((m) => [m.idAt, m.normalizedScore]),
    );

    return lignes.map((ligne) => {
      const brut = matches.get(ligne.slug) ?? 0;
      return { ligne, score: brut * facteurPhase(ligne.phases as PoidsParPhase, projet.phase) };
    });
  }

  /**
   * Projection vers le contrat public : uniquement les champs d'affichage. N'exposent JAMAIS
   * les critères de sélection ni de curation — `classification`, `phases`, `aIntegrerMec`,
   * `presentationGenerique` n'ont aucun équivalent dans le DTO (§1 et §9 de la spec).
   */
  private toResponse(l: LigneCatalogue): ServiceResponse {
    return {
      id: l.slug,
      nom: l.nom,
      baseline: l.baseline ?? undefined,
      description: l.description ?? "",
      descriptionLongue: l.descriptionLongue ?? undefined,
      logoUrl: l.logoUrl ?? undefined,
      categories: l.categories as Categorie[],
      niveauExpertise: (l.niveauExpertise as NiveauExpertise | null) ?? undefined,
      thematiques: l.classification.thematiques.map((t) => t.label),
      operateur: l.operateur ?? undefined,
      redirection: l.redirectionUrl ? { url: l.redirectionUrl, libelle: l.redirectionLibelle ?? undefined } : undefined,
      iframe: l.iframeUrl ? { url: l.iframeUrl, libelle: l.iframeLibelle ?? undefined } : undefined,
    };
  }
}
