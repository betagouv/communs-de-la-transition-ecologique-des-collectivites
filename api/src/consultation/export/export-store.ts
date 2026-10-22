import type { Readable } from "node:stream";
import type { ExportProfile } from "../consultation.service";

/**
 * Object storage of the export files. Names are relative to the export folder: a store never
 * reads or writes anything else in its bucket (the bucket also holds the services' logos).
 */
export interface ExportStore {
  upload(name: string, body: Readable, contentType: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  delete(name: string): Promise<void>;
  putJson(name: string, value: unknown): Promise<void>;
  /** null when the object does not exist. */
  getJson<T>(name: string): Promise<T | null>;
  /** Aborts the multipart uploads a crashed run left behind (billed until aborted). */
  abortIncompleteUploads(): Promise<number>;
  presignedGetUrl(name: string, expiresInSeconds: number): Promise<string>;
}

export const EXPORT_STORE = Symbol("EXPORT_STORE");

export const MANIFEST = "manifest.json";
export const exportFile = (profil: ExportProfile) => `projets-${profil}.ndjson.gz`;

export interface ExportFileEntry {
  fichier: string;
  nbProjets: number;
  octets: number;
  sha256: string;
}

export interface ExportManifest {
  generatedAt: string;
  profils: Record<ExportProfile, ExportFileEntry>;
}
