import type { Contenu, Simulation } from "./types";

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

async function appeler<T>(chemin: string, corps?: unknown): Promise<T> {
  const cle = lireCle();
  if (!cle) throw new CleRefusee();

  // `/api` est réécrit par le proxy Vite (voir vite.config.ts) : pas de requête cross-origin,
  // donc rien à ouvrir côté API.
  const reponse = await fetch(`/api${chemin}`, {
    method: corps === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });

  if (reponse.status === 401) {
    oublierCle();
    throw new CleRefusee();
  }
  if (!reponse.ok) {
    const detail = (await reponse.json().catch(() => null)) as { message?: string } | null;
    throw new Error(detail?.message ?? `L'API a répondu ${reponse.status}.`);
  }
  return (await reponse.json()) as T;
}

export const getContenu = (): Promise<Contenu> => appeler<Contenu>("/admin/contenu");

export const simuler = (projetId: string, reponses?: Record<string, Record<string, string>>): Promise<Simulation> =>
  appeler<Simulation>("/admin/simuler", { projetId, ...(reponses ? { reponses } : {}) });
