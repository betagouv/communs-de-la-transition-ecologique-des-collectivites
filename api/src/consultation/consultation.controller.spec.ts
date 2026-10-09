import { BadRequestException } from "@nestjs/common";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ConsultationController } from "./consultation.controller";
import { ConsultationService } from "./consultation.service";

describe("ConsultationController", () => {
  let controller: ConsultationController;
  let service: { projets: jest.Mock; projetsCollectivite: jest.Mock; synthese: jest.Mock; collectivites: jest.Mock };

  const firstArg = (mock: jest.Mock, index = 0): Record<string, unknown> =>
    (mock.mock.calls as unknown[][])[0][index] as Record<string, unknown>;

  beforeEach(() => {
    service = {
      projets: jest.fn().mockResolvedValue({ data: [], limit: 200, nextCursor: null }),
      projetsCollectivite: jest.fn().mockResolvedValue({ data: [], limit: 50, nextCursor: null, total: 0 }),
      synthese: jest.fn(),
      collectivites: jest.fn().mockResolvedValue({ data: [], limit: 50, nextCursor: null }),
    };
    controller = new ConsultationController(service as unknown as ConsultationService);
  });

  describe("access regime", () => {
    it("is guarded by the API key, with no public route", () => {
      expect(Reflect.getMetadata("__guards__", ConsultationController)).toEqual([ApiKeyGuard]);

      const handlers = Object.getOwnPropertyNames(ConsultationController.prototype).filter((n) => n !== "constructor");
      expect(handlers).toHaveLength(4);
      for (const name of handlers) {
        const handler = (ConsultationController.prototype as unknown as Record<string, object>)[name];
        expect(Reflect.getMetadata("isPublic", handler)).toBeUndefined();
      }
    });
  });

  describe("bulk projets", () => {
    it("defaults to pages of 200", async () => {
      await controller.projets({});
      expect(firstArg(service.projets).limit).toBe(200);
    });

    it("caps limit at 1000 and floors it at 1", async () => {
      await controller.projets({ limit: "5000" });
      expect(firstArg(service.projets).limit).toBe(1000);

      service.projets.mockClear();
      await controller.projets({ limit: "0" });
      expect(firstArg(service.projets).limit).toBe(1);
    });

    it("passes the filters and the cursor through, ignoring blanks", async () => {
      await controller.projets({
        source: "dgcl",
        nature: " ",
        thematique: "Cours d'eau",
        millesime: "2024",
        cursor: "abc",
      });
      expect(firstArg(service.projets)).toEqual({
        source: "dgcl",
        nature: undefined,
        thematique: "Cours d'eau",
        millesime: 2024,
        limit: 200,
        cursor: "abc",
      });
    });

    it("takes the first value of a repeated param", async () => {
      await controller.projets({ source: ["dgcl", "decp"] });
      expect(firstArg(service.projets).source).toBe("dgcl");
    });

    it("rejects an invalid millesime with a 400 before reaching the service", () => {
      expect(() => controller.projets({ millesime: "24" })).toThrow(BadRequestException);
      expect(service.projets).not.toHaveBeenCalled();
    });
  });

  describe("projets of a collectivity", () => {
    it("defaults to pages of 50, capped at 200", async () => {
      await controller.projetsCollectivite("217500016", {});
      expect((service.projetsCollectivite.mock.calls as unknown[][])[0][0]).toBe("217500016");
      expect(firstArg(service.projetsCollectivite, 1).limit).toBe(50);

      service.projetsCollectivite.mockClear();
      await controller.projetsCollectivite("217500016", { limit: "1000" });
      expect(firstArg(service.projetsCollectivite, 1).limit).toBe(200);
    });
  });

  describe("collectivites", () => {
    it("passes the territory and bounds the limit", async () => {
      await controller.collectivites({ departement: "59", limit: "999", cursor: "200000172" });
      expect(firstArg(service.collectivites)).toEqual({
        departement: "59",
        region: undefined,
        limit: 200,
        cursor: "200000172",
      });
    });
  });
});
