import { parseUploadRequest } from "./request_schema.ts";
const parsed = parseUploadRequest({ imageBase64: "aGVsbG8=", width: 640, height: 480, requestId: "test-1" });
if (parsed.width !== 640 || parsed.requestId !== "test-1") throw new Error("valid upload request was not accepted");
let rejected = false;
try { parseUploadRequest({ imageBase64: "", width: 0, height: 2, requestId: "" }); } catch { rejected = true; }
if (!rejected) throw new Error("invalid upload request was accepted");
console.log("request boundary test passed");
