import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AideClassification } from "@/aides/dto/aides.dto";
import { CustomLogger } from "@logging/logger.service";
import { QUESTIONNAIRES } from "./content";
import { SEUIL_ELIGIBILITE } from "./questionnaires.service";

// L'éligibilité d'un questionnaire n'est PAS une règle booléenne : c'est un score, calculé
// par le même moteur que le matching des aides (thématiques 0.45, sites 0.35, interventions
// 0.20, seuils de confiance à 0.8). Ces tests pinnent le comportement du scoring sur la
// classification réelle des quatre questionnaires — c'est ce qui décide de ce qu'une
// collectivité voit s'afficher.

const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as CustomLogger;
const matching = new AidesMatchingService(logger);

const classifications = new Map<string, AideClassification>(QUESTIONNAIRES.map((q) => [q.slug, q.classification]));

/** Reproduit exactement la sélection de QuestionnairesService.questionnairesEligibles. */
const questionnairesProposes = (projet: AideClassification): { slug: string; score: number }[] =>
  matching
    .match(projet, classifications, QUESTIONNAIRES.length)
    .filter((m) => m.normalizedScore >= SEUIL_ELIGIBILITE)
    .map((m) => ({ slug: m.idAt, score: m.normalizedScore }));

const projet = (p: Partial<AideClassification>): AideClassification => ({
  thematiques: [],
  sites: [],
  interventions: [],
  ...p,
});

describe("Éligibilité des questionnaires (scoring)", () => {
  it("propose AtoutBiodiv-salle à un projet de salle des fêtes", () => {
    const proposes = questionnairesProposes(
      projet({
        sites: [{ label: "Salle des fêtes, salle associative, pôle musical", score: 0.95 }],
        interventions: [{ label: "Construction bâtiment", score: 0.9 }],
      }),
    );

    expect(proposes.map((p) => p.slug)).toEqual(["atoutbiodiv-salle"]);
    expect(proposes[0].score).toBeGreaterThan(0.8);
  });

  it("propose AtoutBiodiv-place à un projet de réaménagement de centre-bourg", () => {
    const proposes = questionnairesProposes(
      projet({
        thematiques: [{ label: "Végétalisation d'espaces publics", score: 0.95 }],
        sites: [{ label: "Place ou centre-bourg", score: 0.9 }],
        interventions: [{ label: "Aménagement urbain et restructuration", score: 0.9 }],
      }),
    );

    expect(proposes[0].slug).toBe("atoutbiodiv-place");
  });

  it("propose AtoutBiodiv-piste à un projet de voie cyclable", () => {
    const proposes = questionnairesProposes(
      projet({
        thematiques: [{ label: "Vélo (mobilité douce)", score: 0.95 }],
        interventions: [{ label: "Construction sauf bâtiment (voirie, ...)", score: 0.9 }],
      }),
    );

    expect(proposes.map((p) => p.slug)).toEqual(["atoutbiodiv-piste"]);
  });

  it("propose AtoutBiodiv-solaire à un projet de panneaux solaires sur une école", () => {
    const proposes = questionnairesProposes(
      projet({
        thematiques: [{ label: "Agrivoltaïsme, panneaux solaires sur le bâti", score: 0.95 }],
        sites: [{ label: "Ecole", score: 0.95 }],
      }),
    );

    expect(proposes[0].slug).toBe("atoutbiodiv-solaire");
  });

  it("ne propose rien à un projet hors sujet (piscine)", () => {
    // Le projet partage pourtant une intervention (« Rénovation bâtiment ») avec deux
    // questionnaires : c'est le SEUIL qui l'écarte, pas l'absence totale de recouvrement.
    // Un simple test d'intersection non vide aurait proposé AtoutBiodiv à tort.
    const scoresProjet = projet({
      sites: [{ label: "Piscine", score: 0.95 }],
      interventions: [{ label: "Rénovation bâtiment", score: 0.9 }],
    });

    expect(questionnairesProposes(scoresProjet)).toEqual([]);

    const tousLesScores = matching.match(scoresProjet, classifications, QUESTIONNAIRES.length);
    expect(tousLesScores.some((m) => m.normalizedScore > 0)).toBe(true);
    expect(Math.max(...tousLesScores.map((m) => m.normalizedScore))).toBeLessThan(SEUIL_ELIGIBILITE);
  });

  it("ne propose rien à un projet sans aucun recouvrement", () => {
    expect(questionnairesProposes(projet({ sites: [{ label: "Barrage", score: 0.95 }] }))).toEqual([]);
  });

  it("ne propose rien à un projet non classifié", () => {
    expect(questionnairesProposes(projet({}))).toEqual([]);
  });

  it("ignore les étiquettes du projet sous le seuil de confiance de 0.8", () => {
    // Une classification LLM peu sûre ne doit pas déclencher un questionnaire.
    const peuSur = projet({
      sites: [{ label: "Salle des fêtes, salle associative, pôle musical", score: 0.5 }],
    });

    expect(questionnairesProposes(peuSur)).toEqual([]);
  });

  it("peut proposer plusieurs questionnaires à un projet à cheval sur deux domaines", () => {
    // Réaménagement d'une place AVEC végétalisation d'école adjacente : les deux
    // questionnaires sont légitimes, et l'API les renvoie tous les deux.
    const proposes = questionnairesProposes(
      projet({
        thematiques: [
          { label: "Végétalisation d'espaces publics", score: 0.95 },
          { label: "Agrivoltaïsme, panneaux solaires sur le bâti", score: 0.9 },
        ],
        sites: [
          { label: "Place ou centre-bourg", score: 0.9 },
          { label: "Ecole", score: 0.9 },
        ],
      }),
    );

    expect(proposes.length).toBeGreaterThanOrEqual(2);
    expect(proposes.map((p) => p.slug)).toEqual(expect.arrayContaining(["atoutbiodiv-place", "atoutbiodiv-solaire"]));
  });

  it("trie par score décroissant : le questionnaire le plus pertinent d'abord", () => {
    const proposes = questionnairesProposes(
      projet({
        thematiques: [{ label: "Végétalisation d'espaces publics", score: 0.95 }],
        sites: [
          { label: "Place ou centre-bourg", score: 0.95 },
          { label: "Ecole", score: 0.85 },
        ],
      }),
    );

    const scores = proposes.map((p) => p.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});
