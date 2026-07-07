import { TerritoiresController } from "./territoires.controller";
import { TerritoiresService } from "./territoires.service";

describe("TerritoiresController", () => {
  let controller: TerritoiresController;
  let service: { territoireProjets: jest.Mock };

  const lastParams = (): Record<string, unknown> => {
    const calls = service.territoireProjets.mock.calls as unknown[][];
    return calls[0][1] as Record<string, unknown>;
  };

  beforeEach(() => {
    service = { territoireProjets: jest.fn().mockResolvedValue({ total: 0, limit: 50, offset: 0, groupes: [] }) };
    controller = new TerritoiresController(service as unknown as TerritoiresService);
  });

  describe("sources (param répété vs virgules)", () => {
    it("aplati un param répété en tableau (pas de 500)", async () => {
      await controller.territoireProjets("01001", { sources: ["MEC", "Vivier COP"] });
      expect(lastParams().sources).toEqual(["MEC", "Vivier COP"]);
    });

    it("découpe la forme séparée par des virgules", async () => {
      await controller.territoireProjets("01001", { sources: "MEC,Vivier COP" });
      expect(lastParams().sources).toEqual(["MEC", "Vivier COP"]);
    });

    it("sources absent → undefined", async () => {
      await controller.territoireProjets("01001", {});
      expect(lastParams().sources).toBeUndefined();
    });
  });

  describe("limit (borné à 1..200)", () => {
    it("limit=0 est ramené à 1", async () => {
      await controller.territoireProjets("01001", { limit: "0" });
      expect(lastParams().limit).toBe(1);
    });

    it("limit > 200 est plafonné à 200", async () => {
      await controller.territoireProjets("01001", { limit: "500" });
      expect(lastParams().limit).toBe(200);
    });

    it("limit absent → défaut 50", async () => {
      await controller.territoireProjets("01001", {});
      expect(lastParams().limit).toBe(50);
    });
  });

  it("mappe copStatutVivier et inclureFinancementsSeuls", async () => {
    await controller.territoireProjets("01001", {
      copStatutVivier: "a_remonter",
      inclureFinancementsSeuls: "true",
    });
    expect(lastParams()).toMatchObject({ copStatutVivier: "a_remonter", inclureFinancementsSeuls: true });
  });
});
