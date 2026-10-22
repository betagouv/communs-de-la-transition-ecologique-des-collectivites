import { Readable } from "node:stream";
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
import { exportStoreFromEnv, S3ExportStore } from "./s3-export-store";

jest.mock("@aws-sdk/lib-storage", () => ({
  Upload: jest.fn().mockImplementation(() => ({ done: jest.fn().mockResolvedValue({}) })),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://cellar.test/communs/exports/f?signature"),
}));

describe("S3ExportStore", () => {
  let send: jest.Mock;
  let store: S3ExportStore;
  const sent = () => send.mock.calls.map(([command]) => command as { constructor: unknown; input: unknown });

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    store = new S3ExportStore({ send } as unknown as S3Client, "communs");
  });

  it("writes every object under exports/ of the bucket", async () => {
    await store.upload("tmp/projets-opendata.ndjson.gz", Readable.from(["x"]), "application/gzip");
    await store.copy("tmp/projets-opendata.ndjson.gz", "projets-opendata.ndjson.gz");
    await store.delete("tmp/projets-opendata.ndjson.gz");
    await store.putJson("manifest.json", { ok: true });

    expect(Upload).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          Bucket: "communs",
          Key: "exports/tmp/projets-opendata.ndjson.gz",
          ContentType: "application/gzip",
        }) as unknown,
      }),
    );
    const [copy, del, put] = sent();
    expect(copy).toBeInstanceOf(CopyObjectCommand);
    expect(copy.input).toEqual({
      Bucket: "communs",
      CopySource: "communs/exports/tmp/projets-opendata.ndjson.gz",
      Key: "exports/projets-opendata.ndjson.gz",
    });
    expect(del).toBeInstanceOf(DeleteObjectCommand);
    expect(del.input).toEqual({ Bucket: "communs", Key: "exports/tmp/projets-opendata.ndjson.gz" });
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({ Key: "exports/manifest.json", ContentType: "application/json" });
  });

  it.each(["../logos/a.png", "/logos/a.png", "a/../../b", "", "tmp//x", "Logo.PNG"])(
    "refuses a name that could reach outside exports/: %p",
    async (name) => {
      await expect(store.delete(name)).rejects.toThrow("Invalid export object name");
      await expect(store.copy("manifest.json", name)).rejects.toThrow("Invalid export object name");
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("reads back a JSON object, null when it does not exist", async () => {
    send.mockResolvedValueOnce({ Body: { transformToString: () => Promise.resolve('{"a":1}') } });
    await expect(store.getJson("manifest.json")).resolves.toEqual({ a: 1 });
    expect(sent()[0]).toBeInstanceOf(GetObjectCommand);

    send.mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NoSuchKey" }));
    await expect(store.getJson("manifest.json")).resolves.toBeNull();

    send.mockRejectedValueOnce(new Error("network down"));
    await expect(store.getJson("manifest.json")).rejects.toThrow("network down");
  });

  it("aborts the incomplete multipart uploads of exports/ only", async () => {
    send.mockResolvedValueOnce({
      Uploads: [
        { Key: "exports/tmp/projets-interne_etat.ndjson.gz", UploadId: "u1" },
        { Key: "logos/x.png", UploadId: "u2" },
      ],
    });

    await expect(store.abortIncompleteUploads()).resolves.toBe(1);

    const [list, abort, ...rest] = sent();
    expect(list).toBeInstanceOf(ListMultipartUploadsCommand);
    expect(list.input).toEqual({ Bucket: "communs", Prefix: "exports/" });
    expect(abort).toBeInstanceOf(AbortMultipartUploadCommand);
    expect(abort.input).toEqual({
      Bucket: "communs",
      Key: "exports/tmp/projets-interne_etat.ndjson.gz",
      UploadId: "u1",
    });
    expect(rest).toEqual([]);
  });

  it("signs a short-lived download URL", async () => {
    await expect(store.presignedGetUrl("projets-opendata.ndjson.gz", 900)).resolves.toContain("signature");
    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0] as [unknown, GetObjectCommand, unknown];
    expect(command.input).toEqual({ Bucket: "communs", Key: "exports/projets-opendata.ndjson.gz" });
    expect(options).toEqual({ expiresIn: 900 });
  });
});

describe("exportStoreFromEnv", () => {
  const env = {
    CELLAR_ADDON_HOST: "cellar-c2.services.clever-cloud.com",
    CELLAR_ADDON_KEY_ID: "id",
    CELLAR_ADDON_KEY_SECRET: "secret",
    CELLAR_EXPORT_BUCKET: "communs",
  };

  it("builds a store when Cellar is configured", () => {
    expect(exportStoreFromEnv((k) => env[k as keyof typeof env])).toBeInstanceOf(S3ExportStore);
  });

  it.each(Object.keys(env))("returns null without %s", (missing) => {
    expect(exportStoreFromEnv((k) => (k === missing ? undefined : env[k as keyof typeof env]))).toBeNull();
  });
});
