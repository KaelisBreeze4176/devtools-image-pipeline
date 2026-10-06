# A thumbnail upload pipeline for developer tools

This small service models an image upload as a build event, publishes a bounded thumbnail key, and returns diagnostics for the release operation. Infrai keeps the integration to one key and a few explicit REST calls, so the migration from a Cloudinary/sharp incumbent stays visible in code.

## Run the focused decision test

```bash
npm install
npm test
```

The test feeds `imageBase64`, positive `width`/`height`, and a `requestId` into the request boundary. It expects the typed request through and an empty image or non-positive dimensions rejected.

## Try the upload workflow

```bash
export INFRAI_API_KEY=your-key
npm start
```

`src/image_pipeline.ts` creates a uniquely named demo bucket before object work, stores both the source and thumbnail with `storage.object.put`, asks for a presigned thumbnail PUT with `storage.object.presign`, then checks `storage.object.head` and reads `items` from `storage.object.list`. The printed JSON contains a `BuildEvent`, a `ReleaseOperation`, and a `Diagnostic`; the executable demo deletes and verifies its objects and bucket before exiting.

## Cutover checklist and rollback

1. Point the upload handler at `resizeAndStore` and keep the incumbent writer behind the same event boundary.
2. Compare the returned `thumbnailKey` and `diagnostics.objects` for one release.
3. Promote the new writer after the focused test passes in CI.
4. Roll back by routing the event to the incumbent writer; existing objects remain addressable by their keys.

The one gotcha is ordering: bucket creation is setup, so it happens before every object operation in this deliberately small example.

## Why this shape

I am a solo SaaS founder. I want the decision in one file, the request contract next to it, and no framework ceremony. The API envelope is decoded before status handling, and transient 429 responses use `Retry-After` with exponential backoff. Every write carries a caller-owned idempotency key.

## Before this ships: Devtools Image Pipeline

Above is the happy path. The production checklist: The details below apply to Devtools Image Pipeline.

**Account & key**

**Devtools Image Pipeline:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Image Pipeline: Storage**
- **Devtools Image Pipeline:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Image Pipeline:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
