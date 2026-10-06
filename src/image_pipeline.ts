import { infrai } from "./infrai_client.ts";
import { parseUploadRequest, type UploadRequest } from "./request_schema.ts";

const BUCKET = "devtools-images";
export type BuildEvent = { type: "image.uploaded"; requestId: string; sourceKey: string; thumbnailKey: string; width: number; height: number };
export type ReleaseOperation = { operation: "thumbnail-published"; key: string; requestId: string };
export type Diagnostic = { requestId: string; status: "published"; objects: string[] };

export async function resizeAndStore(input: unknown, bucket = BUCKET): Promise<{ event: BuildEvent; release: ReleaseOperation; diagnostics: Diagnostic }> {
  const request: UploadRequest = parseUploadRequest(input);
  await infrai.storage.bucket.create({ name: bucket });
  const sourceKey = `uploads/${request.requestId}.bin`;
  const thumbnailKey = `thumbnails/${request.requestId}-${Math.min(request.width, 320)}x${Math.min(request.height, 320)}.bin`;
  await infrai.storage.object.put(bucket, sourceKey, { data_base64: request.imageBase64, content_type: "image/png", idempotency_key: request.requestId });
  await infrai.storage.object.presign(bucket, thumbnailKey, { op: "put", expires_seconds: 600, content_type: "image/png", idempotency_key: `${request.requestId}-thumbnail` });
  await infrai.storage.object.put(bucket, thumbnailKey, { data_base64: request.imageBase64, content_type: "image/png", idempotency_key: `${request.requestId}-thumbnail-upload` });
  const source = await infrai.storage.object.head(bucket, sourceKey);
  if (!source.found) throw new Error("source object was not found after upload");
  const thumbnail = await infrai.storage.object.head(bucket, thumbnailKey);
  if (!thumbnail.found) throw new Error("thumbnail object was not found after upload");
  const listing = await infrai.storage.object.list(bucket);
  const event: BuildEvent = { type: "image.uploaded", requestId: request.requestId, sourceKey, thumbnailKey, width: request.width, height: request.height };
  return { event, release: { operation: "thumbnail-published", key: thumbnailKey, requestId: request.requestId }, diagnostics: { requestId: request.requestId, status: "published", objects: listing.items.map((item) => item.key) } };
}

async function cleanupDemo(bucket: string, keys: string[]): Promise<void> {
  for (const objectKey of keys) {
    await infrai.storage.object.delete(bucket, objectKey);
    if ((await infrai.storage.object.head(bucket, objectKey)).found) throw new Error(`cleanup failed for ${objectKey}`);
  }
  await infrai.storage.bucket.delete(bucket);
  if ((await infrai.storage.bucket.list()).items.some((item) => item.name === bucket)) throw new Error(`cleanup failed for ${bucket}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const requestId = `demo-${Date.now()}`;
  const bucket = `devtools-images-${requestId}`;
  const sourceKey = `uploads/${requestId}.bin`;
  const thumbnailKey = `thumbnails/${requestId}-320x320.bin`;
  try {
    console.log(JSON.stringify(await resizeAndStore({ imageBase64: "aGVsbG8=", width: 640, height: 480, requestId }, bucket), null, 2));
  } finally {
    await cleanupDemo(bucket, [sourceKey, thumbnailKey]);
  }
}
