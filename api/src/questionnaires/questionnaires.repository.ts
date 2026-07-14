import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { questionnaires } from "@database/schema";
import type {
  BanniereDef,
  EtiquettesRequises,
  QuestionDef,
  QuestionnaireDef,
  RecommandationDef,
} from "./questionnaire-contract";
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
/**
 * Durée de vie du cache mémoire.
 *
 * Les questionnaires sont 4 lignes quasi immuables, éditées à la main quelques fois par an — et
 * relues DEUX fois à chaque affichage de fiche projet (une fois pour les questionnaires, une fois
 * pour les recommandations qui s'appuient dessus). Les garder en mémoire supprime ces lectures.
 *
 * Le TTL couvre le cas multi-instance : celle qui écrit vide son propre cache, les autres
 * rattrapent en moins d'une minute. Personne n'attend qu'une édition de back-office soit visible à
 * la milliseconde — et le dire ici évite qu'on cherche un bug le jour où ça prend 30 secondes.
 */
const CACHE_MS = 60_000;

@Injectable()
export class QuestionnairesRepository {
  private cache: { defs: QuestionnaireDef[]; expire: number } | null = null;

  constructor(private readonly dbService: DatabaseService) {}

  /** Tous les questionnaires, dans l'ordre alphabétique de leur slug (stable entre deux appels). */
  async tous(): Promise<QuestionnaireDef[]> {
    if (this.cache && this.cache.expire > Date.now()) return this.cache.defs;

    const lignes = await this.dbService.database.select().from(questionnaires).orderBy(questionnaires.slug);
    const defs = lignes.map(versDefinition);

    this.cache = { defs, expire: Date.now() + CACHE_MS };
    return defs;
  }

  /**
   * Crée ou remplace un questionnaire, APRÈS validation complète.
   *
   * La version s'incrémente à chaque édition. Elle n'invalide rien : `reconcilierReponses` ignore à
   * la lecture les réponses devenues sans objet, sans réécrire la ligne stockée. Une collectivité
   * qui avait répondu à une question supprimée ne perd pas ses autres réponses.
   */
  async enregistrer(def: Omit<QuestionnaireDef, "version">, editePar?: string): Promise<QuestionnaireDef> {
    validerDefinition(def);

    const valeurs = versLigne(def, editePar);

    const [ligne] = await this.dbService.database
      .insert(questionnaires)
      .values(valeurs)
      .onConflictDoUpdate({
        target: questionnaires.slug,
        // La version s'incrémente ici, jamais depuis le client : un éditeur qui la fournirait
        // pourrait faire reculer un questionnaire déjà édité par quelqu'un d'autre.
        set: { ...valeurs, version: sql`${questionnaires.version} + 1` },
      })
      .returning();

    this.cache = null;
    return versDefinition(ligne);
  }

  async supprimer(slug: string): Promise<void> {
    const supprimees = await this.dbService.database
      .delete(questionnaires)
      .where(eq(questionnaires.slug, slug))
      .returning({ slug: questionnaires.slug });

    this.cache = null;
    if (supprimees.length === 0) throw new NotFoundException(`Questionnaire "${slug}" inconnu.`);
  }
}

/**
 * Définition → ligne. Exporté pour que le script d'amorçage n'en écrive pas une seconde version :
 * il ajoutait déjà une colonne de moins que celle-ci (il n'incrémentait pas `version`).
 */
export function versLigne(def: Omit<QuestionnaireDef, "version">, editePar?: string) {
  return {
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
