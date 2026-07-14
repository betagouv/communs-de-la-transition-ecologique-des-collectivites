/**
 * Ajouts manuels : une aide ou un service numérique qu'un humain attache à un projet parce que le
 * moteur ne l'a pas trouvé — ou l'a mal classé.
 *
 * PAS DE NOUVELLE TABLE. Un ajout manuel EST une décision humaine, et le journal
 * `decisions_humaines.decisions` en porte déjà toute la sémantique : append-only, auteur, date,
 * message (`commentaire`), plateforme dérivée de la clé d'API, cloisonnement par plateforme, et
 * révocation par `supersedes`. Le réimplémenter à côté aurait produit un second journal, moins
 * bon, à tenir en phase avec le premier.
 *
 * RETIRER UN AJOUT = RÉVOQUER LA DÉCISION (verdict='annule' + supersedes). On n'invente pas de
 * verdict « retire » : il ferait double emploi avec la révocation universelle, et deux façons de
 * dire la même chose finissent toujours par diverger.
 *
 * ON NE STOCKE QUE L'IDENTIFIANT — et c'est le point délicat.
 *
 * Une aide n'est persistée nulle part : elle vit en cache Redis, rechargée à chaque requête depuis
 * Aides-territoires et filtrée par le territoire du projet. On la résout donc AU FRAIS à chaque
 * lecture, parmi les aides du périmètre. Si elle a été clôturée ou dépubliée entre-temps, elle
 * cesse simplement de s'afficher : mieux vaut ne rien montrer que d'envoyer une collectivité
 * candidater à une aide morte, ce que ferait un instantané figé.
 *
 * On ne peut pas faire mieux, et ce n'est pas un choix : Aides-territoires NE SAIT PAS récupérer
 * une aide par son id. `/aids/<id>/` répond 404, et `?id=<n>` est silencieusement IGNORÉ — la
 * requête renvoie alors le catalogue entier. Un code qui aurait fait confiance à ce paramètre
 * aurait « marché » en renvoyant n'importe quoi.
 *
 * D'où la garde à l'écriture (cf. AjoutsManuelsService.ajouterAide) : on refuse d'ajouter une aide
 * absente du périmètre du projet. Sans elle, on créerait un ajout qui ne s'afficherait JAMAIS,
 * sans le moindre message — une panne parfaitement silencieuse.
 */

/** L'unique type de décision de ce module — le vocabulaire est fermé (cf. decision-contract.ts). */
export const TYPE_AJOUT = "ajout_manuel";

export type ObjetAjoutable = "aide" | "service_numerique";

/**
 * Un service HORS catalogue, décrit par l'agent lui-même : un outil local, un service partenaire
 * pas encore benchmarké. Figé dans le payload de la décision.
 *
 * POURQUOI FIGER EST LÉGITIME ICI, ALORS QUE ÇA NE L'ÉTAIT PAS POUR UNE AIDE. Le catalogue de
 * services est LE NÔTRE : un service qui n'y figure pas existe quand même, et personne d'autre ne
 * peut le décrire — l'agent EST la source de vérité, il n'y a rien à tenir en phase. Une aide, au
 * contraire, n'existe que dans Aides-territoires : la recopier, ce serait entretenir une copie qui
 * vieillit face à une autorité qui, elle, continue d'évoluer.
 *
 * Un service DU catalogue n'est jamais recopié, pour la même raison retournée : sa fiche reste la
 * source, et elle continuera de changer (logo, description, lien). Le figer ici l'aurait dédoublé.
 */
export interface ServiceLibre {
  nom: string;
  description: string;
  url?: string;
  libelleLien?: string;
  operateur?: string;
  logoUrl?: string;
}

/** Le payload d'une décision `ajout_manuel` : présent seulement pour un service hors catalogue. */
export interface PayloadAjout {
  service?: ServiceLibre;
}

/** Ce qu'on rend au client : la trace de l'ajout, attachée à l'aide ou au service concerné. */
export interface AjoutManuel {
  /** L'id de la décision — c'est lui qu'il faut fournir pour révoquer l'ajout. */
  decisionId: string;
  /** Pourquoi cet ajout — « recommandée par la DDT lors du COPIL du 12/03 ». */
  message?: string;
  /** Qui a ajouté : la plateforme émettrice, dérivée de la clé d'API. */
  plateforme: string;
  date: string;
  /**
   * PROVENANCE, services uniquement : le service ne vient pas de notre catalogue, ses informations
   * ont été saisies par un agent. Le client peut le présenter différemment — pas de fiche chez
   * nous, pas de logo hébergé, pas de caution éditoriale.
   *
   * Ce n'est pas une information de classification : les thématiques ne servent qu'à sélectionner
   * un service pour un projet, et un ajout manuel a déjà été sélectionné, par un humain.
   */
  horsCatalogue?: boolean;
}
