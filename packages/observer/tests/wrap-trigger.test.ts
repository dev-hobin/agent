import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import { OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
import { decodeObserverMarkdown } from "../src/markdown-profile.ts";
import { reconstructMemoSession } from "../src/memo-session.ts";
import {
	OBSERVER_NOTEBOOK_SCHEMA,
	type NotebookHandle,
	type NotebookInventoryEntry,
} from "../src/notebook.ts";
import {
	prepareObservationEvent,
	type SourceReadRecordedEvent,
} from "../src/observation-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";
import {
	buildWrapPreparationGuide,
	decodeWrapRequestEvent,
	encodeWrapRequestEvent,
	hydrateWrapPreparationContext,
	OBSERVER_WRAP_REQUEST_ENTRY,
	planWrapRequest,
	reconstructWrapRequestSession,
} from "../src/wrap-trigger.ts";

const NOTEBOOK_ID = "notebook-00000000-0000-4000-8000-000000000701";
const EPISODE_ID = "episode-wrap-pure";
const REQUEST_ID =
	"wrap-request-00000000-0000-4000-8000-000000000702";
const PROPOSAL_ID = "proposal-00000000-0000-4000-8000-000000000703";
const SOURCE_READ_ID =
	"source-read-00000000-0000-4000-8000-000000000704";
const SOURCE_ID = "source-00000000-0000-4000-8000-000000000705";
const FIXTURE_ROOT = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);

function custom(customType: string, data: unknown): PiBranchEntryLike {
	return { type: "custom", customType, data };
}

function lifecycleEntries(): readonly PiBranchEntryLike[] {
	return [
		custom(OBSERVER_LIFECYCLE_ENTRY, {
			protocol: OBSERVER_PROTOCOL,
			kind: "notebook-selected",
			notebookId: NOTEBOOK_ID,
		}),
		custom(OBSERVER_LIFECYCLE_ENTRY, {
			protocol: OBSERVER_PROTOCOL,
			kind: "episode-opened",
			episodeId: EPISODE_ID,
			notebookId: NOTEBOOK_ID,
			lang: "en",
		}),
		custom(OBSERVER_LIFECYCLE_ENTRY, {
			protocol: OBSERVER_PROTOCOL,
			kind: "activation-changed",
			enabled: false,
		}),
	];
}

function notebook(): NotebookHandle {
	return {
		root: "/tmp/observer-wrap-pure",
		recordsDir: "/tmp/observer-wrap-pure/records",
		manifestPath: "/tmp/observer-wrap-pure/.observer/notebook.json",
		manifest: {
			observer_notebook: OBSERVER_NOTEBOOK_SCHEMA,
			notebook_id: NOTEBOOK_ID,
			default_language: "en",
		},
		recordCount: 6,
	};
}

async function inventory(): Promise<readonly NotebookInventoryEntry[]> {
	return Promise.all(
		[
			"inquiry.md",
			"memo-incubating.md",
			"memo-promoted.md",
			"source-direct.md",
			"source-external.md",
			"zettel.md",
		].map(async (name) => {
			const path = join(FIXTURE_ROOT, name);
			const content = await readFile(path, "utf8");
			const decoded = decodeObserverMarkdown({ path, content });
			if (!decoded.ok) assert.fail(JSON.stringify(decoded.diagnostics));
			return {
				path,
				relativePath: name,
				content,
				sha256: sha256Text(content),
				document: decoded.value,
			};
		}),
	);
}

function sourceRead(): SourceReadRecordedEvent {
	const prepared = prepareObservationEvent({
		observer_observation: "observer-observation/v1",
		kind: "source-read-recorded",
		episode_id: EPISODE_ID,
		read_id: SOURCE_READ_ID,
		candidate_ids: [
			"candidate-00000000-0000-4000-8000-000000000706",
		],
		source: {
			kind: "external-material",
			source_id: SOURCE_ID,
			title: "Wrap source",
			lang: "en",
			uri: "https://example.test/wrap-source",
			revision: null,
			content_hash: null,
			retrieval_context: "pure wrap fixture",
		},
		faithful_summary: "The source remains available for durable wrapping.",
		claims: [{ text: "One wrap claim.", locator: null }],
		candidate_digest: sha256Text("candidate basis"),
		index_digest: sha256Text("standing index"),
		index_inquiry_ids: [],
	});
	if (!prepared.ok || prepared.value.kind !== "source-read-recorded")
		assert.fail(prepared.ok ? "Expected SourceRead" : prepared.issue.message);
	return prepared.value;
}

function scenario(entries: readonly PiBranchEntryLike[]) {
	const observationBase = reconstructObservationSession(entries);
	const observation = {
		...observationBase,
		sourceReads: [sourceRead()],
	};
	return {
		observation,
		memo: reconstructMemoSession(entries),
		requestSession: reconstructWrapRequestSession(entries),
	};
}

describe("pure Wrap request and preparation context", () => {
	test("strictly decodes, replays, resumes, and consumes one request", async () => {
		const entries = lifecycleEntries();
		const current = scenario(entries);
		const records = await inventory();
		const planned = planWrapRequest({
			...current,
			inventory: records,
			notebook: notebook(),
			requestId: REQUEST_ID,
			proposalId: PROPOSAL_ID,
		});
		if (!planned.ok) assert.fail(planned.issue.message);
		assert.equal(planned.value.kind, "new");
		const encoded = encodeWrapRequestEvent(planned.value.request);
		assert.deepEqual(decodeWrapRequestEvent(encoded), {
			ok: true,
			value: planned.value.request,
		});
		assert.equal(
			decodeWrapRequestEvent({ ...encoded, extra: true }).ok,
			false,
		);

		const requestedEntries = [
			...entries,
			custom(OBSERVER_WRAP_REQUEST_ENTRY, encoded),
		];
		const requested = scenario(requestedEntries);
		const resumed = planWrapRequest({
			...requested,
			inventory: records,
			notebook: notebook(),
			requestId:
				"wrap-request-00000000-0000-4000-8000-000000000799",
			proposalId: "proposal-00000000-0000-4000-8000-000000000799",
		});
		if (!resumed.ok) assert.fail(resumed.issue.message);
		assert.equal(resumed.value.kind, "resume");
		assert.equal(resumed.value.request.requestId, REQUEST_ID);

		const exactDuplicate = reconstructWrapRequestSession([
			...requestedEntries,
			custom(OBSERVER_WRAP_REQUEST_ENTRY, encoded),
		]);
		assert.equal(exactDuplicate.issues.length, 0);
		assert.equal(exactDuplicate.requests.length, 1);

		const consumed = reconstructWrapRequestSession([
			...requestedEntries,
			custom(OBSERVER_LIFECYCLE_ENTRY, {
				protocol: OBSERVER_PROTOCOL,
				kind: "wrap-proposed",
				proposalId: PROPOSAL_ID,
				summary: "Prepared wrap",
			}),
		]);
		assert.equal(consumed.pendingRequest, null);
		assert.deepEqual(consumed.consumedRequestIds, [REQUEST_ID]);
	});

	test("projects one exact deterministic guide and rejects stale or pending work", async () => {
		const entries = lifecycleEntries();
		const current = scenario(entries);
		const records = await inventory();
		const planned = planWrapRequest({
			...current,
			inventory: records,
			notebook: notebook(),
			requestId: REQUEST_ID,
			proposalId: PROPOSAL_ID,
		});
		if (!planned.ok) assert.fail(planned.issue.message);
		const requestedEntries = [
			...entries,
			custom(
				OBSERVER_WRAP_REQUEST_ENTRY,
				encodeWrapRequestEvent(planned.value.request),
			),
		];
		const requested = scenario(requestedEntries);
		const context = hydrateWrapPreparationContext({
			request: planned.value.request,
			...requested,
			inventory: records,
			notebook: notebook(),
		});
		if (!context.ok) assert.fail(context.issue.message);
		const guide = buildWrapPreparationGuide(context.value);
		assert.equal(guide.request.request_id, REQUEST_ID);
		assert.equal(guide.locked_target.proposal_id, PROPOSAL_ID);
		assert.equal(guide.observed_sources[0]?.read_id, SOURCE_READ_ID);
		assert.equal(guide.inventory.length, 6);
		assert.deepEqual(buildWrapPreparationGuide(context.value), guide);

		const changedInventory = records.map((entry, index) =>
			index === 0 ? { ...entry, sha256: sha256Text("changed") } : entry,
		);
		const stale = hydrateWrapPreparationContext({
			request: planned.value.request,
			...requested,
			inventory: changedInventory,
			notebook: notebook(),
		});
		assert.equal(stale.ok, false);
		if (!stale.ok) assert.equal(stale.issue.code, "wrap-request.stale");

		const pendingObservation = planWrapRequest({
			...current,
			observation: {
				...current.observation,
				unconsumedObservationIds: [
					"observation-00000000-0000-4000-8000-000000000708",
				],
			},
			inventory: records,
			notebook: notebook(),
			requestId: REQUEST_ID,
			proposalId: PROPOSAL_ID,
		});
		assert.equal(pendingObservation.ok, false);
		if (!pendingObservation.ok)
			assert.equal(pendingObservation.issue.code, "wrap-request.pending");
	});

	test("fails closed for conflicting request identity and stale resume basis", async () => {
		const entries = lifecycleEntries();
		const current = scenario(entries);
		const records = await inventory();
		const planned = planWrapRequest({
			...current,
			inventory: records,
			notebook: notebook(),
			requestId: REQUEST_ID,
			proposalId: PROPOSAL_ID,
		});
		if (!planned.ok) assert.fail(planned.issue.message);
		const encoded = encodeWrapRequestEvent(planned.value.request);
		const conflict = reconstructWrapRequestSession([
			...entries,
			custom(OBSERVER_WRAP_REQUEST_ENTRY, encoded),
			custom(OBSERVER_WRAP_REQUEST_ENTRY, {
				...encoded,
				request_digest: sha256Text("conflict"),
			}),
		]);
		assert.equal(conflict.issues[0]?.code, "wrap-request.conflict");

		const requestedEntries = [
			...entries,
			custom(OBSERVER_WRAP_REQUEST_ENTRY, encoded),
		];
		const requested = scenario(requestedEntries);
		const changedMemo = {
			...requested.memo,
			state: {
				...requested.memo.state,
				passes: requested.memo.state.passes + 1,
			},
		};
		const stale = planWrapRequest({
			...requested,
			memo: changedMemo,
			inventory: records,
			notebook: notebook(),
			requestId: REQUEST_ID,
			proposalId: PROPOSAL_ID,
		});
		assert.equal(stale.ok, false);
		if (!stale.ok) assert.equal(stale.issue.code, "wrap-request.stale");
	});
});
