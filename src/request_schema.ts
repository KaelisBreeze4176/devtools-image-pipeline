export type UploadRequest = { imageBase64: string; width: number; height: number; requestId: string };
export function parseUploadRequest(input: unknown): UploadRequest {
  if (!input || typeof input !== "object") throw new Error("request body must be an object");
  const value = input as Record<string, unknown>;
  if (typeof value.imageBase64 !== "string" || value.imageBase64.length === 0) throw new Error("imageBase64 is required");
  if (!Number.isInteger(value.width) || !Number.isInteger(value.height) || (value.width as number) <= 0 || (value.height as number) <= 0) throw new Error("width and height must be positive integers");
  if (typeof value.requestId !== "string" || value.requestId.length === 0) throw new Error("requestId is required");
  return { imageBase64: value.imageBase64, width: value.width as number, height: value.height as number, requestId: value.requestId };
}
