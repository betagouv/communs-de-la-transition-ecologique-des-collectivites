import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { projetQuestionnaireReponses } from "@database/schema";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AideClassification } from "@/aides/dto/aides.dto";
import { QUESTIONNAIRES } from "./content";
import { SEUIL_CONFIANCE, type EtiquettesRequises } from "./content/classification";
import { calculerStatut, reconcilierReponses, type QuestionnaireDef } from "./questionnaire-contract";
import { ProjetQuestionnairesResponse, QuestionnaireResponse } from "./dto/questionnaire.dto";

/** Questionnaire éligible + réponses réconciliées : la vue interne, partagée avec les sources de recommandations. */
export interface QuestionnaireEtat {
  def: QuestionnaireDef;
  reponses: Record<string, string>;
}

/**
 * Le projet porte-t-il TOUTES les étiquettes qui définissent ce questionnaire ?
 *
 * C'est un CRITÈRE, pas un score. Un questionnaire n'est pas une aide : une aide ressemble plus
 * ou moins à un projet, un score a du sens ; un questionnaire, lui, s'applique ou ne s'applique
 * pas — c'est une salle des fêtes, ou ce n'en est pas une.
 *
 * Le score de matching a été essayé et il échoue ici pour une raison structurelle : il normalise
 * par le maximum du PROJET. Deux projets portant tous deux « Place ou centre-bourg » obtenaient
 * 1,00 et 0,11 selon que leur classification était pauvre ou riche — le second était écarté alors
 * qu'il est bel et bien une place. Un critère ne doit pas dépendre de la largeur de la
 * classification d'à côté.
 *
 * Exporté : le back-office rejoue la même fonction pour expliquer POURQUOI un questionnaire n'est
 * pas proposé (quelle étiquette manque). Une seule définition de l'éligibilité, jamais deux.
 */
export function etiquettesManquantes(
  scoresProjet: AideClassification,
  requises: EtiquettesRequises,
): { axe: keyof EtiquettesRequises; label: string }[] {
  const porte = (axe: keyof EtiquettesRequises, label: string) =>
    scoresProjet[axe].some((e) => e.label === label && e.score >= SEUIL_CONFIANCE);

  return (["thematiques", "sites", "interventions"] as const).flatMap((axe) =>
    requises[axe].filter((label) => !porte(axe, label)).map((label) => ({ axe, label })),
  );
}

@Injectable()
export class QuestionnairesService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
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

    const etats = eligibles.map((def) => {
      const ligne = lignes.find((l) => l.slug === def.slug);
      return { def, reponses: reconcilierReponses(def, ligne?.reponses ?? {}) };
    });

    return { projet, etats };
  }

  /**
   * Un projet non encore classifié (le job LLM n'a pas tourné) ne se voit proposer aucun
   * questionnaire : on ne sait rien de lui, on n'a donc rien à lui demander. Contrairement aux
   * aides, on ne renvoie pas 202 — la spec impose une liste vide en 200, et un questionnaire
   * n'est pas un contenu qu'on fait attendre.
   */
  private questionnairesEligibles(projet: ProjetResponse): QuestionnaireDef[] {
    const scoresProjet = projet.classificationScores;
    if (!scoresProjet) return [];

    return QUESTIONNAIRES.filter((def) => etiquettesManquantes(scoresProjet, def.etiquettesRequises).length === 0);
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
