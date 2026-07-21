import type { Apercu, Contenu, QuestionnaireEdition, ReglagesAides, Simulation, Taxonomies } from "./types";

/**
 * La clé d'administration vit en sessionStorage, jamais en localStorage : elle disparaît à la
 * fermeture de l'onglet. Elle n'est ni dans un `.env`, ni dans le bundle, ni dans le dépôt —
 * c'est la même clé que celle qui pilote la classification par lots, on ne la laisse pas traîner.
 */
const CLE = "communs.back-office.cle";

export const lireCle = (): string | null => sessionStorage.getItem(CLE);
export const ecrireCle = (cle: string): void => sessionStorage.setItem(CLE, cle);
export const oublierCle = (): void => sessionStorage.removeItem(CLE);

/** Levée sur 401 : la clé est mauvaise, il faut la redemander plutôt qu'afficher une erreur muette. */
export class CleRefusee extends Error {
  constructor() {
    super("Clé d'administration refusée.");
  }
}

async function appeler<T>(chemin: string, corps?: unknown, methode?: "GET" | "POST" | "PUT" | "DELETE"): Promise<T> {
  const cle = lireCle();
  if (!cle) throw new CleRefusee();

  // EN DEV : le proxy Vite réécrit `/api` → l'API cible (VITE_API_TARGET), donc pas de CORS.
  // EN PROD : le back-office est servi PAR l'API (même origine), on appelle donc `/admin/…`
  // directement, sans préfixe. `import.meta.env.DEV` distingue les deux sans configuration.
  const base = import.meta.env.DEV ? "/api" : "";
  const reponse = await fetch(`${base}${chemin}`, {
    method: methode ?? (corps === undefined ? "GET" : "POST"),
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });

  if (reponse.status === 401) {
    oublierCle();
    throw new CleRefusee();
  }
  if (!reponse.ok) {
    // Le message de l'API est TOUT ce qu'a la personne qui édite : elle n'a pas accès au code.
    // « lieu « Place ou centre bourg » hors de la taxonomie » se corrige ; « erreur 400 » non.
    const detail = (await reponse.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(detail?.message) ? detail.message.join(" ") : detail?.message;
    throw new Error(message ?? `L'API a répondu ${reponse.status}.`);
  }
  // 204 (suppression) n'a pas de corps.
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

export const getContenu = (): Promise<Contenu> => appeler<Contenu>("/admin/contenu");

export const simuler = (projetId: string, reponses?: Record<string, Record<string, string>>): Promise<Simulation> =>
  appeler<Simulation>("/admin/simuler", { projetId, ...(reponses ? { reponses } : {}) });

export const getTaxonomies = (): Promise<Taxonomies> => appeler<Taxonomies>("/admin/taxonomies");

export const enregistrerQuestionnaire = (slug: string, def: QuestionnaireEdition): Promise<unknown> =>
  appeler("/admin/questionnaires/" + encodeURIComponent(slug), def, "PUT");

export const supprimerQuestionnaire = (slug: string): Promise<void> =>
  appeler<void>("/admin/questionnaires/" + encodeURIComponent(slug), undefined, "DELETE");

/**
 * Ce que l'API renvoie RÉELLEMENT à `plateforme`, pour ce projet.
 *
 * L'endpoint appelle les MÊMES fonctions que les endpoints publics : rien n'est reconstitué ici, ni
 * côté serveur. La plateforme est obligatoire — les ajouts manuels et les arbitrages sont cloisonnés
 * par plateforme, et sans elle on afficherait une liste que personne ne reçoit.
 */
export const apercu = (
  projetId: string,
  plateforme: string,
  aides: ReglagesAides,
  seuilServices?: number,
): Promise<Apercu> => appeler<Apercu>("/admin/apercu", { projetId, plateforme, aides, seuilServices });

// ------------------------------------------------------------
// AJOUTS MANUELS depuis le back-office.
//
// Les endpoints partenaires déduisent la plateforme de la clé d'API — c'est ce qui empêche un
// service de se faire passer pour un autre. Le back-office n'est aucune plateforme : il porte la
// clé d'administration, et doit donc DÉCLARER au nom de qui il agit. Aucune règle n'est réécrite
// côté serveur : les mêmes gardes s'appliquent (aide sur le périmètre, slug au catalogue).
// ------------------------------------------------------------

export const ajouterAide = (
  projetId: string,
  plateforme: string,
  aideId: number,
  message?: string,
): Promise<{ decisionId: string }> =>
  // `trim() || undefined` : une chaîne vide n'est pas un message. `??` ne la filtrerait pas.
  appeler("/admin/ajouts/aide", { projetId, plateforme, aideId, message: message?.trim() ? message : undefined });

export const ajouterService = (
  projetId: string,
  plateforme: string,
  slug: string,
  message?: string,
): Promise<{ decisionId: string }> =>
  appeler("/admin/ajouts/service", { projetId, plateforme, slug, message: message?.trim() ? message : undefined });

/**
 * Un service HORS CATALOGUE, décrit par l'agent lui-même.
 *
 * LÉGITIME ICI, ET PAS POUR UNE AIDE : le catalogue de services est LE NÔTRE. Un service qui n'y
 * figure pas existe quand même — un outil local, un service partenaire pas encore benchmarké — et
 * personne d'autre que l'agent ne peut le décrire. Une aide, elle, n'existe que dans
 * Aides-territoires : hors de là, aucune autorité ne la valide, et nous n'aurions aucun moyen de la
 * tenir à jour.
 */
export const ajouterServiceLibre = (
  projetId: string,
  plateforme: string,
  service: { nom: string; description: string; url?: string; operateur?: string },
  message?: string,
): Promise<{ decisionId: string }> =>
  appeler("/admin/ajouts/service", {
    projetId,
    plateforme,
    service,
    message: message?.trim() ? message : undefined,
  });

export const retirerAjout = (decisionId: string, plateforme: string): Promise<unknown> =>
  appeler(`/admin/ajouts/${decisionId}?plateforme=${encodeURIComponent(plateforme)}`, undefined, "DELETE");
