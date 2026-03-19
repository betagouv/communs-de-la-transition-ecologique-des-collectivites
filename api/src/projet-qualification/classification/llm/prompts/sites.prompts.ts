/**
 * Sites classification prompts
 * Aligned with Python pipeline (llm_final_70kprojects.py / llm_final_aidesAT.py)
 */

import { sites } from "@/projet-qualification/classification/const/sites";
import { ACRONYMES } from "@/projet-qualification/classification/const/acronymes";

/**
 * Sites-specific rules (from spreadsheet "Prompt" tab, column "Prompt Lieux")
 */
const RULES_SITES = `📌 Règles à considérer en priorité :
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Toujours privilégier le lieu le plus précis et spécifique quand il y a le choix (ex: mairie > bâtiment public ou pont > ouvrage d'art)
- Si changement d'usage d'un lieu, prioriser sur l'état d'atterrissage
📌 Règles sur certains détails :
- Zone humide n'est utilisé que quand il est fait mention de biodiversité, biotope, de leur importance écologique
- Les édifices patrimoniaux traditionnels sont par exemple les lavoirs, fours, moulins…, et les édifices mémoriels sont par exemple les monuments aux morts. Mais ce ne sont pas les lieux religieux ou les monuments historiques importants.
- Une salle d'évolution peut accueillir des activités sportives, des manifestations culturelles, des activités périscolaires, des événements, des expositions et des animations associatives
- Les Micro-folies sont un mini-musée
- 'Monument historique' est utilisé quand on devine une vraie importance historique, culturelle ou patrimoniale`;

const SITES_LIST = sites.join("\n");
const ACRONYMES_LIST = ACRONYMES.map((a) => `${a.acronyme} : ${a.definition}`).join("\n");

/**
 * User prompt for project sites classification
 */
export const USER_PROMPT_SITES = `${RULES_SITES}

🎯 Objectif :
Identifier EXACTEMENT 3 **lieux** pertinents pour ce projet.

Liste autorisée LIEUX :
${SITES_LIST}

Liste des acronymes :
${ACRONYMES_LIST}

🧩 Format strict attendu :
{
  "projet": "string",
  "items": [
    {"label": "string", "score": float},
    {"label": "string", "score": float},
    {"label": "string", "score": float}
  ]
}
📌 Contraintes :
- EXACTEMENT 3 items
- Scores entre 0 et 1
- Scores triés par ordre décroissant
- Aucun texte hors JSON`;

/**
 * User prompt for aide sites classification
 */
export const USER_PROMPT_SITES_AIDE = `${RULES_SITES}

🎯 Objectif :
Attribuer un score de pertinence pour CHACUN des lieux de la liste.

Liste autorisée LIEUX :
${SITES_LIST}

Liste des acronymes :
${ACRONYMES_LIST}

🧩 Format strict attendu :
{
  "projet": "string",
  "items": [
    {"label": "string", "score": float},
    {"label": "string", "score": float},
    ...
  ]
}
📌 Contraintes :
- Retourner UNIQUEMENT les items ayant un score > 0.
- Si aucun item n'a de score > 0, retourner les 5 items les plus pertinents avec un score faible.
- Scores entre 0 et 1
- Scores triés par ordre décroissant
- Aucun texte hors JSON`;
