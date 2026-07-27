import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { observationToolText } from "../extensions/observer.ts";
import { initialObserverState, OBSERVER_PROTOCOL } from "../src/lifecycle.ts";
import {
	createNotebookService,
	type NotebookService,
} from "../src/notebook-service.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";
import {
	createObservationController,
	type ObservationCommandPort,
	type ObservationControllerIds,
} from "../src/observation-controller.ts";
import { OBSERVER_OBSERVATION_ENTRY } from "../src/observation-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "../src/pi-session.ts";

const BASELINE = join(
	import.meta.dirname,
	"fixtures",
	"notebooks",
	"valid",
	"baseline",
);
const DURABLE_INQUIRY = "inquiry-00000000-0000-4000-8000-000000000003";

class FakePort implements ObservationCommandPort {
	readonly entries: PiBranchEntryLike[] = [];
	readonly notifications: Array<{
		readonly message: string;
		readonly type: "info" | "warning" | "error";
	}> = [];
	failNextObservationAppend = false;
	dropNextObservationAppend = false;

	branchEntries(): readonly PiBranchEntryLike[] {
		return this.entries;
	}

	appendEntry(customType: string, data: unknown): void {
		if (
			this.failNextObservationAppend &&
			customType === OBSERVER_OBSERVATION_ENTRY
		) {
			this.failNextObservationAppend = false;
			throw new Error("Injected observation append failure");
		}
		if (
			this.dropNextObservationAppend &&
			customType === OBSERVER_OBSERVATION_ENTRY
		) {
			this.dropNextObservationAppend = false;
			return;
		}
		this.entries.push({ type: "custom", customType, data });
	}

	notify(message: string, type: "info" | "warning" | "error" = "info"): void {
		this.notifications.push({ message, type });
	}
}

function deterministicIds(): ObservationControllerIds {
	let candidate = 0;
	let read = 0;
	let hydration = 0;
	let observation = 0;
	let source = 0;
	let inquiry = 0;
	let memoRequest = 0;
	function suffix(value: number): string {
		return String(value).padStart(12, "0");
	}
	return {
		candidateId(): `candidate-${string}` {
			candidate += 1;
			return `candidate-00000000-0000-4000-8000-${suffix(candidate)}`;
		},
		sourceReadId(): `source-read-${string}` {
			read += 1;
			return `source-read-00000000-0000-4000-8000-${suffix(read)}`;
		},
		hydrationId(): `hydration-${string}` {
			hydration += 1;
			return `hydration-00000000-0000-4000-8000-${suffix(hydration)}`;
		},
		observationId(): `observation-${string}` {
			observation += 1;
			return `observation-00000000-0000-4000-8000-${suffix(observation)}`;
		},
		sourceId(): `source-${string}` {
			source += 1;
			return `source-00000000-0000-4000-8000-${suffix(source)}`;
		},
		inquiryId(): `inquiry-${string}` {
			inquiry += 1;
			return `inquiry-00000000-0000-4000-8000-${suffix(inquiry)}`;
		},
		memoRequestId(): `memo-request-${string}` {
			memoRequest += 1;
			return `memo-request-00000000-0000-4000-8000-${suffix(memoRequest)}`;
		},
	};
}

async function withSandbox(
	run: (input: {
		readonly sandbox: string;
		readonly service: NotebookService;
		readonly port: FakePort;
		readonly controller: ReturnType<typeof createObservationController>;
	}) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-sidecar-"));
	try {
		const root = join(sandbox, "notebook");
		await mkdir(root, { recursive: true });
		await cp(BASELINE, join(root, "records"), { recursive: true });
		const selectionStore = fileNotebookSelectionStore(
			join(sandbox, "state", "selection.json"),
		);
		const service = createNotebookService({ selectionStore });
		const setup = await service.setup({
			root,
			defaultLanguage: "en",
			state: initialObserverState(),
		});
		if (!setup.ok) assert.fail(setup.issue.message);
		const port = new FakePort();
		port.entries.push(
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "notebook-selected",
					notebookId: setup.value.notebook.manifest.notebook_id,
				},
			},
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "episode-opened",
					episodeId: "episode-sidecar-1",
					notebookId: setup.value.notebook.manifest.notebook_id,
					lang: "en",
				},
			},
			{
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "activation-changed",
					enabled: true,
				},
			},
		);
		const controller = createObservationController({
			selectionStore,
			ids: deterministicIds(),
		});
		await run({ sandbox, service, port, controller });
	} finally {
		await rm(sandbox, { force: true, recursive: true });
	}
}

function externalSourceAction(candidateId: string): Record<string, unknown> {
	return {
		observer_action: "observer-sidecar/v1",
		action: "source-read",
		candidate_ids: [candidateId],
		source: {
			kind: "external-material",
			title: "Interruption study",
			lang: "en",
			uri: "https://example.com/interruption",
			revision: null,
			content_hash: null,
			retrieval_context: "read tool result",
		},
		faithful_summary:
			"The source reports that capture timing changes interruption cost.",
		claims: [
			{
				text: "Capture timing changes interruption cost.",
				locator: "result",
			},
		],
	};
}

describe("Observation staged controller", () => {
	test("captures active candidates, returns index after source-read, and hydrates only standing IDs", async () => {
		await withSandbox(async ({ controller, port }) => {
			const captured = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-call-1",
						tool_name: "read",
					},
					text: "Source result text",
					capturedAt: "2026-08-01T10:00:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate) {
				assert.fail(captured.ok ? "Expected candidate" : captured.message);
			}
			const beforeReadEntries = port.entries.length;
			const read = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			if (!read.ok || read.action !== "source-read") {
				assert.fail(read.ok ? "Expected source-read" : read.message);
			}
			assert.equal(port.entries.length, beforeReadEntries + 1);
			assert.equal(read.index.inquiries[0]?.inquiryId, DURABLE_INQUIRY);
			const readPayload = JSON.parse(observationToolText(read));
			assert.equal(readPayload.read_id, read.read.readId);
			assert.equal(readPayload.standing_index.inquiries.length, 1);
			assert.equal("source" in readPayload, false);
			const unknown = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: ["inquiry-00000000-0000-4000-8000-000000000099"],
				},
				port,
			);
			const beforeUnknown = port.entries.length;
			assert.equal(unknown.ok, false);
			assert.equal(port.entries.length, beforeUnknown);
			const hydrated = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!hydrated.ok || hydrated.action !== "hydrate") {
				assert.fail(hydrated.ok ? "Expected hydrate" : hydrated.message);
			}
			assert.equal(hydrated.context.inquiries.length, 1);
			assert.equal(hydrated.context.memos.length, 1);
			const hydrationPayload = JSON.parse(observationToolText(hydrated));
			assert.equal(
				hydrationPayload.hydration_id,
				hydrated.hydration.hydrationId,
			);
			assert.equal(hydrationPayload.standing_context.inquiries.length, 1);
			const beforeDuplicateHydration = port.entries.length;
			const duplicateHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: read.read.readId,
					index_digest: read.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			assert.equal(duplicateHydration.ok, true);
			assert.equal(port.entries.length, beforeDuplicateHydration);
			const duplicateRead = await controller.execute(
				externalSourceAction(captured.candidate.candidateId),
				port,
			);
			assert.equal(duplicateRead.ok, false);
			assert.equal(port.entries.length, beforeDuplicateHydration);
		});
	});

	test("keeps minor observations silent and alerts only after a major append", async () => {
		await withSandbox(async ({ controller, port }) => {
			const first = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-minor",
						tool_name: "read",
					},
					text: "Minor source result",
					capturedAt: "2026-08-01T10:01:00.000Z",
				},
				port,
			);
			if (!first.ok || !first.candidate)
				assert.fail("Expected first candidate");
			const firstRead = await controller.execute(
				externalSourceAction(first.candidate.candidateId),
				port,
			);
			if (!firstRead.ok || firstRead.action !== "source-read") {
				assert.fail(firstRead.ok ? "Expected read" : firstRead.message);
			}
			const firstHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: firstRead.read.readId,
					index_digest: firstRead.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!firstHydration.ok || firstHydration.action !== "hydrate") {
				assert.fail("Expected first hydration");
			}
			const minor = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "record",
					read_id: firstRead.read.readId,
					hydration_id: firstHydration.hydration.hydrationId,
					related_inquiry_ids: [DURABLE_INQUIRY],
					stance: "supports",
					movement: "repeated-support",
					rationale: "This only repeats existing support.",
					observer_hypothesis: null,
				},
				port,
			);
			assert.equal(minor.ok, true);
			assert.equal(port.notifications.length, 0);

			const second = controller.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: "tool-major",
						tool_name: "read",
					},
					text: "Major source result",
					capturedAt: "2026-08-01T10:02:00.000Z",
				},
				port,
			);
			if (!second.ok || !second.candidate)
				assert.fail("Expected second candidate");
			const secondRead = await controller.execute(
				externalSourceAction(second.candidate.candidateId),
				port,
			);
			if (!secondRead.ok || secondRead.action !== "source-read") {
				assert.fail("Expected second read");
			}
			const secondHydration = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hydrate",
					read_id: secondRead.read.readId,
					index_digest: secondRead.index.digest,
					inquiry_ids: [DURABLE_INQUIRY],
				},
				port,
			);
			if (!secondHydration.ok || secondHydration.action !== "hydrate") {
				assert.fail("Expected second hydration");
			}
			const majorAction = {
				observer_action: "observer-sidecar/v1",
				action: "record",
				read_id: secondRead.read.readId,
				hydration_id: secondHydration.hydration.hydrationId,
				related_inquiry_ids: [DURABLE_INQUIRY],
				stance: "challenges",
				movement: "core-counterexample",
				rationale: "This counterexample changes the central condition.",
				observer_hypothesis: null,
			};
			port.failNextObservationAppend = true;
			const failed = await controller.execute(majorAction, port);
			assert.equal(failed.ok, false);
			assert.equal(port.notifications.length, 0);
			port.dropNextObservationAppend = true;
			const unconfirmed = await controller.execute(majorAction, port);
			assert.equal(unconfirmed.ok, false);
			assert.equal(port.notifications.length, 0);
			const major = await controller.execute(majorAction, port);
			assert.equal(major.ok, true);
			assert.equal(port.notifications.length, 1);
			assert.equal(port.notifications[0]?.type, "warning");
			assert.match(port.notifications[0]?.message ?? "", /Observer 중요 변화/u);
		});
	});

	test("requests and hydrates Memo scope while OFF without notebook writes", async () => {
		await withSandbox(async ({ sandbox, controller, port }) => {
			const captured = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "재진입 비용은 기록 시점에 따라 달라진다.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate)
				assert.fail("Expected candidate");
			const registered = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "user-hypothesis",
					candidate_id: captured.candidate.candidateId,
					existing_inquiry_id: null,
					original: "재진입 비용은 기록 시점에 따라 달라진다.",
					context: "사용자가 명시적으로 추적을 요청했다.",
				},
				port,
			);
			assert.equal(registered.ok, true);
			port.entries.push({
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "activation-changed",
					enabled: false,
				},
			});
			const notebookPath = join(sandbox, "notebook", "records", "inquiry.md");
			const beforeNotebook = await readFile(notebookPath, "utf8");
			const beforeFailed = port.entries.length;
			port.failNextObservationAppend = true;
			const failed = controller.requestMemo(port);
			assert.equal(failed.ok, false);
			assert.equal(port.entries.length, beforeFailed);

			const requested = controller.requestMemo(port);
			if (!requested.ok || requested.status !== "requested") {
				assert.fail(requested.ok ? "Expected request" : requested.message);
			}
			const afterRequest = port.entries.length;
			const resumed = controller.requestMemo(port);
			assert.equal(resumed.ok, true);
			if (resumed.ok) assert.equal(resumed.status, "resumed");
			assert.equal(port.entries.length, afterRequest);

			const malformed = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "memo-scope",
					request_id: requested.request.requestId,
					extra: true,
				},
				port,
			);
			assert.equal(malformed.ok, false);
			assert.equal(port.entries.length, afterRequest);

			const unknown = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "memo-scope",
					request_id: "memo-request-00000000-0000-4000-8000-000000000999",
				},
				port,
			);
			assert.equal(unknown.ok, false);
			assert.equal(port.entries.length, afterRequest);

			const scoped = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "memo-scope",
					request_id: requested.request.requestId,
				},
				port,
			);
			if (!scoped.ok || scoped.action !== "memo-scope") {
				assert.fail(scoped.ok ? "Expected Memo scope" : scoped.message);
			}
			assert.deepEqual(
				scoped.context.observations.map((item) => item.observationId),
				[
					registered.ok && registered.action === "user-hypothesis"
						? registered.hypothesis.observationId
						: "missing",
				],
			);
			assert.equal(scoped.context.memoScope.relatedInquiryIds.length, 0);
			const payload = JSON.parse(observationToolText(scoped));
			assert.equal(payload.request_id, requested.request.requestId);
			assert.equal(payload.observations.length, 1);
			assert.equal(
				port.entries.some(
					(entry) =>
						entry.type === "custom" &&
						(entry.customType === "observer.prepared-memo" ||
							entry.customType === "observer.applied-memo"),
				),
				false,
			);
			assert.equal(await readFile(notebookPath, "utf8"), beforeNotebook);
		});
	});

	test("registers an explicit user hypothesis after append and ignores capture when off", async () => {
		await withSandbox(async ({ controller, port }) => {
			const captured = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "내 가설은 관찰 순서가 해석 편향을 바꾼다는 것이다.",
					capturedAt: "2026-08-01T10:03:00.000Z",
				},
				port,
			);
			if (!captured.ok || !captured.candidate)
				assert.fail("Expected user candidate");
			const result = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "user-hypothesis",
					candidate_id: captured.candidate.candidateId,
					existing_inquiry_id: null,
					original: "관찰 순서가 해석 편향을 바꾼다.",
					context: "사용자가 직접 추적을 요청했다.",
				},
				port,
			);
			assert.equal(result.ok, true);
			assert.equal(port.notifications.length, 1);
			const beforeDuplicate = port.entries.length;
			const duplicate = await controller.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "user-hypothesis",
					candidate_id: captured.candidate.candidateId,
					existing_inquiry_id: null,
					original: "관찰 순서가 해석 편향을 바꾼다.",
					context: "사용자가 직접 추적을 요청했다.",
				},
				port,
			);
			assert.equal(duplicate.ok, true);
			assert.equal(port.entries.length, beforeDuplicate);
			assert.equal(port.notifications.length, 1);
			const session = reconstructObservationSession(port.entries);
			assert.equal(session.pendingHypotheses[0]?.origin, "user");
			assert.equal(session.pendingHypotheses[0]?.sourceReadId, null);

			port.entries.push({
				type: "custom",
				customType: OBSERVER_LIFECYCLE_ENTRY,
				data: {
					protocol: OBSERVER_PROTOCOL,
					kind: "activation-changed",
					enabled: false,
				},
			});
			const before = port.entries.length;
			const ignored = controller.capture(
				{
					origin: { kind: "user-input", input_source: "interactive" },
					text: "off candidate",
					capturedAt: "2026-08-01T10:04:00.000Z",
				},
				port,
			);
			assert.equal(ignored.ok, true);
			if (ignored.ok) assert.equal(ignored.status, "ignored");
			assert.equal(port.entries.length, before);
		});
	});
});
