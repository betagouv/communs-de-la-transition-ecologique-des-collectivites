import { interventions } from "@/projet-qualification/classification/const/interventions";
import { sites } from "@/projet-qualification/classification/const/sites";
import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import type { QuestionnaireFichier } from "../questionnaire-contract";
import { assembler, QUESTIONNAIRES } from "./index";
import { ETIQUETTES_REQUISES } from "./classification";

// Ces tests portent sur le CONTENU (JSON partenaire + classification Communs). Ils sont le
// filet qui protège une PR de contenu : une coquille dans un id de question, une option
// inexistante dans une condition, une étiquette hors taxonomie, un doublon d'id — autant de
// fautes qui, sans eux, ne se verraient qu'en production par une recommandation qui ne
// s'affiche jamais.

describe("Contenu des questionnaires", () => {
  it("charge les quatre questionnaires AtoutBiodiv", () => {
    expect(QUESTIONNAIRES.map((q) => q.slug).sort()).toEqual([
      "atoutbiodiv-piste",
      "atoutbiodiv-place",
      "atoutbiodiv-salle",
      "atoutbiodiv-solaire",
    ]);
  });

  it("expose 22 recommandations au total", () => {
    const total = QUESTIONNAIRES.reduce((n, q) => n + q.recommandations.length, 0);
    expect(total).toBe(22);
  });

  it.each(QUESTIONNAIRES.map((q) => [q.slug, q] as const))("%s : structure valide", (_slug, def) => {
    expect(def.version).toBeGreaterThanOrEqual(1);
    expect(def.source.nom).toBeTruthy();
    expect(def.banniere.titre).toBeTruthy();
    expect(def.questions.length).toBeGreaterThan(0);

    for (const question of def.questions) {
      expect(question.type).toBe("choix-unique");
      // La spec impose au moins deux options : une question à option unique n'est pas un choix.
      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(QUESTIONNAIRES.map((q) => [q.slug, q] as const))("%s : ids uniques", (_slug, def) => {
    const idsQuestions = def.questions.map((q) => q.id);
    expect(new Set(idsQuestions).size).toBe(idsQuestions.length);

    for (const question of def.questions) {
      const idsOptions = question.options.map((o) => o.id);
      expect(new Set(idsOptions).size).toBe(idsOptions.length);
    }

    const idsRecos = def.recommandations.map((r) => r.id);
    expect(new Set(idsRecos).size).toBe(idsRecos.length);
  });

  it.each(QUESTIONNAIRES.map((q) => [q.slug, q] as const))(
    "%s : chaque condition pointe une question et des options existantes",
    (_slug, def) => {
      for (const reco of def.recommandations) {
        const { condition } = reco;
        if (condition === true) continue;

        const question = def.questions.find((q) => q.id === condition.question);
        expect(question).toBeDefined();

        const optionsConnues = question!.options.map((o) => o.id);
        for (const option of condition.parmi) {
          expect(optionsConnues).toContain(option);
        }
      }
    },
  );

  it.each(QUESTIONNAIRES.map((q) => [q.slug, q] as const))(
    "%s : toute recommandation porte financements, ressources et engagement",
    (_slug, def) => {
      for (const reco of def.recommandations) {
        expect(reco.titre).toBeTruthy();
        expect(reco.description).toBeTruthy();
        expect(reco.engagement).toBeTruthy();
        expect(Array.isArray(reco.financements)).toBe(true);
        expect(Array.isArray(reco.ressources)).toBe(true);

        for (const financement of reco.financements) {
          expect(financement.url).toMatch(/^https?:\/\//);
        }
        for (const ressource of reco.ressources) {
          expect(ressource.url).toMatch(/^https?:\/\//);
        }
      }
    },
  );

  it("chaque questionnaire exige au moins une étiquette", () => {
    for (const def of QUESTIONNAIRES) {
      expect(ETIQUETTES_REQUISES[def.slug]).toBeDefined();
      // Une conjonction VIDE est vraie : un questionnaire sans étiquette requise serait proposé
      // à TOUS les projets. C'est le pire cas, et il doit être impossible.
      const nbEtiquettes =
        def.etiquettesRequises.thematiques.length +
        def.etiquettesRequises.sites.length +
        def.etiquettesRequises.interventions.length;
      expect(nbEtiquettes).toBeGreaterThan(0);
    }
  });

  it("les étiquettes requises appartiennent aux taxonomies fermées", () => {
    const referentiels = {
      thematiques: new Set<string>(thematiques),
      sites: new Set<string>(sites),
      interventions: new Set<string>(interventions),
    };

    for (const def of QUESTIONNAIRES) {
      for (const axe of ["thematiques", "sites", "interventions"] as const) {
        for (const label of def.etiquettesRequises[axe]) {
          expect(referentiels[axe].has(label)).toBe(true);
        }
      }
    }
  });

  it("aucun fichier partenaire ne porte plus de champ `eligibilite`", () => {
    // Le vocabulaire thématique de MEC (« Équipements et services publics »…) n'existe pas
    // dans les taxonomies de l'API : le champ n'a jamais pu servir. Cf. README.md.
    for (const def of QUESTIONNAIRES) {
      expect(def).not.toHaveProperty("eligibilite");
    }
  });
});

/**
 * Le chargeur ne valide plus que l'ASSEMBLAGE : champ hérité, entrée d'étiquettes absente, fichier
 * de recommandations manquant. Les règles de FOND (étiquettes dans la taxonomie, conditions
 * résolubles, ids uniques) sont l'affaire de `validerDefinition` — seule autorité, testée dans
 * questionnaire-validation.spec.ts. Elles étaient vérifiées ici EN DOUBLE, et les deux jeux avaient
 * déjà divergé : le chargeur ignorait les taxonomies et l'unicité des ids.
 */
describe("Garde-fous du chargeur d'amorçage", () => {
  // Ancré sur le VRAI contenu : les conditions du catalogue de recommandations d'AtoutBiodiv
  // pointent des questions réelles, un fichier bidon ne les satisferait pas.
  const fichierValide = (): QuestionnaireFichier => {
    const { slug, version, source, banniere, questions } = QUESTIONNAIRES.find((q) => q.slug === "atoutbiodiv-salle")!;
    return { slug, version, source, banniere, questions };
  };

  it("assemble un fichier valide", () => {
    expect(assembler(fichierValide()).recommandations.length).toBeGreaterThan(0);
  });

  it("refuse un fichier qui porte encore un champ `eligibilite`", () => {
    // Le rejet est volontairement bruyant : ignorer le champ en silence laisserait croire à
    // un éditeur qu'il pilote l'éligibilité alors qu'il n'a aucun effet.
    const avecEligibilite = { ...fichierValide(), eligibilite: { thematiques: ["X"], competences: [] } };

    expect(() => assembler(avecEligibilite as QuestionnaireFichier)).toThrow(/eligibilite.*n'est plus supporté/s);
  });

  it("refuse un questionnaire sans étiquette d'éligibilité déclarée", () => {
    // Sans étiquette, le questionnaire ne serait proposé à aucun projet — un bug parfaitement
    // silencieux en production.
    const inconnu = { ...fichierValide(), slug: "questionnaire-sans-etiquette" };

    expect(() => assembler(inconnu)).toThrow(/aucune étiquette d'éligibilité/);
  });
});
