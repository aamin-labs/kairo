import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonResponse } from "../lib/coaching.ts";

test("parses raw JSON model response", () => {
  assert.deepEqual(parseJsonResponse<{ text: string }>('{"text":"Good."}'), { text: "Good." });
});

test("parses fenced JSON model response", () => {
  assert.deepEqual(parseJsonResponse<{ text: string }>('```json\n{"text":"Good."}\n```'), { text: "Good." });
});

test("parses JSON wrapped in model prose", () => {
  assert.deepEqual(
    parseJsonResponse<{ text: string }>('Instructions followed:\n{"text":"Good.","followUpPrompt":"Why?"}'),
    { text: "Good.", followUpPrompt: "Why?" }
  );
});

test("returns clear error when model returns no JSON object", () => {
  assert.throws(() => parseJsonResponse("Instructions followed but no object."), /Model did not return JSON/);
});
