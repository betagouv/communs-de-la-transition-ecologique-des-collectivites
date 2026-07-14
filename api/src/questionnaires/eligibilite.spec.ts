import { AideClassification } from "@/aides/dto/aides.dto";
import { QUESTIONNAIRES } from "./content";
import { SEUIL_CONFIANCE } from "./content/classification";
import { etiquettesManquantes } from "./questionnaires.service";

/**
 * L'éligibilité d'un questionnaire est un CRITÈRE, pas un score : le projet porte-t-il TOUTES les
 * étiquettes qui définissent le questionnaire, avec une confiance ≥ 0,8 ?
 *
 * POURQUOI PAS UN SCORE. Le moteur de matching des aides a été essayé ici, et il échoue pour une
 * raison structurelle : il normalise par le maximum du PROJET. Deux projets portant tous deux
 * « Place ou centre-bourg » obtenaient 1,00 et 0,11 selon que leur classification était pauvre ou
 * riche — le second était écarté alors qu'il est bel et bien une place. Le test « espace
 * commercial » ci-dessous verrouille précisément cette régression.
 *
 * Les trois premiers cas sont les classifications RÉELLES de trois projets de staging, telles que
 * le job LLM les a produites. Pas des cas inventés : un projet composé à la main est trop propre,
 * et il dit ce qu'on veut entendre.
 */

const proposes = (projet: AideClassification): string[] =>
  QUESTIONNAIRES.filter((def) => etiquettesManquantes(projet, def.etiquettesRequises).length === 0).map((d) => d.slug);

const projet = (p: Partial<AideClassification>): AideClassification => ({
  thematiques: [],
  sites: [],
  interventions: [],
  ...p,
});

// Classification réelle du projet « Salle des fêtes » (staging).
const SALLE_REELLE = projet({
  thematiques: [
    { label: "Parc immobilier détenu par un acteur public", score: 0.4 },
    { label: "Cohésion sociale et inclusion", score: 0.35 },
  ],
  sites: [
    { label: "Salle des fêtes, salle associative, pôle musical", score: 0.98 },
    { label: "Salle de sport ou gymnase", score: 0.45 },
    { label: "Bâtiment public", score: 0.3 },
  ],
  interventions: [
    { label: "Construction bâtiment", score: 0.75 },
    { label: "Rénovation bâtiment", score: 0.65 },
  ],
});

// Classification réelle du projet « Création d'un espace commercial » (staging) : RICHE — cinq
// étiquettes au-dessus du seuil de confiance, réparties sur les trois axes.
const COMMERCIAL_REEL = projet({
  thematiques: [{ label: "Attractivité économique", score: 0.9 }],
  sites: [
    { label: "Commerce, restaurant, café de proximité, ou multiple rural", score: 0.98 },
    { label: "Place ou centre-bourg", score: 0.82 },
  ],
  interventions: [
    { label: "Construction bâtiment", score: 0.85 },
    { label: "Dynamisation", score: 0.8 },
  ],
});

// Classification réelle du projet « Ceci est une friche » (staging).
const FRICHE_REELLE = projet({
  thematiques: [
    { label: "Mutabilité, changement de fonction d'un bâtiment ou d'un site", score: 0.95 },
    { label: "Friche", score: 0.95 },
  ],
  interventions: [
    { label: "Aménagement urbain et restructuration", score: 0.85 },
    { label: "Rénovation bâtiment", score: 0.8 },
  ],
});

describe("Éligibilité des questionnaires (règle par étiquette)", () => {
  describe("Sur les projets réels de staging", () => {
    it("propose AtoutBiodiv-salle au projet de salle des fêtes", () => {
      expect(proposes(SALLE_REELLE)).toEqual(["atoutbiodiv-salle"]);
    });

    it("propose AtoutBiodiv-place au projet d'espace commercial, qui EST une place", () => {
      // LA RÉGRESSION À VERROUILLER. Ce projet porte « Place ou centre-bourg » à 0,82. Avec le
      // score normalisé, il obtenait 0,11 — sous le seuil — et le questionnaire était écarté,
      // uniquement parce que sa classification est riche sur les autres axes.
      expect(proposes(COMMERCIAL_REEL)).toEqual(["atoutbiodiv-place"]);
    });

    it("ne propose rien au projet de friche", () => {
      expect(proposes(FRICHE_REELLE)).toEqual([]);
    });
  });

  describe("Seuil de confiance", () => {
    it("ignore une étiquette dont le job LLM n'est pas sûr", () => {
      // Même seuil que pour les aides : en dessous, le modèle hésite, on n'agit pas dessus.
      expect(proposes(projet({ sites: [{ label: "Place ou centre-bourg", score: SEUIL_CONFIANCE - 0.01 }] }))).toEqual(
        [],
      );

      expect(proposes(projet({ sites: [{ label: "Place ou centre-bourg", score: SEUIL_CONFIANCE }] }))).toEqual([
        "atoutbiodiv-place",
      ]);
    });
  });

  describe("Conjonction, sur AtoutBiodiv-solaire", () => {
    const SOLAIRE = { label: "Agrivoltaïsme, panneaux solaires sur le bâti", score: 0.95 };
    const ECOLE = { label: "Ecole", score: 0.95 };

    it("exige les DEUX étiquettes : école ET solaire", () => {
      expect(proposes(projet({ thematiques: [SOLAIRE], sites: [ECOLE] }))).toEqual(["atoutbiodiv-solaire"]);
    });

    it("n'attrape pas n'importe quelle installation solaire", () => {
      expect(proposes(projet({ thematiques: [SOLAIRE] }))).toEqual([]);
    });

    it("n'attrape pas n'importe quel projet d'école", () => {
      expect(proposes(projet({ sites: [ECOLE] }))).toEqual([]);
    });

    it("dit LAQUELLE des deux étiquettes manque", () => {
      const requises = QUESTIONNAIRES.find((q) => q.slug === "atoutbiodiv-solaire")!.etiquettesRequises;

      // « il manque la thématique X » se corrige. « score 0,11 » ne se corrige pas.
      expect(etiquettesManquantes(projet({ sites: [ECOLE] }), requises)).toEqual([
        { axe: "thematiques", label: "Agrivoltaïsme, panneaux solaires sur le bâti" },
      ]);
    });
  });

  describe("Projet non classifié", () => {
    it("ne propose aucun questionnaire", () => {
      // Le garde qui compte vraiment est ailleurs (content/index.ts refuse de démarrer si un
      // questionnaire n'exige AUCUNE étiquette — une conjonction vide est vraie, il serait alors
      // proposé à tout le monde). Ici on vérifie l'autre bout : un projet vide ne matche rien.
      expect(proposes(projet({}))).toEqual([]);
    });
  });
});
