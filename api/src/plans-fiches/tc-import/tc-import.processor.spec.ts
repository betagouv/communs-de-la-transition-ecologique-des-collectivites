/* eslint-disable @typescript-eslint/unbound-method */
import { TcImportProcessor } from "./tc-import.processor";
import { TcFetchService } from "./tc-fetch.service";
import { TcImportService } from "./tc-import.service";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { Job } from "bullmq";
import type { ImportStats, ParsedPlan, ParsedFicheAction } from "./tc-import.types";

describe("TcImportProcessor", () => {
  let processor: TcImportProcessor;
  let fetchService: jest.Mocked<TcFetchService>;
  let importService: jest.Mocked<TcImportService>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<CustomLogger>;

  const mockPlans: ParsedPlan[] = [
    {
      nom: "PCAET Test",
      type: "PCAET",
      description: null,
      periodeDebut: "2020-01-01",
      periodeFin: "2026-01-01",
      collectiviteResponsableSiren: "200000001",
      territoireCommunes: null,
      tcDemarcheId: 100,
      tcVersion: "V1",
      tcEtat: "Publiée",
    },
  ];

  const mockFiches: ParsedFicheAction[] = [
    {
      nom: "Action test",
      description: null,
      collectiviteResponsableSiren: "200000001",
      territoireCommunes: null,
      tcDemarcheId: 100,
      tcHash: "abc123",
      tcSecteurs: ["Bâtiment"],
      tcTypesPorteur: null,
      tcVolets: null,
      tcTypeAction: null,
      tcCibleAction: null,
    },
  ];

  const mockStats: ImportStats = {
    plansInserted: 1,
    plansUpdated: 0,
    fichesInserted: 1,
    fichesUpdated: 0,
    linksCreated: 1,
    fichesEnriched: 0,
    communesResolved: 1,
  };

  beforeEach(() => {
    fetchService = {
      fetchAndParse: jest.fn().mockResolvedValue({ plans: mockPlans, fiches: mockFiches }),
    } as unknown as jest.Mocked<TcFetchService>;

    importService = {
      importAll: jest.fn().mockResolvedValue(mockStats),
    } as unknown as jest.Mocked<TcImportService>;

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<CustomLogger>;

    processor = new TcImportProcessor(fetchService, importService, configService, logger);
  });

  it("should fetch data and call importAll", async () => {
    const job = { id: "test-job-1" } as Job;
    const result = await processor.process(job);

    expect(fetchService.fetchAndParse).toHaveBeenCalledTimes(1);
    expect(importService.importAll).toHaveBeenCalledWith(mockPlans, mockFiches);
    expect(result).toEqual(mockStats);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Starting"));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("complete"), expect.any(Object));
  });

  it("should capture error in Sentry and rethrow on fetch failure", async () => {
    const error = new Error("Network error");
    fetchService.fetchAndParse.mockRejectedValueOnce(error);

    const job = { id: "test-job-2" } as Job;
    await expect(processor.process(job)).rejects.toThrow("Network error");
    expect(logger.error).toHaveBeenCalledWith("TC opendata import failed", expect.any(Object));
  });

  it("should capture error and rethrow on import failure", async () => {
    const error = new Error("DB connection lost");
    importService.importAll.mockRejectedValueOnce(error);

    const job = { id: "test-job-3" } as Job;
    await expect(processor.process(job)).rejects.toThrow("DB connection lost");
    expect(logger.error).toHaveBeenCalledWith("TC opendata import failed", expect.any(Object));
  });
});
