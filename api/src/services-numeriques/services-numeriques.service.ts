import { Injectable } from "@nestjs/common";
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

/**
 * Les logos sont hébergés par l'API et stockés en base comme chemins relatifs
 * (`/logos/services/<slug>.svg`) : le catalogue ne doit pas connaître le domaine sur lequel
 * il tourne. On les rend absolus à la sortie, sinon le client les chercherait sur SON propre
 * domaine. Une URL déjà absolue (logo resté chez un partenaire) est laissée telle quelle.
 *
 * `null` est une valeur légitime : quatre services curés n'ont aucun logo — leur marque est
 * purement typographique (en-tête DSFR texte). On n'en invente pas ; au client d'afficher
 * une tuile texte.
 */
function absolutiser(chemin: string | null, baseUrl: string): string | undefined {
  if (!chemin) return undefined;
  return chemin.startsWith("/") ? `${baseUrl}${chemin}` : chemin;
}

/**
 * `undefined` quand le benchmark ne dit rien — et il se tait souvent : 51 lignes sur 125 ne
 * sont pas renseignées. « Non renseigné » n'est pas « non » : le client doit pouvoir
 * distinguer « ce service ne convient pas à un généraliste » de « on n'en sait rien ».
 */
function ternaireVersBooleen(valeur: string | null): boolean | undefined {
  if (valeur === "oui") return true;
  if (valeur === "non") return false;
  return undefined;
}

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
  async findForProjet(projetId: string, baseUrl: string): Promise<ProjetServicesResponse> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);

    // Aucun verrou de curation : c'est le SCORE seul qui décide, comme pour les aides et les
    // questionnaires. Les 51 lignes non renseignées du benchmark (ni thématique, ni catégorie)
    // s'éliminent d'elles-mêmes — leur score est nul et elles ne sont pas génériques.
    const catalogue = await this.dbService.database.select().from(servicesNumeriques);

    const scores = this.scorer(projet, catalogue);

    // 1. PERTINENCE — au-dessus du seuil, trié par score décroissant.
    const pertinents = scores.filter((s) => s.score >= SEUIL_PERTINENCE).sort((a, b) => b.score - a.score);

    // 2. FALLBACK — les services transverses (« à présenter dans une présentation générique »)
    //    remontent même sans correspondance fine, APRÈS les pertinents. Sans cela, les services
    //    dépourvus de thématique fine ne seraient jamais affichés, et un projet non encore
    //    classifié ne verrait aucun service du tout.
    const generiques = scores
      .filter((s) => s.score < SEUIL_PERTINENCE && s.ligne.presentationGenerique === "oui")
      .sort((a, b) => b.score - a.score || a.ligne.nom.localeCompare(b.ligne.nom));

    return { services: [...pertinents, ...generiques].map(({ ligne }) => this.toResponse(ligne, baseUrl)) };
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
   * Projection vers le contrat public.
   *
   * Les CRITÈRES DE SÉLECTION ne franchissent jamais la frontière : `classification`, `phases`
   * et `presentationGenerique` n'ont aucun équivalent dans le DTO (§1 et §9 de la spec).
   *
   * `profilGeneraliste`, lui, est exposé — parce que ce n'en est plus un : il ne décide plus
   * de rien côté serveur, il décrit le service (utilisable par un non-spécialiste ?) au même
   * titre que `niveauExpertise`. Le client peut donc filtrer dessus sans dupliquer de règle.
   */
  private toResponse(l: LigneCatalogue, baseUrl: string): ServiceResponse {
    return {
      id: l.slug,
      nom: l.nom,
      baseline: l.baseline ?? undefined,
      description: l.description ?? "",
      descriptionLongue: l.descriptionLongue ?? undefined,
      logoUrl: absolutiser(l.logoUrl, baseUrl),
      categories: l.categories as Categorie[],
      niveauExpertise: (l.niveauExpertise as NiveauExpertise | null) ?? undefined,
      thematiques: l.classification.thematiques.map((t) => t.label),
      profilGeneraliste: ternaireVersBooleen(l.profilGeneraliste),
      operateur: l.operateur ?? undefined,
      redirection: l.redirectionUrl ? { url: l.redirectionUrl, libelle: l.redirectionLibelle ?? undefined } : undefined,
      iframe: l.iframeUrl ? { url: l.iframeUrl, libelle: l.iframeLibelle ?? undefined } : undefined,
    };
  }
}
