import type { Readable } from "node:stream";
import {
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListMultipartUploadsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ExportStore } from "./export-store";

const PREFIX = "exports/";

// Lowercase segments of letters, digits, `_`, `-` and inner dots, one sub-folder at most:
// no `..`, no leading slash, nothing that resolves outside the prefix.
const NAME_REGEX = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*(\/[a-z0-9_-]+(\.[a-z0-9_-]+)*)?$/;

/** Export store on an S3 bucket (Clever Cloud Cellar), confined to its `exports/` folder. */
export class S3ExportStore implements ExportStore {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  private key(name: string): string {
    if (!NAME_REGEX.test(name)) throw new Error(`Invalid export object name: ${JSON.stringify(name)}`);
    return `${PREFIX}${name}`;
  }

  async upload(name: string, body: Readable, contentType: string): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: this.key(name), Body: body, ContentType: contentType },
      partSize: 16 * 1024 * 1024,
      queueSize: 2,
    });
    await upload.done();
  }

  async copy(from: string, to: string): Promise<void> {
    const source = this.key(from);
    await this.client.send(
      new CopyObjectCommand({ Bucket: this.bucket, CopySource: `${this.bucket}/${source}`, Key: this.key(to) }),
    );
  }

  async delete(name: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
  }

  async putJson(name: string, value: unknown): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(name),
        Body: JSON.stringify(value, null, 2),
        ContentType: "application/json",
      }),
    );
  }

  async getJson<T>(name: string): Promise<T | null> {
    try {
      const { Body } = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
      return Body ? (JSON.parse(await Body.transformToString()) as T) : null;
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async abortIncompleteUploads(): Promise<number> {
    const { Uploads = [] } = await this.client.send(
      new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: PREFIX }),
    );
    let aborted = 0;
    for (const { Key, UploadId } of Uploads) {
      // the prefix filter is the server's: checked again before deleting anything
      if (!Key?.startsWith(PREFIX) || !UploadId) continue;
      await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key, UploadId }));
      aborted++;
    }
    return aborted;
  }

  presignedGetUrl(name: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }), {
      expiresIn: expiresInSeconds,
    });
  }
}

/** Store built from the Cellar add-on variables, null where they are not all set. */
export function exportStoreFromEnv(get: (key: string) => string | undefined): S3ExportStore | null {
  const host = get("CELLAR_ADDON_HOST");
  const accessKeyId = get("CELLAR_ADDON_KEY_ID");
  const secretAccessKey = get("CELLAR_ADDON_KEY_SECRET");
  const bucket = get("CELLAR_EXPORT_BUCKET");
  if (!host || !accessKeyId || !secretAccessKey || !bucket) return null;

  const client = new S3Client({
    endpoint: `https://${host}`,
    region: "us-east-1", // required by the SDK, ignored by Cellar
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    // Cellar does not support the integrity checksums the SDK adds by default since 3.729
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return new S3ExportStore(client, bucket);
}
