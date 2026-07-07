import { BadRequestException } from "@nestjs/common";
import { Request } from "express";
import { DecisionsController } from "./decisions.controller";
import { DecisionsService } from "./decisions.service";
import { CreateDecisionDto } from "./dto/create-decision.dto";

describe("DecisionsController", () => {
  let controller: DecisionsController;
  let service: { create: jest.Mock; findByObjet: jest.Mock };

  const mockRequest = (serviceType: string) => ({ serviceType }) as unknown as Request;

  beforeEach(() => {
    service = { create: jest.fn(), findByObjet: jest.fn() };
    controller = new DecisionsController(service as unknown as DecisionsService);
  });

  describe("create", () => {
    it("dérive plateformeSource de request.serviceType (jamais du body)", async () => {
      service.create.mockResolvedValue({ id: "dec-1", createdAt: "2026-07-07T10:00:00.000Z" });
      const dto = { typeDecision: "lien_confirme", objetAType: "projet", objetAId: "p1" } as CreateDecisionDto;

      await controller.create(mockRequest("MEC"), dto);

      expect(service.create).toHaveBeenCalledWith(dto, "MEC");
    });
  });

  describe("findByObjet", () => {
    it("transmet la plateforme appelante au service (cloisonnement)", async () => {
      service.findByObjet.mockResolvedValue({ items: [] });

      await controller.findByObjet(mockRequest("TeT"), "p1");

      expect(service.findByObjet).toHaveBeenCalledWith("p1", "TeT");
    });

    it("400 si objetId manquant", () => {
      expect(() => controller.findByObjet(mockRequest("MEC"), undefined)).toThrow(BadRequestException);
      expect(service.findByObjet).not.toHaveBeenCalled();
    });
  });
});
