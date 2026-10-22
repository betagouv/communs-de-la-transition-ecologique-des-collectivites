// Nightly export of the consolidated base: one gzipped NDJSON file per access profile, written
// by the same cursor walk as GET /consultation/v1/projets, so a file holds exactly what that
// profile reads through the API.
//
// Each file goes to a temporary object first and replaces the published one only once every
// profile passed the volume check; the manifest is written last. A failed or refused run leaves
// the previous export and manifest untouched. Fixed names: no history accumulates in the bucket.
import { createHash } from "node:crypto";
import { pipeline, Readable, Transform } from "node:stream";
import { createGzip } from "node:zlib";
import { ConsultationService, EXPORT_PROFILES, ExportProfile } from "../consultation.service";
import { ExportFileEntry, ExportManifest, exportFile, ExportStore, MANIFEST } from "./export-store";

const PAGE_SIZE = 1000;

// Below this share of the previous export, a profile is suspected truncated (failed ETL run).
const MIN_RATIO_TO_PREVIOUS = 0.5;

export class ExportRefusedError extends Error {
  constructor(readonly problems: string[]) {
    super(`Export refused: ${problems.join(", ")}`);
  }
}

export class ConsultationExportGenerator {
  constructor(
    private readonly consultation: ConsultationService,
    private readonly store: ExportStore,
  ) {}

  /** `force` publishes an export much smaller than the previous one (never an empty one). */
  async generate({ now = new Date(), force = false }: { now?: Date; force?: boolean } = {}): Promise<ExportManifest> {
    const aborted = await this.store.abortIncompleteUploads();
    if (aborted > 0) console.log(`Aborted ${aborted} incomplete upload(s) of a previous run`);
    const previous = await this.store.getJson<ExportManifest>(MANIFEST);

    const temporaires = EXPORT_PROFILES.map((profil) => `tmp/${exportFile(profil)}`);
    try {
      const profils = {} as Record<ExportProfile, ExportFileEntry>;
      const problems: string[] = [];
      for (const [i, profil] of EXPORT_PROFILES.entries()) {
        const start = Date.now();
        const entry = await this.write(profil, temporaires[i]);
        profils[profil] = entry;
        console.log(`${profil}: ${entry.nbProjets} projets, ${entry.octets} octets in ${Date.now() - start}ms`);

        const before = previous?.profils[profil]?.nbProjets ?? 0;
        if (entry.nbProjets === 0) problems.push(`${profil}: aucun projet`);
        else if (!force && entry.nbProjets < before * MIN_RATIO_TO_PREVIOUS) {
          problems.push(
            `${profil}: ${entry.nbProjets} projets < ${before * MIN_RATIO_TO_PREVIOUS} (moitié du précédent : ${before})`,
          );
        }
      }
      if (problems.length > 0) throw new ExportRefusedError(problems);

      for (const [i, profil] of EXPORT_PROFILES.entries()) {
        await this.store.copy(temporaires[i], exportFile(profil));
      }
      const manifest: ExportManifest = { generatedAt: now.toISOString(), profils };
      await this.store.putJson(MANIFEST, manifest);
      return manifest;
    } finally {
      for (const name of temporaires) await this.store.delete(name);
    }
  }

  private async write(profil: ExportProfile, name: string): Promise<ExportFileEntry> {
    let nbProjets = 0;
    let octets = 0;
    const hash = createHash("sha256");
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        octets += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    const consultation = this.consultation;
    async function* lines() {
      let cursor: string | undefined;
      do {
        const page = await consultation.projetsExport(profil, { limit: PAGE_SIZE, cursor });
        for (const projet of page.data) {
          nbProjets++;
          yield `${JSON.stringify(projet)}\n`;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    }

    // pipeline destroys every stream on error, so a failed read also fails the upload
    const body = pipeline(Readable.from(lines()), createGzip(), meter, () => undefined);
    await this.store.upload(name, body, "application/gzip");
    return { fichier: exportFile(profil), nbProjets, octets, sha256: hash.digest("hex") };
  }
}
