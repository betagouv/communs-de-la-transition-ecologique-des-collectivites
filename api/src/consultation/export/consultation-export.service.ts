import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConsultationService } from "../consultation.service";
import { ExportFichierResponse } from "./consultation-export.dto";
import { EXPORT_STORE, ExportManifest, ExportStore, MANIFEST } from "./export-store";

export const EXPORT_URL_TTL_SECONDS = 15 * 60;

@Injectable()
export class ConsultationExportService {
  constructor(
    private readonly consultation: ConsultationService,
    @Inject(EXPORT_STORE) private readonly store: ExportStore | null,
  ) {}

  /** The export file of the caller's profile, with a presigned download link. */
  async fichier(serviceType: string): Promise<ExportFichierResponse> {
    if (!this.store) throw new ServiceUnavailableException("Export indisponible dans cet environnement");
    const [profil, manifest] = await Promise.all([
      this.consultation.profilExport(serviceType),
      this.store.getJson<ExportManifest>(MANIFEST),
    ]);
    const entry = manifest?.profils[profil];
    if (!manifest || !entry) throw new ServiceUnavailableException("Export pas encore généré");

    return {
      profil,
      generatedAt: manifest.generatedAt,
      nbProjets: entry.nbProjets,
      octets: entry.octets,
      sha256: entry.sha256,
      url: await this.store.presignedGetUrl(entry.fichier, EXPORT_URL_TTL_SECONDS),
      urlExpireDans: EXPORT_URL_TTL_SECONDS,
    };
  }
}
