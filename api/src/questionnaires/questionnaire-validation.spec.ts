import { BadRequestException } from "@nestjs/common";
import type { QuestionnaireDef } from "./questionnaire-contract";
import { validerDefinition } from "./questionnaire-validation";

/**
 * LE FILET DE SÉCURITÉ, DÉPLACÉ.
 *
 * Tant que les questionnaires vivaient dans le dépôt, une incohérence empêchait l'API de DÉMARRER.
 * Brutal, mais parfait : le bug ne pouvait pas atteindre la production. En base, éditables depuis
 * le back-office, ce filet disparaît — sauf s'il est intégralement reconstruit à l'écriture.
 *
 * C'est ce que ces tests verrouillent. Chacun correspond à un refus que le chargeur opposait au
 * démarrage. Si l'un d'eux tombe, une personne pourra enregistrer depuis le back-office un
 * questionnaire cassé, et le casse n'apparaîtra NULLE PART : la recommandation ne s'affichera
 * simplement jamais, ou le questionnaire ne sera jamais proposé.
 */

const option = (id: string, libelle: string) => ({ id, libelle, signal: "neutre" as const });

const reco = (id: string, titre: string, condition: QuestionnaireDef["recommandations"][number]["condition"]) => ({
  id,
  titre,
  description: `Description de ${titre}`,
  condition,
  financements: [],
  ressources: [],
  engagement: "faible",
});

const valide = (): QuestionnaireDef => ({
  slug: "test",
  version: 1,
  source: { nom: "AtoutBiodiv" },
  banniere: { icone: "🌿", titre: "Titre", sousTitre: "Sous-titre" },
  questions: [
    {
      id: "surface",
      type: "choix-unique",
      intitule: "Quelle surface ?",
      options: [option("petite", "Petite"), option("grande", "Grande")],
    },
  ],
  recommandations: [
    reco("haies", "Planter des haies", { question: "surface", parmi: ["grande"] }),
    reco("toujours", "Recommandation inconditionnelle", true),
  ],
  etiquettesRequises: { thematiques: [], sites: ["Place ou centre-bourg"], interventions: [] },
});

describe("Validation d'un questionnaire à l'écriture", () => {
  it("accepte une définition cohérente", () => {
    expect(() => validerDefinition(valide())).not.toThrow();
  });

  describe("Étiquettes d'éligibilité", () => {
    it("REFUSE un questionnaire qui n'exige AUCUNE étiquette", () => {
      // Le plus dangereux, et le plus contre-intuitif : une conjonction VIDE est VRAIE. Ce
      // questionnaire serait proposé à TOUS les projets de France, sans exception.
      const def = { ...valide(), etiquettesRequises: { thematiques: [], sites: [], interventions: [] } };

      expect(() => validerDefinition(def)).toThrow(/proposé à TOUS les projets/);
    });

    it("REFUSE une étiquette hors de la taxonomie fermée", () => {
      // Une coquille ici, et le questionnaire n'est JAMAIS proposé — sans le moindre message. C'est
      // exactement le bug que le typage TypeScript empêchait, et qu'il faut donc rattraper ici.
      const def = {
        ...valide(),
        etiquettesRequises: { thematiques: [], sites: ["Place ou centre bourg"], interventions: [] },
      } as unknown as QuestionnaireDef;

      expect(() => validerDefinition(def)).toThrow(/hors de la taxonomie/);
    });

    it("nomme l'étiquette fautive — la personne qui édite n'a pas accès au code", () => {
      const def = {
        ...valide(),
        etiquettesRequises: { thematiques: ["Vélo"], sites: [], interventions: [] },
      } as unknown as QuestionnaireDef;

      expect(() => validerDefinition(def)).toThrow(/« Vélo »/);
    });
  });

  describe("Conditions des recommandations", () => {
    it("REFUSE une condition qui pointe une question inexistante", () => {
      // Autrement INDÉTECTABLE : la recommandation ne s'afficherait simplement jamais. C'est le
      // garde-fou le plus important.
      const def = valide();
      def.recommandations = [reco("haies", "Haies", { question: "inconnue", parmi: ["grande"] })];

      expect(() => validerDefinition(def)).toThrow(/n'existe pas/);
    });

    it("REFUSE une condition qui cite une option inexistante", () => {
      const def = valide();
      def.recommandations = [reco("haies", "Haies", { question: "surface", parmi: ["enorme"] })];

      expect(() => validerDefinition(def)).toThrow(/options inconnues/);
    });

    it("accepte une condition inconditionnelle (`true`)", () => {
      const def = valide();
      def.recommandations = [reco("toujours", "Toujours", true)];

      expect(() => validerDefinition(def)).not.toThrow();
    });
  });

  describe("Identifiants", () => {
    it("REFUSE deux questions de même id", () => {
      const def = valide();
      def.questions = [def.questions[0], { ...def.questions[0] }];

      expect(() => validerDefinition(def)).toThrow(/deux questions portent l'id/);
    });

    it("REFUSE deux options de même id dans une question", () => {
      // La réponse de la collectivité serait ambiguë : impossible de savoir laquelle elle a choisie.
      const def = valide();
      def.questions[0].options = [option("petite", "Petite"), option("petite", "Petite (bis)")];

      expect(() => validerDefinition(def)).toThrow(/deux options portent l'id/);
    });

    it("REFUSE une question sans option", () => {
      const def = valide();
      def.questions[0].options = [];

      expect(() => validerDefinition(def)).toThrow(/aucune option/);
    });

    it("REFUSE un questionnaire sans question", () => {
      const def = { ...valide(), questions: [], recommandations: [] };

      expect(() => validerDefinition(def)).toThrow(/aucune question/);
    });
  });

  it("lève une BadRequestException, pas une Error — c'est un 400, pas un 500", () => {
    // Une définition invalide vient de l'éditeur, pas d'un bug de l'API. Le lui dire en 400 avec un
    // message précis, c'est la différence entre « corrigez le lieu X » et « erreur serveur ».
    const def = { ...valide(), etiquettesRequises: { thematiques: [], sites: [], interventions: [] } };

    expect(() => validerDefinition(def)).toThrow(BadRequestException);
  });
});
