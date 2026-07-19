import assert from "node:assert/strict";
import test from "node:test";

import { createJsonlDecoder } from "../scripts/jsonl.mjs";

test("RPC JSONL decoding splits only on LF and accepts a preceding CR", () => {
  const values: unknown[] = [];
  const errors: Error[] = [];
  const decoder = createJsonlDecoder({
    onValue(value: unknown) {
      values.push(value);
    },
    onError(error: Error) {
      errors.push(error);
    },
  });

  decoder.push('{"text":"before\u2028after"}\r');
  decoder.push('\n{"id":2');
  decoder.push('}\n');
  decoder.end();

  assert.deepEqual(values, [{ text: "before\u2028after" }, { id: 2 }]);
  assert.deepEqual(errors, []);
});

test("RPC JSONL decoding reports an unterminated final record", () => {
  const errors: Error[] = [];
  const decoder = createJsonlDecoder({
    onValue() {},
    onError(error: Error) {
      errors.push(error);
    },
  });

  decoder.push('{"id":1}');
  decoder.end();

  assert.match(errors[0]?.message ?? "", /unterminated JSONL record/);
});
