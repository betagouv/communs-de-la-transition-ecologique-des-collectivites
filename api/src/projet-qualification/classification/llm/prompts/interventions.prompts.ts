/**
 * Interventions classification prompts
 * Aligned with Python pipeline (llm_final_70kprojects.py / llm_final_aidesAT.py)
 */

import { interventions } from "@/projet-qualification/classification/const/interventions";
import { ACRONYMES } from "@/projet-qualification/classification/const/acronymes";

/**
 * Interventions-specific rules (from spreadsheet "Prompt" tab, column "Prompt Modalités")
 */
const RULES_INTERVENTIONS = `📌 Règles à considérer en priorité :
- On parle de "Structuration du financement" dès qu'on se demande comment inciter financièrement, ou qu'il y a clairement une mention faite des sujets financiers dans l'intitulé
- Si rien dans la liste ne semble bien correspondre, ne pas hésiter à ne rien mettre ou de mettre un score très bas (moins de 0.5)
- Tout ce qui est création de campus ou lié à la formation professionnelle doit avoir "Formation" comme modalité
- Quand le projet parle d'un programme, c'est probablement associé à Stratégie/Plan`;

const INTERVENTIONS_LIST = interventions.join("\n");
const ACRONYMES_LIST = ACRONYMES.map((a) => `${a.acronyme} : ${a.definition}`).join("\n");

/**
 * User prompt for project interventions classification
 */
export const USER_PROMPT_INTERVENTIONS = `${RULES_INTERVENTIONS}

🎯 Objectif :
Identifier EXACTEMENT 3 **modalités** pertinentes pour ce projet.

Liste autorisée MODALITÉS :
${INTERVENTIONS_LIST}

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
 * User prompt for aide interventions classification
 */
export const USER_PROMPT_INTERVENTIONS_AIDE = `${RULES_INTERVENTIONS}

🎯 Objectif :
Attribuer un score de pertinence pour CHACUNE des modalités de la liste.

Liste autorisée MODALITÉS :
${INTERVENTIONS_LIST}

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
