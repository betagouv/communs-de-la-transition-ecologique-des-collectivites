import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { servicesNumeriques } from "@database/schema";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AideClassification, AideMatchResult } from "@/aides/dto/aides.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { QuestionnairesRepository } from "@/questionnaires/questionnaires.repository";
import type { QuestionnaireDef } from "@/questionnaires/questionnaire-contract";
import { calculerStatut, evaluerCondition, reconcilierReponses } from "@/questionnaires/questionnaire-contract";
import { etiquettesManquantes } from "@/questionnaires/questionnaires.service";
import { facteurPhase, SEUIL_PERTINENCE, type PoidsParPhase } from "@/services-numeriques/service-numerique-contract";
import { ContenuResponse, SimulationRequest, SimulationResponse } from "./dto/admin.dto";

/**
 * Service d'administration : voir le contenu tel qu'il est, et SIMULER ce que l'API renverrait
 * pour un PROJET RÉEL.
 *
 * POURQUOI UN PROJET RÉEL PLUTÔT QUE FICTIF. Un projet composé à la main serait trop propre —
 * il dirait ce qu'on veut entendre. Un projet existant porte sa classification réelle, avec ses
 * trous et ses approximations : c'est le seul moyen de savoir ce qu'une collectivité verra
 * vraiment. Et ça évite de scinder les services existants : rien dans le reste de l'API n'est
 * modifié pour ce module.
 *
 * POURQUOI ON RENVOIE LES SCORES SOUS LE SEUIL. Un outil qui n'affiche que les retenus ne
 * permet pas de régler le seuil — il faut voir la distribution pour savoir où poser le curseur.
 * Chaque candidat est donc rendu avec son score ET son verdict.
 *
 * Ce module est ADDITIF et ISOLÉ : rien ne l'importe, IL N'ÉCRIT RIEN. L'édition des questionnaires
 * vit dans QuestionnairesModule, pas ici — sans quoi jeter l'écran rendrait le contenu non
 * éditable. Le supprimer, c'est `rm -rf src/admin` plus UNE ligne dans app.module.ts.
 */
/** Toutes les étiquettes requises, à plat — le cas « projet non classifié ». */
function requisesAPlat(def: QuestionnaireDef): { axe: string; label: string }[] {
  const { thematiques, sites, interventions } = def.etiquettesRequises;
  return [
    ...thematiques.map((label) => ({ axe: "thematiques", label })),
    ...sites.map((label) => ({ axe: "sites", label })),
    ...interventions.map((label) => ({ axe: "interventions", label })),
  ];
}

@Injectable()
export class AdminService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
    private readonly matchingService: AidesMatchingService,
    private readonly questionnairesRepository: QuestionnairesRepository,
  ) {}

  /** Le contenu tel qu'il est réellement chargé — conditions et classifications comprises. */
  async contenu(): Promise<ContenuResponse> {
    const catalogue = await this.dbService.database.select().from(servicesNumeriques);
    const questionnaires = await this.questionnairesRepository.tous();

    return {
      questionnaires: questionnaires.map((q) => ({
        slug: q.slug,
        libelle: q.source.nom,
        version: q.version,
        banniere: q.banniere,
        etiquettesRequises: q.etiquettesRequises,
        questions: q.questions,
        recommandations: q.recommandations,
      })),
      services: catalogue.map((s) => ({
        slug: s.slug,
        nom: s.nom,
        profilGeneraliste: s.profilGeneraliste,
        presentationGenerique: s.presentationGenerique,
        categories: s.categories,
        niveauExpertise: s.niveauExpertise,
        classification: s.classification,
        phases: s.phases as PoidsParPhase,
        logoUrl: s.logoUrl,
      })),
      seuils: { pertinence: SEUIL_PERTINENCE },
    };
  }

  /**
   * Ce que l'API renverrait pour ce projet — TOUS les candidats, avec leur score et leur verdict.
   *
   * Les `reponses` fournies ne sont PAS enregistrées : la simulation ne touche jamais à l'état
   * de la collectivité. On peut donc explorer librement l'effet d'une réponse sans polluer.
   */
  async simuler(requete: SimulationRequest): Promise<SimulationResponse> {
    const { projet } = await this.getProjetsService.findOneWithSource(requete.projetId);
    const scoresProjet = projet.classificationScores;

    return {
      projet: {
        id: projet.id,
        nom: projet.nom,
        phase: projet.phase,
        classificationScores: scoresProjet,
        // Un projet non classifié ne verra jamais aucun questionnaire, et seulement les services
        // génériques. C'est le premier réflexe de diagnostic : le dire, plutôt que d'afficher
        // une liste vide sans explication.
        avertissement: scoresProjet ? null : "Projet non classifié : le job LLM n'a pas encore tourné.",
      },
      questionnaires: await this.simulerQuestionnaires(scoresProjet, requete.reponses ?? {}),
      services: await this.simulerServices(scoresProjet, projet.phase),
      seuils: { pertinence: SEUIL_PERTINENCE },
    };
  }

  /**
   * Confronte la classification du projet à celle des candidats, indexée par leur clé.
   *
   * Un projet sans classification ne matche rien — d'où la map vide plutôt qu'un appel au moteur :
   * il n'y a rien à comparer, et le dire ici évite de le redire à chaque appelant.
   */
  private confronter(
    scoresProjet: AideClassification | null,
    parCle: Map<string, AideClassification>,
  ): Map<string, AideMatchResult> {
    if (!scoresProjet) return new Map<string, AideMatchResult>();

    return new Map<string, AideMatchResult>(
      this.matchingService.match(scoresProjet, parCle, parCle.size).map((m): [string, AideMatchResult] => [m.idAt, m]),
    );
  }

  /**
   * L'éligibilité est un CRITÈRE, pas un score : on rend donc les étiquettes qui MANQUENT.
   *
   * « non proposé, score 0,11 » n'apprend rien et ne se corrige pas. « non proposé : il manque
   * le lieu Place ou centre-bourg » dit exactement quoi regarder — soit la classification du
   * projet est fausse, soit le questionnaire vise autre chose.
   */
  private async simulerQuestionnaires(
    scoresProjet: AideClassification | null,
    reponsesParSlug: Record<string, Record<string, string>>,
  ): Promise<SimulationResponse["questionnaires"]> {
    const tous = await this.questionnairesRepository.tous();

    return tous
      .map((def) => {
        // Sans classification, TOUTES les étiquettes requises manquent : c'est la vérité, et c'est
        // plus parlant qu'un « non éligible » sans motif.
        const manquantes = scoresProjet
          ? etiquettesManquantes(scoresProjet, def.etiquettesRequises)
          : requisesAPlat(def);
        const reponses = reconcilierReponses(def, reponsesParSlug[def.slug] ?? {});
        const statut = calculerStatut(def, reponses);
        const retenu = manquantes.length === 0;

        return {
          slug: def.slug,
          retenu,
          etiquettesManquantes: manquantes,
          statut,
          reponses,
          recommandations: def.recommandations.map((r) => ({
            id: `questionnaire:${def.slug}:${r.id}`,
            titre: r.titre,
            inconditionnelle: r.condition === true,
            // Une recommandation ne sort que si sa condition est vraie ET que le questionnaire est
            // entamé — la garde qui empêche les inconditionnelles de s'afficher avant toute réponse.
            declenchee: retenu && statut !== "non_commence" && evaluerCondition(r.condition, reponses),
          })),
        };
      })
      .sort((a, b) => a.etiquettesManquantes.length - b.etiquettesManquantes.length || a.slug.localeCompare(b.slug));
  }

  private async simulerServices(
    scoresProjet: AideClassification | null,
    phase: SimulationResponse["projet"]["phase"],
  ): Promise<SimulationResponse["services"]> {
    const catalogue = await this.dbService.database.select().from(servicesNumeriques);

    const parSlug = new Map<string, AideClassification>(catalogue.map((s) => [s.slug, s.classification]));
    const matches = this.confronter(scoresProjet, parSlug);

    return catalogue
      .map((s) => {
        const match = matches.get(s.slug);
        const brut = match?.normalizedScore ?? 0;
        const facteur = facteurPhase(s.phases as PoidsParPhase, phase);
        const score = brut * facteur;
        return {
          slug: s.slug,
          nom: s.nom,
          scoreBrut: brut,
          facteurPhase: facteur,
          score,
          // Le score seul décide : il n'y a plus de repêchage générique. Le back-office doit
          // montrer EXACTEMENT ce que fait l'API, sans quoi il ment sur ce que verra la
          // collectivité.
          retenu: score >= SEUIL_PERTINENCE,
          etiquettesCommunes: match?.labelsCommuns ?? { thematiques: [], sites: [], interventions: [] },
          profilGeneraliste: s.profilGeneraliste,
          categories: s.categories,
        };
      })
      .sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom));
  }
}
