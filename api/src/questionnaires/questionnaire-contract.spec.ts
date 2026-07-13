import { calculerStatut, evaluerCondition, reconcilierReponses, type QuestionnaireDef } from "./questionnaire-contract";

const def = (): QuestionnaireDef => ({
  slug: "test",
  version: 1,
  source: { nom: "Test" },
  banniere: { titre: "T", sousTitre: "ST" },
  classification: { thematiques: [], sites: [], interventions: [] },
  questions: [
    {
      id: "q1",
      type: "choix-unique",
      intitule: "Q1 ?",
      options: [
        { id: "a", libelle: "A", signal: "favorable" },
        { id: "b", libelle: "B", signal: "neutre" },
      ],
    },
    {
      id: "q2",
      type: "choix-unique",
      intitule: "Q2 ?",
      options: [
        { id: "x", libelle: "X", signal: "vigilance" },
        { id: "y", libelle: "Y", signal: "neutre" },
      ],
    },
  ],
  recommandations: [],
});

describe("evaluerCondition", () => {
  it("une condition `true` est toujours satisfaite, même sans aucune réponse", () => {
    expect(evaluerCondition(true, {})).toBe(true);
  });

  it("est satisfaite quand la réponse figure dans `parmi`", () => {
    expect(evaluerCondition({ question: "q1", parmi: ["a", "b"] }, { q1: "a" })).toBe(true);
  });

  it("n'est pas satisfaite quand la réponse est hors de `parmi`", () => {
    expect(evaluerCondition({ question: "q1", parmi: ["a"] }, { q1: "b" })).toBe(false);
  });

  it("n'est pas satisfaite quand la question n'est pas répondue", () => {
    expect(evaluerCondition({ question: "q1", parmi: ["a"] }, {})).toBe(false);
    expect(evaluerCondition({ question: "q1", parmi: ["a"] }, { q2: "x" })).toBe(false);
  });
});

describe("calculerStatut", () => {
  it("non_commence sans aucune réponse", () => {
    expect(calculerStatut(def(), {})).toBe("non_commence");
  });

  it("en_cours sur réponse partielle", () => {
    expect(calculerStatut(def(), { q1: "a" })).toBe("en_cours");
  });

  it("complet quand toutes les questions sont répondues", () => {
    expect(calculerStatut(def(), { q1: "a", q2: "x" })).toBe("complet");
  });

  it("ignore les réponses à des questions inconnues pour le comptage", () => {
    // Une réponse orpheline (question supprimée d'une version à l'autre) ne doit pas
    // faire passer le questionnaire pour « complet ».
    expect(calculerStatut(def(), { q1: "a", qFantome: "z" })).toBe("en_cours");
  });
});

describe("reconcilierReponses", () => {
  it("conserve les réponses encore interprétables", () => {
    expect(reconcilierReponses(def(), { q1: "a", q2: "y" })).toEqual({ q1: "a", q2: "y" });
  });

  it("écarte une réponse dont la question a disparu de la définition", () => {
    expect(reconcilierReponses(def(), { q1: "a", qSupprimee: "a" })).toEqual({ q1: "a" });
  });

  it("écarte une réponse dont l'option a disparu de la question", () => {
    // C'est ce qui rend un bump de `version` non destructeur : pas de migration de données,
    // les réponses devenues ininterprétables sont simplement ignorées à la lecture.
    expect(reconcilierReponses(def(), { q1: "optionSupprimee", q2: "x" })).toEqual({ q2: "x" });
  });

  it("renvoie un objet vide quand plus rien n'est interprétable", () => {
    expect(reconcilierReponses(def(), { qFantome: "z" })).toEqual({});
  });
});
