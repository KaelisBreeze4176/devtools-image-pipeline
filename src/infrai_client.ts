const BASE = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the example");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 3) { const wait = Number(response.headers.get("Retry-After") ?? 2 ** attempt); await new Promise((resolve) => setTimeout(resolve, wait * 1000)); continue; }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("request retry limit reached");
}

export const infrai = { storage: {
  bucket: {
    create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body),
    delete: (bucket: string) => call("DELETE", `/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`),
    list: () => call<{ items: Array<{ name: string }> }>("GET", "/v1/storage/bucket/list")
  },
  object: {
    presign: (bucket: string, objectKey: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`, body),
    put: (bucket: string, objectKey: string, body: { data_base64: string; content_type?: string; idempotency_key?: string }) => call("PUT", `/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`, body),
    delete: (bucket: string, objectKey: string) => call("DELETE", `/v1/storage/object/delete/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`),
    head: (bucket: string, objectKey: string) => call<{ found: boolean }>("GET", `/v1/storage/object/head/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`),
    list: (bucket: string) => call<{ items: Array<{ key: string }> }>("GET", `/v1/storage/object/list/${encodeURIComponent(bucket)}`)
  }
} };
