/**
 * Thematiques classification prompts
 * Aligned with Python pipeline (llm_final_70kprojects.py / llm_final_aidesAT.py)
 */

import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import { ACRONYMES } from "@/projet-qualification/classification/const/acronymes";

/**
 * Thematiques-specific rules (from spreadsheet "Prompt" tab, column "Prompt Thématiques")
 */
const RULES_THEMATIQUES = `📌 Règles à considérer en priorité :
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Préciser rénovation énergétique seulement si le projet précise une volonté de réduction explicite de la consommation d'énergie.
- Si un site ou un bâtiment avait auparavant un usage (gare, friche, boulangerie, ...) et est transformé pour un usage complètement différent, utiliser 'Mutabilité, changement de fonction d'un bâtiment ou d'un site'
- L'Accessibilité ne concerne que les sujets handicap ou PMR explicitement mentionnés.
- Le Résidentiel concerne le logement, le tertiaire concerne les services publics, commerce, culture, sport, santé…
- Ne pas mettre 'Parc immobilier détenu par un acteur public' si il n'y qu'un bâtiment
- Toujours privilégier la thématique la plus précise. Si par exemple "Tourisme" et "Tourisme décarboné" conviennent, choisir "Tourisme décarboné"
- N'indiquer "Adaptation au changement climatique" seulement si il y fait explicitement référence
📌 Règles sur certains détails :
- Une salle d'évolution peut accueillir des activités sportives, des manifestations culturelles, des activités périscolaires, des événements, des expositions et des animations associatives`;

const THEMATIQUES_LIST = thematiques.join("\n");
const ACRONYMES_LIST = ACRONYMES.map((a) => `${a.acronyme} : ${a.definition}`).join("\n");

/**
 * User prompt for project thematiques classification
 * Adapted from Python batch prompt to single-project format
 */
export const USER_PROMPT_THEMATIQUES = `${RULES_THEMATIQUES}

🎯 Objectif :
Identifier EXACTEMENT 3 **thématiques** pertinentes pour ce projet.

Liste autorisée THÉMATIQUES :
${THEMATIQUES_LIST}

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
 * User prompt for aide thematiques classification
 * Adapted from Python llm_final_aidesAT.py
 */
export const USER_PROMPT_THEMATIQUES_AIDE = `${RULES_THEMATIQUES}

🎯 Objectif :
Attribuer un score de pertinence pour CHACUNE des thématiques de la liste.

Liste autorisée THÉMATIQUES :
${THEMATIQUES_LIST}

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
