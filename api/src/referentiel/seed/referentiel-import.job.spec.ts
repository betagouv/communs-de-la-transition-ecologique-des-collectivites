/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { ReferentielImportJob } from "./referentiel-import.job";
import { ReferentielSeedService } from "./referentiel-seed.service";
import { ReferentielImportService } from "./import.service";
import type { SeedData, SeedStats } from "./sources/types";
import type { SeedVolumes } from "./volume-guard";
import { REFERENTIEL_IMPORT_CRON } from "./referentiel-import.constants";

describe("ReferentielImportJob", () => {
  const seedData = { communes: [] } as unknown as SeedData;
  const volumes: SeedVolumes = {
    regions: 18,
    departements: 101,
    departementsWithSiren: 101,
    communes: 34875,
    communesWithSiret: 34875,
    communesWithBanaticEpci: 34871,
    groupements: 9275,
    perimetres: 392141,
    groupementCompetences: 50793,
  };
  const stats: SeedStats = {
    regions: 18,
    departements: 101,
    communes: 34875,
    groupements: 9275,
    perimetres: 392141,
    competenceCategories: 15,
    competences: 118,
    groupementCompetences: 50793,
  };

  let seedService: jest.Mocked<ReferentielSeedService>;
  let importService: jest.Mocked<ReferentielImportService>;
  let config: Record<string, string>;
  let logger: jest.Mocked<CustomLogger>;
  let fetchMock: jest.Mock;
  let job: ReferentielImportJob;
  const originalFetch = global.fetch;

  const postedTexts = () =>
    fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as RequestInit).body as string) as { text: string }).text);

  const buildJob = () =>
    new ReferentielImportJob(
      seedService,
      importService,
      { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService,
      logger,
    );

  beforeEach(() => {
    seedService = {
      buildSeedData: jest.fn().mockResolvedValue({ data: seedData, volumes }),
    } as unknown as jest.Mocked<ReferentielSeedService>;
    importService = {
      importAll: jest.fn().mockResolvedValue(stats),
    } as unknown as jest.Mocked<ReferentielImportService>;
    config = { REFERENTIEL_IMPORT_MATTERMOST_WEBHOOK: "https://mattermost.test/hooks/referentiel" };
    logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as unknown as jest.Mocked<CustomLogger>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    job = buildJob();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("imports the data built from the sources and reports the counts on Mattermost", async () => {
    await expect(job.run()).resolves.toEqual(stats);

    expect(importService.importAll).toHaveBeenCalledWith(seedData);
    expect(fetchMock).toHaveBeenCalledWith("https://mattermost.test/hooks/referentiel", expect.any(Object));
    const [text] = postedTexts();
    expect(text).toContain("Import du référentiel terminé");
    expect(text).toContain("| Communes | 34875 |");
    expect(text).toContain("| Périmètres | 392141 |");
  });

  it("refuses the import when a source returned too few rows, and says why", async () => {
    seedService.buildSeedData.mockResolvedValueOnce({ data: seedData, volumes: { ...volumes, communes: 1200 } });

    await expect(job.run()).rejects.toThrow("communes: 1200 < 34000");

    expect(importService.importAll).not.toHaveBeenCalled();
    const [text] = postedTexts();
    expect(text).toContain("Import du référentiel refusé");
    expect(text).toContain("communes: 1200 < 34000");
    expect(text).toContain("données actuelles conservées");
  });

  it("reports a failure on Mattermost and rethrows it", async () => {
    importService.importAll.mockRejectedValueOnce(new Error("DB connection lost"));

    await expect(job.run()).rejects.toThrow("DB connection lost");

    expect(logger.error).toHaveBeenCalledWith("Referentiel import failed", expect.any(Object));
    const [text] = postedTexts();
    expect(text).toContain("Import du référentiel échoué");
    expect(text).toContain("DB connection lost");
  });

  it("falls back to the TC import webhook, posting to the same channel", async () => {
    config = { TC_IMPORT_MATTERMOST_WEBHOOK: "https://mattermost.test/hooks/tc" };
    job = buildJob();

    await job.run();

    expect(fetchMock).toHaveBeenCalledWith("https://mattermost.test/hooks/tc", expect.any(Object));
  });

  it("imports without notifying when no webhook is configured", async () => {
    config = {};
    job = buildJob();

    await expect(job.run()).resolves.toEqual(stats);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fail the import when Mattermost is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(job.run()).resolves.toEqual(stats);

    expect(logger.warn).toHaveBeenCalledWith("Failed to send Mattermost notification", expect.any(Object));
  });
});

describe("cron.json", () => {
  it("schedules the scheduled import at the time the Sentry monitor expects", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jobs } = require("../../../../cron.json") as { jobs: { command: string }[] };
    const command = jobs.map((j) => j.command).find((c) => c.includes("seed-referentiel.js --scheduled"));
    expect(command?.startsWith(`${REFERENTIEL_IMPORT_CRON} `)).toBe(true);
  });
});
