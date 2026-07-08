import { Request } from "express";
import { TerritoiresController } from "./territoires.controller";
import { TerritoiresService } from "./territoires.service";

describe("TerritoiresController", () => {
  let controller: TerritoiresController;
  let service: { territoireProjets: jest.Mock; plansProjetsTerritoire: jest.Mock };

  const req = { serviceType: "MEC" } as unknown as Request;

  const lastParams = (): Record<string, unknown> => {
    const calls = service.territoireProjets.mock.calls as unknown[][];
    return calls[0][1] as Record<string, unknown>;
  };

  beforeEach(() => {
    service = {
      territoireProjets: jest.fn().mockResolvedValue({ total: 0, limit: 50, offset: 0, groupes: [] }),
      plansProjetsTerritoire: jest.fn().mockResolvedValue({
        pcaet: { sirenPorteur: "244400404", nom: "PCAET", source: "opendata" },
        total: 0,
        limit: 50,
        offset: 0,
        groupes: [],
      }),
    };
    controller = new TerritoiresController(service as unknown as TerritoiresService);
  });

  describe("sources (param répété vs virgules)", () => {
    it("aplati un param répété en tableau (pas de 500)", async () => {
      await controller.territoireProjets(req, "01001", { sources: ["MEC", "Vivier COP"] });
      expect(lastParams().sources).toEqual(["MEC", "Vivier COP"]);
    });

    it("découpe la forme séparée par des virgules", async () => {
      await controller.territoireProjets(req, "01001", { sources: "MEC,Vivier COP" });
      expect(lastParams().sources).toEqual(["MEC", "Vivier COP"]);
    });

    it("sources absent → undefined", async () => {
      await controller.territoireProjets(req, "01001", {});
      expect(lastParams().sources).toBeUndefined();
    });
  });

  describe("limit (borné à 1..200)", () => {
    it("limit=0 est ramené à 1", async () => {
      await controller.territoireProjets(req, "01001", { limit: "0" });
      expect(lastParams().limit).toBe(1);
    });

    it("limit > 200 est plafonné à 200", async () => {
      await controller.territoireProjets(req, "01001", { limit: "500" });
      expect(lastParams().limit).toBe(200);
    });

    it("limit absent → défaut 50", async () => {
      await controller.territoireProjets(req, "01001", {});
      expect(lastParams().limit).toBe(50);
    });
  });

  it("mappe copStatutVivier et inclureFinancementsSeuls", async () => {
    await controller.territoireProjets(req, "01001", {
      copStatutVivier: "a_remonter",
      inclureFinancementsSeuls: "true",
    });
    expect(lastParams()).toMatchObject({ copStatutVivier: "a_remonter", inclureFinancementsSeuls: true });
  });

  it("transmet le serviceType appelant aux deux vues territoriales (doctrine d'accès)", async () => {
    const reqTet = { serviceType: "TeT" } as unknown as Request;
    await controller.territoireProjets(reqTet, "01001", {});
    await controller.plansProjetsTerritoire(reqTet, "244400404", {});
    expect((service.territoireProjets.mock.calls[0] as unknown[])[2]).toBe("TeT");
    expect((service.plansProjetsTerritoire.mock.calls[0] as unknown[])[2]).toBe("TeT");
  });

  describe("masquerObsoletes (défaut false)", () => {
    it("masquerObsoletes='true' → true", async () => {
      await controller.territoireProjets(req, "01001", { masquerObsoletes: "true" });
      expect(lastParams().masquerObsoletes).toBe(true);
    });

    it("absent → false", async () => {
      await controller.territoireProjets(req, "01001", {});
      expect(lastParams().masquerObsoletes).toBe(false);
    });

    it("valeur autre que 'true' → false", async () => {
      await controller.territoireProjets(req, "01001", { masquerObsoletes: "1" });
      expect(lastParams().masquerObsoletes).toBe(false);
    });
  });

  describe("plans/:cle/projets-territoire", () => {
    const lastPlansCall = (): { cle: string; params: Record<string, unknown> } => {
      const calls = service.plansProjetsTerritoire.mock.calls as unknown[][];
      return { cle: calls[0][0] as string, params: calls[0][1] as Record<string, unknown> };
    };

    it("transmet la clé et les mêmes paramètres de filtrage (bornes limit, sources CSV) au service", async () => {
      await controller.plansProjetsTerritoire(req, "244400404", { sources: "MEC,Vivier COP", limit: "500" });
      const { cle, params } = lastPlansCall();
      expect(cle).toBe("244400404");
      // Parsing mutualisé avec territoires/:code/projets : mêmes bornes et découpage.
      expect(params).toMatchObject({ sources: ["MEC", "Vivier COP"], limit: 200 });
    });

    it("renvoie la réponse du service (en-tête pcaet + groupes)", async () => {
      const result = await controller.plansProjetsTerritoire(req, "019ce410-84fe-7174-a27c-4cec8c632cf4", {});
      expect(result).toMatchObject({ pcaet: { sirenPorteur: "244400404" }, total: 0, groupes: [] });
    });
  });
});
