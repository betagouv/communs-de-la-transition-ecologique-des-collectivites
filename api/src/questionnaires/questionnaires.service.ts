import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { projetQuestionnaireReponses } from "@database/schema";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AideClassification } from "@/aides/dto/aides.dto";
import { QUESTIONNAIRES } from "./content";
import { calculerStatut, reconcilierReponses, type QuestionnaireDef } from "./questionnaire-contract";
import { ProjetQuestionnairesResponse, QuestionnaireResponse } from "./dto/questionnaire.dto";

/** Questionnaire éligible + réponses réconciliées : la vue interne, partagée avec les sources de recommandations. */
export interface QuestionnaireEtat {
  def: QuestionnaireDef;
  reponses: Record<string, string>;
  /** Score de pertinence normalisé [0, 1] du questionnaire pour ce projet. Interne — n'est pas exposé. */
  score: number;
}

/**
 * Score normalisé minimal pour qu'un questionnaire soit proposé. Même échelle que le
 * `cutoff` des aides (AidesController) : normalizedScore = score / score maximal théorique
 * du projet, donc 1.0 = le questionnaire couvre parfaitement toutes les étiquettes du projet.
 *
 * 0.3 est délibérément permissif : un questionnaire est une invitation à réfléchir, pas une
 * aide qu'on propose à tort. Un faux positif coûte un onglet ignoré ; un faux négatif coûte
 * une opportunité de biodiversité jamais vue.
 */
export const SEUIL_ELIGIBILITE = 0.3;

@Injectable()
export class QuestionnairesService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
    private readonly matchingService: AidesMatchingService,
  ) {}

  /**
   * État des questionnaires éligibles d'un projet. Point d'entrée unique : le contrôleur et
   * la source de recommandations « questionnaire » consomment tous deux ce résultat, pour
   * qu'il n'existe qu'une seule définition de l'éligibilité et de la réconciliation.
   *
   * `findOneWithSource` (et non un lookup direct sur public.projets) : un projet MEC ou TeT
   * peut n'exister que dans data_mec/data_tet. 404 si introuvable.
   */
  async etatsPourProjet(projetId: string): Promise<{ projet: ProjetResponse; etats: QuestionnaireEtat[] }> {
    const { projet } = await this.getProjetsService.findOneWithSource(projetId);

    const eligibles = this.questionnairesEligibles(projet);
    if (eligibles.length === 0) return { projet, etats: [] };

    const lignes = await this.dbService.database
      .select()
      .from(projetQuestionnaireReponses)
      .where(eq(projetQuestionnaireReponses.projetId, projetId));

    const etats = eligibles.map(({ def, score }) => {
      const ligne = lignes.find((l) => l.slug === def.slug);
      return { def, score, reponses: reconcilierReponses(def, ligne?.reponses ?? {}) };
    });

    return { projet, etats };
  }

  /**
   * Éligibilité par SCORE, avec le moteur de matching des aides : le questionnaire est
   * classifié sur les mêmes trois axes qu'un projet et qu'une aide (thématiques 0.45, sites
   * 0.35, interventions 0.20), et son score normalisé contre la classification du projet
   * décide s'il est proposé.
   *
   * Un projet non encore classifié (classificationScores absent — le job LLM n'a pas tourné)
   * ne se voit proposer aucun questionnaire. Contrairement aux aides, on ne renvoie pas 202 :
   * la spec impose une liste vide en 200 pour un projet non éligible, et un questionnaire
   * n'est pas un contenu qu'on fait attendre.
   */
  private questionnairesEligibles(projet: ProjetResponse): { def: QuestionnaireDef; score: number }[] {
    const scoresProjet = projet.classificationScores;
    if (!scoresProjet) return [];

    const parSlug = new Map<string, AideClassification>(QUESTIONNAIRES.map((q) => [q.slug, q.classification]));

    return this.matchingService
      .match(scoresProjet, parSlug, QUESTIONNAIRES.length)
      .filter((m) => m.normalizedScore >= SEUIL_ELIGIBILITE)
      .map((m) => ({ def: questionnaireRequis(m.idAt), score: m.normalizedScore }));
  }

  async findForProjet(projetId: string): Promise<ProjetQuestionnairesResponse> {
    const { etats } = await this.etatsPourProjet(projetId);
    return { questionnaires: etats.map((e) => this.toResponse(e)) };
  }

  /**
   * Remplace l'INTÉGRALITÉ des réponses d'un questionnaire (idempotent). Les réponses sont
   * validées contre la définition courante AVANT écriture : une clé de question ou une
   * valeur d'option inconnue est un 400, jamais une écriture silencieuse.
   *
   * 404 si le questionnaire est inconnu OU non éligible : un questionnaire qui n'est pas
   * proposé ne doit pas pouvoir être rempli en devinant son slug.
   */
  async remplacerReponses(
    projetId: string,
    slug: string,
    reponses: Record<string, string>,
  ): Promise<ProjetQuestionnairesResponse> {
    const { etats } = await this.etatsPourProjet(projetId);

    const etat = etats.find((e) => e.def.slug === slug);
    if (!etat) {
      // Même 404 pour « slug inexistant » et « slug existant mais non éligible » : le
      // message ne doit rien révéler des règles d'éligibilité (cf. §2 de la spec).
      throw new NotFoundException(`Questionnaire "${slug}" inconnu ou non proposé pour ce projet`);
    }

    this.assertReponsesValides(etat.def, reponses);

    await this.dbService.database
      .insert(projetQuestionnaireReponses)
      .values({ projetId, slug, version: etat.def.version, reponses })
      .onConflictDoUpdate({
        target: [projetQuestionnaireReponses.projetId, projetQuestionnaireReponses.slug],
        set: { reponses, version: etat.def.version },
      });

    return this.findForProjet(projetId);
  }

  private assertReponsesValides(def: QuestionnaireDef, reponses: Record<string, string>): void {
    for (const [questionId, optionId] of Object.entries(reponses)) {
      const question = def.questions.find((q) => q.id === questionId);
      if (!question) {
        throw new BadRequestException(
          `Question "${questionId}" inconnue pour le questionnaire "${def.slug}" ` +
            `(attendu : ${def.questions.map((q) => q.id).join(", ")})`,
        );
      }
      if (!question.options.some((o) => o.id === optionId)) {
        throw new BadRequestException(
          `Option "${optionId}" inconnue pour la question "${questionId}" ` +
            `(attendu : ${question.options.map((o) => o.id).join(", ")})`,
        );
      }
    }
  }

  /** Projette vers le DTO public — sans `condition`, sans `classification`, sans score. */
  private toResponse({ def, reponses }: QuestionnaireEtat): QuestionnaireResponse {
    return {
      slug: def.slug,
      version: def.version,
      statut: calculerStatut(def, reponses),
      banniere: def.banniere,
      questions: def.questions.map((q) => ({
        id: q.id,
        type: q.type,
        intitule: q.intitule,
        options: q.options.map((o) => ({
          id: o.id,
          libelle: o.libelle,
          aide: o.aide,
          signal: o.signal,
          feedback: o.feedback,
        })),
      })),
      reponses,
    };
  }
}

/** Le moteur ne renvoie que des clés issues du registre : un slug absent serait un bug interne. */
function questionnaireRequis(slug: string): QuestionnaireDef {
  const def = QUESTIONNAIRES.find((q) => q.slug === slug);
  if (!def) throw new Error(`Questionnaire "${slug}" absent du registre alors que le matching l'a retourné`);
  return def;
}
