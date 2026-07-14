import type { AjoutManuel } from "./ajout-manuel-contract";

/**
 * LA POLITIQUE D'AFFICHAGE DES AJOUTS MANUELS, définie UNE FOIS.
 *
 * Elle s'applique à l'identique aux aides et aux services numériques :
 *
 *  1. Les ajouts manuels remontent EN TÊTE. Quelqu'un les a délibérément mis là.
 *  2. Ils ÉCHAPPENT au score et au seuil — les soumettre au filtre qui les a ratés serait absurde,
 *     puisque c'est précisément parce qu'il les ratait qu'un humain est intervenu.
 *  3. Un objet à la fois retenu par le moteur ET ajouté à la main n'apparaît QU'UNE fois, avec sa
 *     marque d'ajout. Le dédoublonnage se fait ici, pas dans le client : sinon chaque consommateur
 *     devrait le refaire, et finirait par l'oublier.
 *  4. Un ajout qu'on ne sait plus résoudre (aide clôturée, service retiré du catalogue) disparaît
 *     simplement. On ne fabrique rien.
 *
 * ELLE ÉTAIT ÉCRITE DEUX FOIS, et elle avait déjà divergé : côté aides le dédoublonnage se faisait
 * après le classement, côté services avant le scoring. Deux formes pour une seule règle, dès le
 * premier jour. Le jour où l'on décidera de trier par date d'ajout, un seul des deux endpoints
 * aurait changé — et rien n'aurait cassé.
 *
 * Ce qui varie légitimement par domaine, c'est le RÉSOLVEUR (id → objet) : la liste du périmètre
 * pour une aide, le catalogue ou le payload pour un service. C'est le seul paramètre.
 */
export function fondreAjouts<T>(options: {
  /** Les ajouts actifs du projet, indexés par identifiant d'objet. */
  ajouts: Map<string, { ajout: AjoutManuel }>;
  /** id → objet affichable, déjà marqué. `undefined` si l'ajout n'est plus résoluble. */
  resoudre: (id: string, ajout: AjoutManuel) => T | undefined;
  /** Les objets retenus par le moteur, déjà triés par pertinence. */
  duMoteur: T[];
  /** L'identifiant d'un objet, pour le dédoublonnage. */
  idDe: (objet: T) => string;
  /** Le nom d'un objet, pour trier les ajouts entre eux (le score ne les départage pas). */
  nomDe: (objet: T) => string;
}): T[] {
  const { ajouts, resoudre, duMoteur, idDe, nomDe } = options;

  if (ajouts.size === 0) return duMoteur;

  const manuels: T[] = [];
  for (const [id, { ajout }] of ajouts) {
    const objet = resoudre(id, ajout);
    if (objet) manuels.push(objet);
  }
  manuels.sort((a, b) => nomDe(a).localeCompare(nomDe(b)));

  const idsManuels = new Set(manuels.map(idDe));
  return [...manuels, ...duMoteur.filter((o) => !idsManuels.has(idDe(o)))];
}
