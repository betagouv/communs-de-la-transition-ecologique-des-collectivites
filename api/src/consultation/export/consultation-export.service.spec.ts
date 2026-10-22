import { ServiceUnavailableException } from "@nestjs/common";
import type { ConsultationService } from "../consultation.service";
import { ConsultationExportService, EXPORT_URL_TTL_SECONDS } from "./consultation-export.service";
import type { ExportManifest, ExportStore } from "./export-store";

const manifest: ExportManifest = {
  generatedAt: "2026-10-23T03:12:00.000Z",
  profils: {
    interne_etat: { fichier: "projets-interne_etat.ndjson.gz", nbProjets: 900, octets: 1000, sha256: "a" },
    opendata: { fichier: "projets-opendata.ndjson.gz", nbProjets: 700, octets: 800, sha256: "b" },
  },
};

describe("ConsultationExportService", () => {
  let store: jest.Mocked<Pick<ExportStore, "getJson" | "presignedGetUrl">>;
  let consultation: { profilExport: jest.Mock };
  let service: ConsultationExportService;

  beforeEach(() => {
    store = {
      getJson: jest.fn().mockResolvedValue(manifest),
      presignedGetUrl: jest.fn((name: string, ttl: number) =>
        Promise.resolve(`https://cellar.test/${name}?sig&ttl=${ttl}`),
      ),
    };
    consultation = { profilExport: jest.fn().mockResolvedValue("opendata") };
    service = new ConsultationExportService(
      consultation as unknown as ConsultationService,
      store as unknown as ExportStore,
    );
  });

  it("describes the caller's file with a short-lived download link", async () => {
    consultation.profilExport.mockResolvedValue("interne_etat");

    await expect(service.fichier("Turgot")).resolves.toEqual({
      profil: "interne_etat",
      generatedAt: "2026-10-23T03:12:00.000Z",
      nbProjets: 900,
      octets: 1000,
      sha256: "a",
      url: "https://cellar.test/projets-interne_etat.ndjson.gz?sig&ttl=900",
      urlExpireDans: EXPORT_URL_TTL_SECONDS,
    });
    expect(consultation.profilExport).toHaveBeenCalledWith("Turgot");
    expect(store.presignedGetUrl).toHaveBeenCalledWith("projets-interne_etat.ndjson.gz", 900);
  });

  it("serves the open data file to a caller without the internal scope", async () => {
    await expect(service.fichier("Recoco")).resolves.toMatchObject({
      profil: "opendata",
      url: "https://cellar.test/projets-opendata.ndjson.gz?sig&ttl=900",
    });
  });

  it("answers 503 before the first generation", async () => {
    store.getJson.mockResolvedValue(null);
    await expect(service.fichier("Turgot")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("answers 503 where the storage is not configured", async () => {
    const sansStockage = new ConsultationExportService(consultation as unknown as ConsultationService, null);
    await expect(sansStockage.fichier("Turgot")).rejects.toThrow("Export indisponible dans cet environnement");
  });
});
