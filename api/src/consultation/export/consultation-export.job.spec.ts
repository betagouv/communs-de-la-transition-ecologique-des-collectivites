/* eslint-disable @typescript-eslint/unbound-method */
import type { CustomLogger } from "@logging/logger.service";
import { ConsultationExportGenerator, ExportRefusedError } from "./consultation-export.generator";
import { CONSULTATION_EXPORT_CRON, ConsultationExportJob } from "./consultation-export.job";
import type { ExportManifest } from "./export-store";

describe("ConsultationExportJob", () => {
  const manifest = {
    generatedAt: "2026-10-23T03:12:00.000Z",
    profils: {
      interne_etat: { fichier: "projets-interne_etat.ndjson.gz", nbProjets: 900, octets: 1000, sha256: "a" },
      opendata: { fichier: "projets-opendata.ndjson.gz", nbProjets: 700, octets: 800, sha256: "b" },
    },
  } satisfies ExportManifest;
  const originalFetch = global.fetch;
  let generator: { generate: jest.Mock };
  let logger: jest.Mocked<CustomLogger>;
  let fetchMock: jest.Mock;
  let job: ConsultationExportJob;

  const postedTexts = () =>
    fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as RequestInit).body as string) as { text: string }).text);

  beforeEach(() => {
    generator = { generate: jest.fn().mockResolvedValue(manifest) };
    logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as unknown as jest.Mocked<CustomLogger>;
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    job = new ConsultationExportJob(
      generator as unknown as ConsultationExportGenerator,
      "https://mattermost.test/hooks/x",
      logger,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("generates the export and stays silent on Mattermost when it succeeds, every night", async () => {
    await expect(job.run({ force: true })).resolves.toEqual(manifest);
    expect(generator.generate).toHaveBeenCalledWith({ force: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a refusal, the previous export being kept", async () => {
    generator.generate.mockRejectedValueOnce(new ExportRefusedError(["opendata: aucun projet"]));

    await expect(job.run()).rejects.toBeInstanceOf(ExportRefusedError);

    const [text] = postedTexts();
    expect(text).toContain("Export de la consultation refusé");
    expect(text).toContain("opendata: aucun projet");
    expect(text).toContain("export précédent conservé");
  });

  it("reports a failure and rethrows it", async () => {
    generator.generate.mockRejectedValueOnce(new Error("Cellar unreachable"));

    await expect(job.run()).rejects.toThrow("Cellar unreachable");

    expect(logger.error).toHaveBeenCalledWith("Consultation export failed", expect.any(Object));
    const [text] = postedTexts();
    expect(text).toContain("Export de la consultation échoué");
    expect(text).toContain("Cellar unreachable");
  });
});

describe("cron.json", () => {
  it("schedules the nightly export at the time the Sentry monitor expects", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jobs } = require("../../../../cron.json") as { jobs: { command: string }[] };
    const command = jobs.map((j) => j.command).find((c) => c.includes("export-consultation.js --scheduled"));
    expect(command?.startsWith(`${CONSULTATION_EXPORT_CRON} `)).toBe(true);
  });
});
