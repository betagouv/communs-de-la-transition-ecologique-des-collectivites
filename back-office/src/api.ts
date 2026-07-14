import type { Contenu, QuestionnaireEdition, Simulation, Taxonomies } from "./types";

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

  // `/api` est réécrit par le proxy Vite (voir vite.config.ts) : pas de requête cross-origin,
  // donc rien à ouvrir côté API.
  const reponse = await fetch(`/api${chemin}`, {
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
