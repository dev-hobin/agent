import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
	DEFAULT_OBSERVER_PROCESSING_POLICY,
	decodeObserverProcessingPolicy,
	fileObserverProcessingPolicyStore,
	isLocalObserverModel,
	modelsInObserverSessionScope,
	processingPolicy,
} from "../src/observer-processing-policy.ts";

describe("Observer processing policy", () => {
	test("defaults to Piggyback and requires an explicit model for local work", () => {
		assert.equal(DEFAULT_OBSERVER_PROCESSING_POLICY.mode, "piggyback");
		const invalid = decodeObserverProcessingPolicy({
			observer_processing: "observer-processing/v1",
			mode: "local",
			local_model: null,
		});
		assert.equal(invalid.ok, false);
		assert.equal(invalid.policy.mode, "piggyback");
	});

	test("accepts loopback models without trusting cost metadata", () => {
		assert.equal(
			isLocalObserverModel({
				provider: "ollama",
				id: "qwen-local",
				baseUrl: "http://127.0.0.1:11434/v1",
			}),
			true,
		);
		assert.equal(
			isLocalObserverModel({
				provider: "remote-free-label",
				id: "not-local",
				baseUrl: "https://api.example.test/v1",
			}),
			false,
		);
	});

	test("honors Pi session model scope while retaining old and unscoped fallback", () => {
		const available = [
			{ provider: "ollama", id: "allowed" },
			{ provider: "llama.cpp", id: "outside-scope" },
		];
		assert.deepEqual(modelsInObserverSessionScope(available, undefined), available);
		assert.deepEqual(modelsInObserverSessionScope(available, []), available);
		assert.deepEqual(
			modelsInObserverSessionScope(available, [
				{ provider: "ollama", id: "allowed" },
			]),
			[available[0]],
		);
		assert.deepEqual(
			modelsInObserverSessionScope(available, [
				{ provider: "ollama", id: "missing" },
			]),
			[],
		);
	});

	test("persists an exact local model selection", async () => {
		const sandbox = await mkdtemp(join(tmpdir(), "observer-processing-"));
		try {
			const store = fileObserverProcessingPolicyStore(
				join(sandbox, "processing.json"),
			);
			assert.deepEqual((await store.load()).policy, {
				observer_processing: "observer-processing/v1",
				mode: "piggyback",
				local_model: null,
			});
			await store.save(
				processingPolicy("local", {
					provider: "llama.cpp",
					model_id: "local-model.gguf",
				}),
			);
			assert.deepEqual((await store.load()).policy, {
				observer_processing: "observer-processing/v1",
				mode: "local",
				local_model: {
					provider: "llama.cpp",
					model_id: "local-model.gguf",
				},
			});
		} finally {
			await rm(sandbox, { recursive: true, force: true });
		}
	});
});
