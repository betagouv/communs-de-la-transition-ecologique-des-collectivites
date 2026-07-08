import { BadRequestException } from "@nestjs/common";
import { Request } from "express";
import { DecisionsController } from "./decisions.controller";
import { DecisionsService } from "./decisions.service";
import { CreateDecisionDto } from "./dto/create-decision.dto";

describe("DecisionsController", () => {
  let controller: DecisionsController;
  let service: { create: jest.Mock; find: jest.Mock };

  const mockRequest = (serviceType: string) => ({ serviceType }) as unknown as Request;

  beforeEach(() => {
    service = { create: jest.fn(), find: jest.fn() };
    controller = new DecisionsController(service as unknown as DecisionsService);
  });

  describe("create", () => {
    it("dérive plateformeSource de request.serviceType (jamais du body)", async () => {
      service.create.mockResolvedValue({ id: "dec-1", createdAt: "2026-07-07T10:00:00.000Z" });
      const dto = { typeDecision: "projet_statut", objetAType: "projet", objetAId: "p1" } as CreateDecisionDto;

      await controller.create(mockRequest("MEC"), dto);

      expect(service.create).toHaveBeenCalledWith(dto, "MEC");
    });
  });

  describe("find", () => {
    it("transmet objetId et la plateforme appelante au service (cloisonnement)", async () => {
      service.find.mockResolvedValue({ items: [] });

      await controller.find(mockRequest("TeT"), "p1");

      expect(service.find).toHaveBeenCalledWith({ objetId: "p1", type: undefined }, "TeT");
    });

    it("accepte un filtre par type seul", async () => {
      service.find.mockResolvedValue({ items: [] });

      await controller.find(mockRequest("MEC"), undefined, "projet_statut");

      expect(service.find).toHaveBeenCalledWith({ objetId: undefined, type: "projet_statut" }, "MEC");
    });

    it("400 si ni objetId ni type", () => {
      expect(() => controller.find(mockRequest("MEC"), undefined, undefined)).toThrow(BadRequestException);
      expect(service.find).not.toHaveBeenCalled();
    });

    it("400 si type hors du vocabulaire fermé", () => {
      expect(() => controller.find(mockRequest("MEC"), undefined, "lien_confirme")).toThrow(BadRequestException);
      expect(service.find).not.toHaveBeenCalled();
    });
  });
});
