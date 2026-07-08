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

  describe("verdict 'annule' (révocation universelle)", () => {
    const target = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const doublon = {
      typeDecision: "doublon_confirme",
      objetAType: "projet",
      objetAId: "a",
      objetBType: "projet",
      objetBId: "b",
    };
    const statut = { typeDecision: "projet_statut", objetAType: "projet", objetAId: "a" };
    const pcaet = {
      typeDecision: "rattachement_pcaet",
      objetAType: "projet",
      objetAId: "a",
      objetBType: "pcaet",
      objetBId: "200000172",
    };
    const correction = { typeDecision: "correction_signalee", objetAType: "projet", objetAId: "a" };

    it("400 pour 'annule' sans supersedes, quel que soit le type", () => {
      expectRejects({ ...doublon, verdict: "annule" }, /annule.*exige supersedes/);
      expectRejects({ ...statut, verdict: "annule" }, /annule.*exige supersedes/);
      expectRejects({ ...pcaet, verdict: "annule" }, /annule.*exige supersedes/);
      // correction_signalee sans payload : 'annule' court-circuite la règle payload → c'est
      // bien supersedes qui manque (et non le payload) qui est signalé.
      expectRejects({ ...correction, verdict: "annule" }, /annule.*exige supersedes/);
    });

    it("accepte 'annule' + supersedes pour tous les types (bypass verdict/payload métier)", () => {
      expect(ok({ ...doublon, verdict: "annule", supersedes: target })).not.toThrow();
      expect(ok({ ...statut, verdict: "annule", supersedes: target })).not.toThrow();
      expect(ok({ ...pcaet, verdict: "annule", supersedes: target })).not.toThrow();
      // Pas de payload de correction requis pour révoquer une correction_signalee.
      expect(ok({ ...correction, verdict: "annule", supersedes: target })).not.toThrow();
    });

    it("conserve les contraintes structurelles d'objet B propres au type", () => {
      // Un doublon révoqué reste structurellement un doublon : objetB requis.
      expectRejects(
        {
          typeDecision: "doublon_confirme",
          objetAType: "projet",
          objetAId: "a",
          verdict: "annule",
          supersedes: target,
        },
        /objetBType et objetBId requis/,
      );
      // projet_statut interdit toujours objetB, même en révocation.
      expectRejects(
        { ...statut, objetBType: "projet", objetBId: "b", verdict: "annule", supersedes: target },
        /objetBType\/objetBId interdits/,
      );
    });
  });
});
