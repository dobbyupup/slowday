import assert from "node:assert/strict";
import test from "node:test";
import { parseAuthenticatedIdentity } from "../app/auth-identity.ts";
import { paginationValues, validDate, validMonth } from "../app/api/validation.ts";
import { extractOpenAIOutput } from "../app/api/openai-response.ts";
import { extractDeepSeekOutput } from "../app/api/deepseek-response.ts";
import { safeCustomBaseUrl } from "../app/api/ai-config/custom-url.ts";

test("calendar validation rejects impossible dates", () => {
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2026-13-01"), false);
  assert.equal(validDate("2026-04-31"), false);
  assert.equal(validMonth("2026-12"), true);
  assert.equal(validMonth("2026-13"), false);
});

test("pagination is bounded", () => {
  assert.deepEqual(paginationValues(null, null), { limit: 100, offset: 0 });
  assert.deepEqual(paginationValues("200", "100000"), { limit: 200, offset: 100000 });
  assert.equal(paginationValues("201", "0"), null);
  assert.equal(paginationValues("10", "-1"), null);
});

test("authenticated identity requires stable id and email", () => {
  assert.equal(parseAuthenticatedIdentity(new Headers({ "oai-authenticated-user-email": "owner@example.com" })), null);
  const user = parseAuthenticatedIdentity(new Headers({
    "oai-authenticated-user-id": "site-user-123",
    "oai-authenticated-user-email": "owner@example.com",
    "oai-authenticated-user-full-name": "%E6%85%A2%E6%97%A5",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  }));
  assert.deepEqual(user, { id: "site-user-123", email: "owner@example.com", fullName: "慢日", displayName: "慢日" });
});

test("Responses API output is extracted from the raw REST shape", () => {
  const text = extractOpenAIOutput({ status: "completed", output: [{
    type: "message",
    content: [{ type: "output_text", text: '{"analysis":"继续保持"}' }],
  }] });
  assert.equal(text, '{"analysis":"继续保持"}');
  assert.equal(extractOpenAIOutput({ status: "incomplete", output: [] }), null);
});

test("DeepSeek chat completion output is extracted safely", () => {
  assert.equal(extractDeepSeekOutput({ choices: [{ message: { content: '{"analysis":"继续保持"}' } }] }), '{"analysis":"继续保持"}');
  assert.equal(extractDeepSeekOutput({ choices: [] }), null);
  assert.equal(extractDeepSeekOutput({ choices: [{ message: { content: "   " } }] }), null);
});

test("custom model URL only accepts public HTTPS-style endpoints", () => {
  assert.equal(safeCustomBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
  assert.equal(safeCustomBaseUrl("http://api.example.com/v1"), null);
  assert.equal(safeCustomBaseUrl("https://127.0.0.1/v1"), null);
  assert.equal(safeCustomBaseUrl("https://192.168.1.2/v1"), null);
  assert.equal(safeCustomBaseUrl("https://metadata.google.internal/computeMetadata/v1"), null);
});
