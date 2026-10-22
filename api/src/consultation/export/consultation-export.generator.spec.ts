import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";
import type { ConsultationService, ExportProfile, ProjetsParams } from "../consultation.service";
import type { ProjetConsultationDto, ProjetsConsultationResponse } from "../dto/projet-consultation.dto";
import { ConsultationExportGenerator, ExportRefusedError } from "./consultation-export.generator";
import type { ExportManifest, ExportStore } from "./export-store";

class MemoryStore implements ExportStore {
  objects = new Map<string, Buffer>();
  aborted = 0;

  async upload(name: string, body: Readable): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk as Buffer);
    this.objects.set(name, Buffer.concat(chunks));
  }
  copy(from: string, to: string): Promise<void> {
    this.objects.set(to, this.objects.get(from)!);
    return Promise.resolve();
  }
  delete(name: string): Promise<void> {
    this.objects.delete(name);
    return Promise.resolve();
  }
  putJson(name: string, value: unknown): Promise<void> {
    this.objects.set(name, Buffer.from(JSON.stringify(value)));
    return Promise.resolve();
  }
  getJson<T>(name: string): Promise<T | null> {
    const object = this.objects.get(name);
    return Promise.resolve(object ? (JSON.parse(object.toString()) as T) : null);
  }
  abortIncompleteUploads(): Promise<number> {
    return Promise.resolve(this.aborted);
  }
  presignedGetUrl(): Promise<string> {
    return Promise.resolve("");
  }
}

const projet = (nom: string) => ({ nom }) as unknown as ProjetConsultationDto;

// A base of `counts[profil]` projects, served by pages of `limit` through a numeric cursor.
const fakeConsultation = (counts: Record<ExportProfile, number>) =>
  ({
    projetsExport: jest.fn((profil: ExportProfile, { limit, cursor }: ProjetsParams) => {
      const start = Number(cursor ?? 0);
      const end = Math.min(start + limit, counts[profil]);
      const data = Array.from({ length: end - start }, (_, i) => projet(`${profil} ${start + i}`));
      return Promise.resolve({
        data,
        limit,
        nextCursor: end < counts[profil] ? String(end) : null,
      } satisfies ProjetsConsultationResponse);
    }),
  }) as unknown as ConsultationService;

const lines = (store: MemoryStore, name: string) =>
  gunzipSync(store.objects.get(name)!)
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((l) => (JSON.parse(l) as { nom: string }).nom);

describe("ConsultationExportGenerator", () => {
  let store: MemoryStore;
  const now = new Date("2026-10-23T03:00:00Z");

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("writes one gzipped NDJSON file per profile, every page walked, and a manifest", async () => {
    const generator = new ConsultationExportGenerator(fakeConsultation({ interne_etat: 2500, opendata: 3 }), store);

    const manifest = await generator.generate({ now });

    const interne = lines(store, "projets-interne_etat.ndjson.gz");
    expect(interne).toHaveLength(2500);
    expect(interne[0]).toBe("interne_etat 0");
    expect(interne[2499]).toBe("interne_etat 2499");
    expect(lines(store, "projets-opendata.ndjson.gz")).toEqual(["opendata 0", "opendata 1", "opendata 2"]);

    const fichier = store.objects.get("projets-opendata.ndjson.gz")!;
    expect(manifest).toEqual({
      generatedAt: "2026-10-23T03:00:00.000Z",
      profils: {
        interne_etat: expect.objectContaining({
          fichier: "projets-interne_etat.ndjson.gz",
          nbProjets: 2500,
        }) as ExportManifest["profils"]["interne_etat"],
        opendata: {
          fichier: "projets-opendata.ndjson.gz",
          nbProjets: 3,
          octets: fichier.length,
          sha256: createHash("sha256").update(fichier).digest("hex"),
        },
      },
    } satisfies ExportManifest);
    expect(await store.getJson("manifest.json")).toEqual(manifest);
  });

  it("leaves no temporary object behind", async () => {
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 1, opendata: 1 }), store).generate({ now });
    expect([...store.objects.keys()].sort()).toEqual([
      "manifest.json",
      "projets-interne_etat.ndjson.gz",
      "projets-opendata.ndjson.gz",
    ]);
  });

  it("replaces the previous files in place", async () => {
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 4, opendata: 2 }), store).generate({ now });
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 5, opendata: 3 }), store).generate({ now });
    expect(lines(store, "projets-opendata.ndjson.gz")).toHaveLength(3);
    expect(store.objects.size).toBe(3);
  });

  it("keeps the previous export when a profile is empty or lost more than half its projects", async () => {
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 100, opendata: 50 }), store).generate({
      now,
    });
    const before = new Map(store.objects);

    for (const counts of [
      { interne_etat: 100, opendata: 0 },
      { interne_etat: 49, opendata: 50 },
    ]) {
      const generator = new ConsultationExportGenerator(fakeConsultation(counts), store);
      await expect(generator.generate({ now })).rejects.toBeInstanceOf(ExportRefusedError);
      expect(store.objects).toEqual(before);
    }
  });

  it("explains why it refused", async () => {
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 100, opendata: 50 }), store).generate({
      now,
    });
    const generator = new ConsultationExportGenerator(fakeConsultation({ interne_etat: 30, opendata: 50 }), store);
    await expect(generator.generate({ now })).rejects.toThrow(
      "interne_etat: 30 projets < 50 (moitié du précédent : 100)",
    );
  });

  it("publishes a smaller export when forced", async () => {
    await new ConsultationExportGenerator(fakeConsultation({ interne_etat: 100, opendata: 50 }), store).generate({
      now,
    });
    const manifest = await new ConsultationExportGenerator(
      fakeConsultation({ interne_etat: 10, opendata: 5 }),
      store,
    ).generate({ now, force: true });
    expect(manifest.profils.interne_etat.nbProjets).toBe(10);
  });

  it("still refuses an empty export when forced", async () => {
    const generator = new ConsultationExportGenerator(fakeConsultation({ interne_etat: 0, opendata: 5 }), store);
    await expect(generator.generate({ now, force: true })).rejects.toThrow("interne_etat: aucun projet");
  });
});
