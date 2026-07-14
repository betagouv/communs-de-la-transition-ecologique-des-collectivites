import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { questionnaires } from "@database/schema";
import type { EtiquettesRequises } from "./content/classification";
import type { BanniereDef, QuestionDef, QuestionnaireDef, RecommandationDef } from "./questionnaire-contract";
import { validerDefinition } from "./questionnaire-validation";

type Ligne = typeof questionnaires.$inferSelect;

/**
 * Les questionnaires vivent en BASE, et sont éditables depuis le back-office.
 *
 * Ils vivaient dans le dépôt (JSON partenaire + classification.ts), relus en PR, et le chargeur
 * refusait de démarrer sur la moindre incohérence. On a échangé ce filet contre l'édition sans
 * déploiement — mais on ne l'a pas perdu : `validerDefinition` le rejoue à l'écriture, et refuse
 * (400) exactement ce que le chargeur refusait.
 */
@Injectable()
export class QuestionnairesRepository {
  constructor(private readonly dbService: DatabaseService) {}

  /** Tous les questionnaires, dans l'ordre alphabétique de leur slug (stable entre deux appels). */
  async tous(): Promise<QuestionnaireDef[]> {
    const lignes = await this.dbService.database.select().from(questionnaires).orderBy(questionnaires.slug);
    return lignes.map(versDefinition);
  }

  async parSlug(slug: string): Promise<QuestionnaireDef> {
    const [ligne] = await this.dbService.database
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.slug, slug))
      .limit(1);

    if (!ligne) throw new NotFoundException(`Questionnaire "${slug}" inconnu.`);
    return versDefinition(ligne);
  }

  /**
   * Crée ou remplace un questionnaire, APRÈS validation complète.
   *
   * La version s'incrémente à chaque édition. Elle n'invalide rien : `reconcilierReponses` ignore à
   * la lecture les réponses devenues sans objet, sans réécrire la ligne stockée. Une collectivité
   * qui avait répondu à une question supprimée ne perd pas ses autres réponses.
   */
  async enregistrer(def: QuestionnaireDef, editePar?: string): Promise<QuestionnaireDef> {
    validerDefinition(def);

    const valeurs = {
      slug: def.slug,
      sourceNom: def.source.nom,
      banniere: def.banniere as unknown as Record<string, unknown>,
      questions: def.questions as unknown as unknown[],
      recommandations: def.recommandations as unknown as unknown[],
      etiquettesRequises: {
        thematiques: [...def.etiquettesRequises.thematiques],
        sites: [...def.etiquettesRequises.sites],
        interventions: [...def.etiquettesRequises.interventions],
      },
      editePar: editePar ?? null,
    };

    const [ligne] = await this.dbService.database
      .insert(questionnaires)
      .values(valeurs)
      .onConflictDoUpdate({
        target: questionnaires.slug,
        set: { ...valeurs, version: sqlIncrement() },
      })
      .returning();

    return versDefinition(ligne);
  }

  async supprimer(slug: string): Promise<void> {
    const supprimees = await this.dbService.database
      .delete(questionnaires)
      .where(eq(questionnaires.slug, slug))
      .returning({ slug: questionnaires.slug });

    if (supprimees.length === 0) throw new NotFoundException(`Questionnaire "${slug}" inconnu.`);
  }
}

/** `version + 1` — l'édition incrémente, elle ne réinitialise pas. */
function sqlIncrement() {
  return sql`${questionnaires.version} + 1`;
}

function versDefinition(l: Ligne): QuestionnaireDef {
  return {
    slug: l.slug,
    version: l.version,
    source: { nom: l.sourceNom },
    banniere: l.banniere as unknown as BanniereDef,
    questions: l.questions as unknown as QuestionDef[],
    recommandations: l.recommandations as unknown as RecommandationDef[],
    etiquettesRequises: l.etiquettesRequises as unknown as EtiquettesRequises,
  };
}
