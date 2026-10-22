import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ConsultationExportController } from "./consultation-export.controller";
import { ConsultationExportService } from "./consultation-export.service";

describe("ConsultationExportController", () => {
  const REQ = { serviceType: "Turgot" } as Request;
  const fichier = {
    profil: "interne_etat",
    generatedAt: "2026-10-23T03:12:00.000Z",
    nbProjets: 900,
    octets: 1000,
    sha256: "a",
    url: "https://cellar.test/projets-interne_etat.ndjson.gz?sig",
    urlExpireDans: 900,
  };
  let service: { fichier: jest.Mock };
  let controller: ConsultationExportController;

  beforeEach(() => {
    service = { fichier: jest.fn().mockResolvedValue(fichier) };
    controller = new ConsultationExportController(service as unknown as ConsultationExportService);
  });

  it("is guarded by the API key, with no public route", () => {
    expect(Reflect.getMetadata("__guards__", ConsultationExportController)).toEqual([ApiKeyGuard]);
    for (const name of ["telecharger", "description"] as const) {
      expect(Reflect.getMetadata("isPublic", ConsultationExportController.prototype[name])).toBeUndefined();
    }
  });

  it("redirects to the caller's file", async () => {
    await expect(controller.telecharger(REQ)).resolves.toEqual({ url: fichier.url, statusCode: 302 });
    expect(service.fichier).toHaveBeenCalledWith("Turgot");
  });

  it("describes the caller's file", async () => {
    await expect(controller.description(REQ)).resolves.toEqual(fichier);
  });
});
