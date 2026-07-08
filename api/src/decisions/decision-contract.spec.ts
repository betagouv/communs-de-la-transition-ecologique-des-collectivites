import { BadRequestException } from "@nestjs/common";
import { DecisionContractInput, validateDecisionContract } from "./decision-contract";

// Validation croisée par type. Convention des messages : chaque erreur nomme le champ
// fautif ET le type concerné, pour un 400 exploitable côté partenaire.
const ok = (input: DecisionContractInput) => () => validateDecisionContract(input);

const expectRejects = (input: DecisionContractInput, message: RegExp) => {
  expect(ok(input)).toThrow(BadRequestException);
  expect(ok(input)).toThrow(message);
};

describe("validateDecisionContract", () => {
  it("rejette un type hors du vocabulaire fermé", () => {
    expectRejects({ typeDecision: "lien_confirme", objetAType: "projet", objetAId: "a" }, /hors du vocabulaire fermé/);
  });

  describe.each(["doublon_signale", "doublon_confirme", "doublon_infirme"])("%s", (type) => {
    const base: DecisionContractInput = {
      typeDecision: type,
      objetAType: "projet",
      objetAId: "proj-a",
      objetBType: "projet",
      objetBId: "proj-b",
    };

    it("accepte projet↔projet et fiche_action↔fiche_action", () => {
      expect(ok(base)).not.toThrow();
      expect(ok({ ...base, objetAType: "fiche_action", objetBType: "fiche_action" })).not.toThrow();
    });

    it("400 si objetAType n'est ni projet ni fiche_action", () => {
      expectRejects({ ...base, objetAType: "plan" }, /objetAType.*invalide/);
    });

    it("400 si objetB manquant (requis)", () => {
      expectRejects({ ...base, objetBType: undefined, objetBId: undefined }, /objetBType et objetBId requis/);
    });

    it("400 si objetBType hors projet|fiche_action", () => {
      expectRejects({ ...base, objetBType: "plan" }, /objetBType.*invalide/);
    });

    it("400 si verdict fourni (interdit)", () => {
      expectRejects({ ...base, verdict: "confirme" }, /verdict interdit/);
    });
  });

  describe("rattachement_pcaet", () => {
    const base: DecisionContractInput = {
      typeDecision: "rattachement_pcaet",
      objetAType: "projet",
      objetAId: "proj-a",
      objetBType: "pcaet",
      objetBId: "200000172",
      verdict: "confirme",
    };

    it("accepte projet + pcaet(SIREN) + verdict confirme|infirme", () => {
      expect(ok(base)).not.toThrow();
      expect(ok({ ...base, verdict: "infirme" })).not.toThrow();
    });

    it("400 si objetAType n'est pas projet", () => {
      expectRejects({ ...base, objetAType: "fiche_action" }, /objetAType.*invalide/);
    });

    it("400 si objetBType n'est pas pcaet", () => {
      expectRejects({ ...base, objetBType: "projet" }, /objetBType.*invalide/);
    });

    it("400 si objetBId n'est pas un SIREN de 9 chiffres", () => {
      expectRejects({ ...base, objetBId: "12345" }, /SIREN de 9 chiffres/);
      expectRejects({ ...base, objetBId: "abcdefghi" }, /SIREN de 9 chiffres/);
    });

    it("400 si objetB manquant", () => {
      expectRejects({ ...base, objetBType: undefined, objetBId: undefined }, /objetBType et objetBId requis/);
    });

    it("400 si verdict manquant", () => {
      expectRejects({ ...base, verdict: undefined }, /verdict requis/);
    });

    it("400 si verdict hors confirme|infirme", () => {
      expectRejects({ ...base, verdict: "valide" }, /verdict.*invalide/);
    });
  });

  describe("projet_statut", () => {
    const base: DecisionContractInput = {
      typeDecision: "projet_statut",
      objetAType: "projet",
      objetAId: "proj-a",
      verdict: "valide",
    };

    it("accepte projet + verdict valide|obsolete|termine, sans objetB", () => {
      for (const verdict of ["valide", "obsolete", "termine"]) {
        expect(ok({ ...base, verdict })).not.toThrow();
      }
    });

    it("400 si objetAType n'est pas projet", () => {
      expectRejects({ ...base, objetAType: "financement" }, /objetAType.*invalide/);
    });

    it("400 si objetB fourni (interdit)", () => {
      expectRejects({ ...base, objetBType: "projet", objetBId: "proj-b" }, /objetBType\/objetBId interdits/);
    });

    it("400 si verdict manquant", () => {
      expectRejects({ ...base, verdict: undefined }, /verdict requis/);
    });

    it("400 si verdict hors valide|obsolete|termine", () => {
      expectRejects({ ...base, verdict: "confirme" }, /verdict.*invalide/);
    });
  });

  describe("correction_signalee", () => {
    const base: DecisionContractInput = {
      typeDecision: "correction_signalee",
      objetAType: "projet",
      objetAId: "proj-a",
      payload: { champ: "budgetPrevisionnel", valeurProposee: "150000" },
    };

    it("accepte tout type d'objet A avec payload { champ, valeurProposee }", () => {
      for (const objetAType of ["projet", "fiche_action", "plan", "financement"]) {
        expect(ok({ ...base, objetAType })).not.toThrow();
      }
    });

    it("accepte une source optionnelle", () => {
      expect(ok({ ...base, payload: { ...base.payload, source: "délibération 2026-03" } })).not.toThrow();
    });

    it("400 si objetB fourni (interdit)", () => {
      expectRejects({ ...base, objetBType: "projet", objetBId: "proj-b" }, /objetBType\/objetBId interdits/);
    });

    it("400 si verdict fourni (interdit)", () => {
      expectRejects({ ...base, verdict: "valide" }, /verdict interdit/);
    });

    it("400 si payload manquant", () => {
      expectRejects({ ...base, payload: undefined }, /payload requis/);
    });

    it("400 si payload.champ manquant ou vide", () => {
      expectRejects({ ...base, payload: { valeurProposee: "x" } }, /payload\.champ requis/);
      expectRejects({ ...base, payload: { champ: "  ", valeurProposee: "x" } }, /payload\.champ requis/);
    });

    it("400 si payload.valeurProposee manquant ou non-chaîne", () => {
      expectRejects({ ...base, payload: { champ: "nom" } }, /payload\.valeurProposee requis/);
      expectRejects({ ...base, payload: { champ: "nom", valeurProposee: 42 } }, /payload\.valeurProposee requis/);
    });

    it("400 si payload.source fourni mais non-chaîne", () => {
      expectRejects({ ...base, payload: { champ: "nom", valeurProposee: "x", source: 12 } }, /payload\.source/);
    });
  });
});
