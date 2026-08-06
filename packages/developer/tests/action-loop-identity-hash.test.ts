import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
	hashIdentity,
	sha256Bytes,
} from "../src/action-loop/identity/hash-identity.ts";

const encoder = new TextEncoder();

test("content hash is the standard SHA-256 of exact bytes", () => {
	const bytes = encoder.encode("exact content");
	const expected = createHash("sha256").update(bytes).digest("hex");

	assert.equal(sha256Bytes(bytes), `sha256_${expected}`);
});

test("identity hashing is deterministic, domain-separated, and part-framed", () => {
	const first = hashIdentity("id", "domain/a", ["ab", "c"]);
	const repeated = hashIdentity("id", "domain/a", ["ab", "c"]);
	const repartitioned = hashIdentity("id", "domain/a", ["a", "bc"]);
	const otherDomain = hashIdentity("id", "domain/b", ["ab", "c"]);

	assert.match(first, /^id_[a-f0-9]{64}$/);
	assert.equal(repeated, first);
	assert.notEqual(repartitioned, first);
	assert.notEqual(otherDomain, first);
});
