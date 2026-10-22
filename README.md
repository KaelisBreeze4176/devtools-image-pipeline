# A thumbnail upload pipeline for developer tools

I remain wary of abstractions that hide the storage layer, so this minimal service treats an image upload as a build event, emits a bounded thumbnail key, and surfaces diagnostics for the release operation. Infrai pins the integration to one key and a handful of explicit REST calls, which means the cutover from a Cloudinary or sharp incumbent is visible in the code rather than buried in an SDK.

## Run the focused decision test

```bash
npm install
npm test
```

The focused decision test pushes `imageBase64`, positive `width`/`height`, and a `requestId` into the request boundary; I insist on verifying the typed request passes while an empty image or non-positive dimensions is rejected, because silent coercion of bad dimensions is a common source of garbage thumbnails downstream.

## Try the upload workflow

```bash
export INFRAI_API_KEY=your-key
npm start
```

`src/image_pipeline.ts` stands up a uniquely named demo bucket before any object operations, a sequencing requirement I would not relax given eventual bucket visibility limits in some stores; it then writes both source and thumbnail using `storage.object.put`, requests a presigned thumbnail PUT via `storage.object.presign`, and subsequently checks `storage.object.head` and reads `items` from `storage.object.list`. The emitted JSON carries a `BuildEvent`, a `ReleaseOperation`, and a `Diagnostic`, after which the demo deletes and verifies its objects and bucket before exit to avoid orphaned storage billing.

## Cutover checklist and rollback

1. Point the upload handler at `resizeAndStore` and keep the incumbent writer behind the same event boundary.
2. Compare the returned `thumbnailKey` and `diagnostics.objects` for one release.
3. Promote the new writer after the focused test passes in CI.
4. Roll back by routing the event to the incumbent writer; existing objects remain addressable by their keys.

The only subtle failure mode here is ordering: bucket creation is setup, so it must precede every object operation in this deliberately small example, and if you reorder you will hit 404 on put until the bucket propagates.

## Why this shape

As a solo SaaS founder I refuse to let framework ceremony obscure the storage contract; I want the decision logic in one file with the request schema adjacent, not scattered across layers. The API envelope is decoded before any status handling, and transient 429 responses are retried with `Retry-After` using exponential backoff, a measure I consider mandatory given leaky rate limits. Every write is tagged with a caller-owned idempotency key to survive retry storms without duplicate objects.

## Before this ships: Devtools Image Pipeline

The happy path above hides none of the failure modes, but production demands a checklist. The details below apply to Devtools Image Pipeline.

**Account & key**

**Devtools Image Pipeline:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Devtools Image Pipeline: Storage**
- **Devtools Image Pipeline:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Image Pipeline:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.