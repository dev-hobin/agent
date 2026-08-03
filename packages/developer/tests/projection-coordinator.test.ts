import assert from "node:assert/strict";
import test from "node:test";

import { jsonValueFromUnknown } from "@hobin/judgment";

import {
	beginProjectionRefresh,
	completeProjectionRefresh,
	failProjectionRefresh,
	initialProjectionCoordinatorState,
	isProjectionCoordinatorFault,
	projectionReadTarget,
	verifyProjectionCoordinatorState,
	verifyProjectionPublication,
	verifyProjectionRefreshTicket,
	type ProjectionCoordinatorErrorCode,
} from "../src/projection-coordinator.ts";
import {
	createReceiptProjection,
	isReceiptProjectionError,
	readCurrentReceiptPage,
} from "../src/receipt-projection.ts";
import { replayDeveloperRuntime } from "../src/runtime-replay.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	canonicalValueSha256,
	createDeveloperEventEnvelope,
	parseDeveloperId,
	parseSha256Digest,
	type DeveloperEventEnvelope,
	type DeveloperId,
} from "../src/runtime-protocol.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

interface EventWriter {
	readonly workScopeId: DeveloperId;
	nextSequence: number;
	previousSha256: ReturnType<typeof sha> | null;
}

function writer(suffix: string): EventWriter {
	return {
		workScopeId: id(`scope:coordinator-${suffix}`),
		nextSequence: 0,
		previousSha256: null,
	};
}

function append(input: {
	readonly state: EventWriter;
	readonly kind: string;
	readonly payload: unknown;
}): DeveloperEventEnvelope {
	const envelope = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id(`event:${input.state.workScopeId}:${input.state.nextSequence}`),
		workScopeId: input.state.workScopeId,
		scopeSequence: input.state.nextSequence,
		previousScopeEventSha256: input.state.previousSha256,
		causalRefs: [],
		occurredAt: "2032-01-01T00:00:00.000Z",
		kind: id(input.kind),
		payload: jsonValueFromUnknown(input.payload),
	});
	input.state.nextSequence += 1;
	input.state.previousSha256 = envelope.eventSha256;
	return envelope;
}

function projection(input: {
	readonly suffix: string;
	readonly supportCount?: number;
}) {
	const { suffix, supportCount = 1 } = input;
	const state = writer(suffix);
	const events: DeveloperEventEnvelope[] = [
		append({ state, kind: "work-scope-opened", payload: {} }),
	];
	for (let index = 0; index < supportCount; index += 1) {
		events.push(
			append({
				state,
				kind: "support-observed",
				payload: {
					support: {
						supportId: id(`support:coordinator-${suffix}-${index}`),
						sourceKind: "judgment-result",
						sourceId: id(`judgment:coordinator-${suffix}-${index}`),
						sourceRevisionSha256: sha("a"),
						supportSha256: canonicalValueSha256({ suffix, index }),
					},
				},
			}),
		);
	}
	const replay = replayDeveloperRuntime(JSON.parse(JSON.stringify(events)));
	assert.equal(replay.rejectedCount, 0);
	return createReceiptProjection(replay.acceptedEvents);
}

function hasCoordinatorFault(code: ProjectionCoordinatorErrorCode) {
	return (error: unknown) =>
		isProjectionCoordinatorFault(error) && error.code === code;
}

test("initial and Refreshing states never expose a Current target", () => {
	const initial = initialProjectionCoordinatorState(id("coordinator:initial"));
	assert.equal(initial.availability.kind, "unavailable");
	assert.equal(initial.transitionSequence, 0);
	assert.equal(initial.lastRequestSequence, 0);
	assert.equal(verifyProjectionCoordinatorState(initial), initial);
	assert.throws(
		() => initialProjectionCoordinatorState(id("coordinator:initial")),
		hasCoordinatorFault("coordinator-already-initialized"),
	);
	const unavailable = projectionReadTarget({
		state: initial,
		publication: null,
	});
	assert.equal(unavailable.ok, false);
	if (unavailable.ok) assert.fail("initial coordinator must be unavailable");
	assert.equal(unavailable.error.code, "projection-unavailable");

	const started = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("1"),
	});
	assert.equal(started.ok, true);
	if (!started.ok) assert.fail("refresh should begin");
	assert.equal(started.state.availability.kind, "refreshing");
	assert.equal(started.state.transitionSequence, 1);
	assert.equal(started.state.lastRequestSequence, 1);
	assert.equal(verifyProjectionRefreshTicket(started.value), started.value);
	const refreshing = projectionReadTarget({
		state: started.state,
		publication: null,
	});
	assert.equal(refreshing.ok, true);
	if (!refreshing.ok) assert.fail("refreshing target should be observable");
	assert.equal(refreshing.target.kind, "refreshing");
	assert.throws(
		() =>
			readCurrentReceiptPage(refreshing.target, {
				cursor: null,
				pageSize: 1,
			}),
		(error: unknown) =>
			isReceiptProjectionError(error) && error.code === "projection-refreshing",
	);
});

test("latest completion creates the only current publication and readable target", () => {
	const initial = initialProjectionCoordinatorState(id("coordinator:complete"));
	const started = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("2"),
	});
	if (!started.ok) assert.fail("refresh should begin");
	const receiptProjection = projection({ suffix: "complete", supportCount: 3 });
	const completed = completeProjectionRefresh({
		state: started.state,
		ticket: started.value,
		projection: receiptProjection,
	});
	assert.equal(completed.ok, true);
	if (!completed.ok) assert.fail("latest completion should publish");
	assert.equal(completed.state.availability.kind, "current");
	assert.equal(completed.state.transitionSequence, 2);
	assert.equal(verifyProjectionPublication(completed.value), completed.value);
	const missingPublication = projectionReadTarget({
		state: completed.state,
		publication: null,
	});
	assert.equal(missingPublication.ok, false);
	if (missingPublication.ok) assert.fail("publication must be exact");
	assert.equal(missingPublication.error.code, "stale-publication");
	const target = projectionReadTarget({
		state: completed.state,
		publication: completed.value,
	});
	assert.equal(target.ok, true);
	if (!target.ok) assert.fail("current target should be available");
	assert.equal(target.target.kind, "current");
	const page = readCurrentReceiptPage(target.target, {
		cursor: null,
		pageSize: 100,
	});
	assert.equal(page.entries.length, 4);
});

test("nested refreshes publish only the latest ticket and stale observations do not advance state", () => {
	const initial = initialProjectionCoordinatorState(id("coordinator:nested"));
	const first = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("3"),
	});
	if (!first.ok) assert.fail("first refresh should begin");
	const second = beginProjectionRefresh({
		state: first.state,
		requestedRevisionSha256: sha("4"),
	});
	if (!second.ok) assert.fail("second refresh should begin");
	const third = beginProjectionRefresh({
		state: second.state,
		requestedRevisionSha256: sha("5"),
	});
	if (!third.ok) assert.fail("third refresh should begin");
	assert.deepEqual(
		[
			first.value.requestSequence,
			second.value.requestSequence,
			third.value.requestSequence,
		],
		[1, 2, 3],
	);
	const receiptProjection = projection({ suffix: "nested" });
	const staleStateComplete = completeProjectionRefresh({
		state: first.state,
		ticket: first.value,
		projection: receiptProjection,
	});
	assert.equal(staleStateComplete.ok, false);
	if (staleStateComplete.ok) assert.fail("old state must not complete");
	assert.equal(staleStateComplete.error.code, "stale-state");
	assert.equal(staleStateComplete.state, third.state);
	const staleBegin = beginProjectionRefresh({
		state: second.state,
		requestedRevisionSha256: sha("e"),
	});
	assert.equal(staleBegin.ok, false);
	if (staleBegin.ok) assert.fail("old state must not begin another refresh");
	assert.equal(staleBegin.error.code, "stale-state");
	assert.equal(staleBegin.state, third.state);
	const staleComplete = completeProjectionRefresh({
		state: third.state,
		ticket: first.value,
		projection: receiptProjection,
	});
	assert.equal(staleComplete.ok, false);
	if (staleComplete.ok) assert.fail("old completion must be stale");
	assert.equal(staleComplete.error.code, "stale-ticket");
	assert.equal(staleComplete.state, third.state);
	const staleFail = failProjectionRefresh({
		state: third.state,
		ticket: second.value,
	});
	assert.equal(staleFail.ok, false);
	if (staleFail.ok) assert.fail("old failure must be stale");
	assert.equal(staleFail.error.code, "stale-ticket");
	assert.equal(staleFail.state, third.state);
	const latest = completeProjectionRefresh({
		state: third.state,
		ticket: third.value,
		projection: receiptProjection,
	});
	assert.equal(latest.ok, true);
	if (!latest.ok) assert.fail("latest completion should publish");
	assert.equal(latest.state.transitionSequence, 4);
	const duplicateComplete = completeProjectionRefresh({
		state: latest.state,
		ticket: third.value,
		projection: receiptProjection,
	});
	assert.equal(duplicateComplete.ok, false);
	if (duplicateComplete.ok) assert.fail("duplicate completion must be stale");
	assert.equal(duplicateComplete.state, latest.state);
	const duplicateFail = failProjectionRefresh({
		state: latest.state,
		ticket: third.value,
	});
	assert.equal(duplicateFail.ok, false);
	if (duplicateFail.ok) assert.fail("consumed ticket must be stale");
	assert.equal(duplicateFail.state, latest.state);
});

test("latest failure is fail-closed and never restores the prior publication", () => {
	const initial = initialProjectionCoordinatorState(id("coordinator:failure"));
	const first = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("6"),
	});
	if (!first.ok) assert.fail("first refresh should begin");
	const receiptProjection = projection({ suffix: "failure" });
	const published = completeProjectionRefresh({
		state: first.state,
		ticket: first.value,
		projection: receiptProjection,
	});
	if (!published.ok) assert.fail("first projection should publish");
	const second = beginProjectionRefresh({
		state: published.state,
		requestedRevisionSha256: sha("7"),
	});
	if (!second.ok) assert.fail("second refresh should begin");
	assert.equal(second.state.availability.kind, "refreshing");
	if (second.state.availability.kind !== "refreshing") {
		assert.fail("state should be refreshing");
	}
	assert.equal(
		second.state.availability.priorProjectionSha256,
		receiptProjection.projectionSha256,
	);
	const duringRefresh = projectionReadTarget({
		state: second.state,
		publication: published.value,
	});
	assert.equal(duringRefresh.ok, true);
	if (!duringRefresh.ok) assert.fail("refresh state should be observable");
	assert.equal(duringRefresh.target.kind, "refreshing");
	const failed = failProjectionRefresh({
		state: second.state,
		ticket: second.value,
	});
	assert.equal(failed.ok, true);
	if (!failed.ok) assert.fail("latest failure should settle");
	assert.equal(failed.state.availability.kind, "unavailable");
	if (failed.state.availability.kind !== "unavailable") {
		assert.fail("failed state should be unavailable");
	}
	assert.equal(failed.state.availability.reason, "refresh-failed");
	assert.equal(failed.state.availability.lastRequestedRevisionSha256, sha("7"));
	const afterFailure = projectionReadTarget({
		state: failed.state,
		publication: published.value,
	});
	assert.equal(afterFailure.ok, false);
	if (afterFailure.ok) assert.fail("prior publication must not return");
	assert.equal(afterFailure.error.code, "projection-unavailable");
});

test("foreign tickets are rejected with the exact unchanged state", () => {
	const left = beginProjectionRefresh({
		state: initialProjectionCoordinatorState(id("coordinator:left")),
		requestedRevisionSha256: sha("8"),
	});
	const right = beginProjectionRefresh({
		state: initialProjectionCoordinatorState(id("coordinator:right")),
		requestedRevisionSha256: sha("9"),
	});
	if (!left.ok || !right.ok) assert.fail("both refreshes should begin");
	const receiptProjection = projection({ suffix: "foreign" });
	const complete = completeProjectionRefresh({
		state: left.state,
		ticket: right.value,
		projection: receiptProjection,
	});
	assert.equal(complete.ok, false);
	if (complete.ok) assert.fail("foreign completion must fail");
	assert.equal(complete.error.code, "foreign-ticket");
	assert.equal(complete.state, left.state);
	const fail = failProjectionRefresh({
		state: left.state,
		ticket: right.value,
	});
	assert.equal(fail.ok, false);
	if (fail.ok) assert.fail("foreign failure must fail");
	assert.equal(fail.error.code, "foreign-ticket");
	assert.equal(fail.state, left.state);
});

test("state, ticket, projection, and publication clones cannot carry coordinator authority", () => {
	const initial = initialProjectionCoordinatorState(id("coordinator:clones"));
	assert.throws(
		() =>
			beginProjectionRefresh({
				state: structuredClone(initial),
				requestedRevisionSha256: sha("b"),
			}),
		hasCoordinatorFault("invalid-state"),
	);
	const started = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("b"),
	});
	if (!started.ok) assert.fail("refresh should begin");
	const receiptProjection = projection({ suffix: "clones" });
	assert.throws(
		() =>
			completeProjectionRefresh({
				state: started.state,
				ticket: structuredClone(started.value),
				projection: receiptProjection,
			}),
		hasCoordinatorFault("invalid-ticket"),
	);
	assert.throws(
		() =>
			completeProjectionRefresh({
				state: started.state,
				ticket: started.value,
				projection: structuredClone(receiptProjection),
			}),
		hasCoordinatorFault("invalid-projection"),
	);
	const completed = completeProjectionRefresh({
		state: started.state,
		ticket: started.value,
		projection: receiptProjection,
	});
	if (!completed.ok) assert.fail("projection should publish");
	assert.throws(
		() => verifyProjectionPublication(structuredClone(completed.value)),
		hasCoordinatorFault("invalid-publication"),
	);
	assert.throws(
		() =>
			projectionReadTarget({
				state: completed.state,
				publication: structuredClone(completed.value),
			}),
		hasCoordinatorFault("invalid-publication"),
	);
});

test("equal projection content under different requested revisions creates distinct publications", () => {
	const initial = initialProjectionCoordinatorState(
		id("coordinator:revisions"),
	);
	const receiptProjection = projection({ suffix: "revisions" });
	const first = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: sha("c"),
	});
	if (!first.ok) assert.fail("first refresh should begin");
	const firstPublished = completeProjectionRefresh({
		state: first.state,
		ticket: first.value,
		projection: receiptProjection,
	});
	if (!firstPublished.ok) assert.fail("first projection should publish");
	const second = beginProjectionRefresh({
		state: firstPublished.state,
		requestedRevisionSha256: sha("d"),
	});
	if (!second.ok) assert.fail("second refresh should begin");
	const secondPublished = completeProjectionRefresh({
		state: second.state,
		ticket: second.value,
		projection: receiptProjection,
	});
	if (!secondPublished.ok) assert.fail("second projection should publish");
	assert.equal(
		firstPublished.value.projectionSha256,
		secondPublished.value.projectionSha256,
	);
	assert.notEqual(
		firstPublished.value.publicationSha256,
		secondPublished.value.publicationSha256,
	);
	const stale = projectionReadTarget({
		state: secondPublished.state,
		publication: firstPublished.value,
	});
	assert.equal(stale.ok, false);
	if (stale.ok) assert.fail("old publication must be stale");
	assert.equal(stale.error.code, "stale-publication");
	const current = projectionReadTarget({
		state: secondPublished.state,
		publication: secondPublished.value,
	});
	assert.equal(current.ok, true);
});
