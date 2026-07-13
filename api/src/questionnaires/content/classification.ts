import { AideClassification } from "@/aides/dto/aides.dto";
import type { Intervention } from "@/projet-qualification/classification/const/interventions";
import type { Site } from "@/projet-qualification/classification/const/sites";
import type { Thematique } from "@/projet-qualification/classification/const/thematiques";

/**
 * Classification des questionnaires sur les trois axes du schéma commun.
 *
 * POURQUOI CE FICHIER EXISTE. Les fichiers partenaires portent un bloc `eligibilite`
 * ({ thematiques: ["Équipements et services publics"], competences: [] }) qui emploie le
 * vocabulaire thématique de MEC. Ce vocabulaire n'existe PAS dans les taxonomies fermées de
 * l'API, bien plus fines (137 thématiques : « Voirie », « Sobriété énergétique », « Vélo
 * (mobilité douce) »…). Une règle booléenne sur ces libellés n'aurait matché aucun projet.
 *
 * L'éligibilité est donc décidée par Communs (spec §2 : « toute la logique métier vit dans
 * Communs »), par le MÊME moteur de score que les aides (AidesMatchingService) : le
 * questionnaire est classifié comme l'est une aide, et son score de matching contre la
 * classification du projet décide s'il est proposé.
 *
 * Le typage sur Thematique/Site/Intervention est volontaire : une étiquette hors taxonomie
 * ne compile pas. Les scores sont ceux d'un contenu éditorialisé à la main — 1.0 quand le
 * questionnaire porte frontalement sur l'étiquette, plus bas quand elle n'est qu'adjacente.
 */

type Etiquettes<T extends string> = { label: T; score: number }[];

interface ClassificationQuestionnaire extends AideClassification {
  thematiques: Etiquettes<Thematique>;
  sites: Etiquettes<Site>;
  interventions: Etiquettes<Intervention>;
}

export const CLASSIFICATIONS: Record<string, ClassificationQuestionnaire> = {
  // Salle des fêtes / salle associative : construction ou rénovation d'un équipement public,
  // avec des abords (parking, cheminements) qui sont le principal levier biodiversité.
  "atoutbiodiv-salle": {
    thematiques: [
      { label: "Végétalisation d'espaces publics", score: 0.9 },
      { label: "Gestion des eaux pluviales", score: 0.85 },
    ],
    sites: [
      { label: "Salle des fêtes, salle associative, pôle musical", score: 1.0 },
      { label: "Bâtiment public", score: 0.9 },
    ],
    interventions: [
      { label: "Construction bâtiment", score: 0.9 },
      { label: "Rénovation bâtiment", score: 0.85 },
    ],
  },

  // Voie verte / piste cyclable : l'axe « sites » est faible (la taxonomie n'a pas de site
  // « piste cyclable »), le poids porte donc sur les thématiques mobilité douce et voirie.
  "atoutbiodiv-piste": {
    thematiques: [
      { label: "Vélo (mobilité douce)", score: 1.0 },
      { label: "Voirie", score: 0.85 },
      { label: "Randonnée, vélo tourisme, VTT", score: 0.8 },
    ],
    sites: [{ label: "Stationnements pour vélos", score: 0.8 }],
    interventions: [
      { label: "Construction sauf bâtiment (voirie, ...)", score: 0.9 },
      { label: "Rénovation sauf bâtiment (voirie, ...)", score: 0.85 },
    ],
  },

  // Place / centre-bourg : désimperméabilisation et végétalisation d'un espace public.
  "atoutbiodiv-place": {
    thematiques: [
      { label: "Végétalisation d'espaces publics", score: 1.0 },
      { label: "Gestion des eaux pluviales", score: 0.9 },
    ],
    sites: [{ label: "Place ou centre-bourg", score: 1.0 }],
    interventions: [{ label: "Aménagement urbain et restructuration", score: 0.95 }],
  },

  // Panneaux solaires sur une école : toiture (végétalisation en complément des panneaux),
  // cour à désimperméabiliser, volet pédagogique.
  "atoutbiodiv-solaire": {
    thematiques: [
      { label: "Agrivoltaïsme, panneaux solaires sur le bâti", score: 1.0 },
      { label: "Végétalisation d'espaces publics", score: 0.8 },
    ],
    sites: [
      { label: "Ecole", score: 1.0 },
      { label: "Bâtiment public", score: 0.85 },
    ],
    interventions: [{ label: "Rénovation bâtiment", score: 0.85 }],
  },
};
