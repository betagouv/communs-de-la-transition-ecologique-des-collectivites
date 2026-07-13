import { ProjetResponse } from "@projets/dto/projet.dto";
import { FinancementDef, RessourceDef } from "@/questionnaires/questionnaire-contract";

/**
 * Une recommandation telle qu'une source la produit, AVANT namespacing de l'id et AVANT
 * jointure avec l'arbitrage. `cle` est locale à la source ; l'id exposé est construit par
 * RecommandationsService.
 */
export interface RecommandationBrute {
  cle: string;
  /** Identifiant de l'objet d'origine DANS la source (ex. slug du questionnaire). */
  ref?: string;
  /** Libellé affichable de la source (ex. « AtoutBiodiv »). */
  libelleSource?: string;
  icone?: string;
  titre: string;
  description: string;
  financements: FinancementDef[];
  ressources: RessourceDef[];
  engagement: string;
}

/**
 * Une source de recommandations. Les recommandations ne sont PAS stockées : elles sont
 * recalculées à chaque lecture en faisant contribuer toutes les sources. Seul l'arbitrage
 * de la collectivité est persisté (journal decisions_humaines).
 *
 * Ajouter une source (diagnostic, aide détectée, règle métier…) = ajouter un provider
 * `{ provide: RECOMMANDATION_SOURCES, useClass: …, multi: true }`, sans toucher ni au
 * contrôleur, ni au contrat public.
 *
 * Chaque source applique sa propre règle de contribution ; aucune ne fuit vers le client.
 */
export interface RecommandationSource {
  /** Famille de source, exposée dans `source.type` (descriptif, non structurant). */
  readonly type: string;
  contribuer(projet: ProjetResponse): Promise<RecommandationBrute[]>;
}

export const RECOMMANDATION_SOURCES = Symbol("RECOMMANDATION_SOURCES");
