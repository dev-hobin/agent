import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { jsonValueFromUnknown } from "@hobin/judgment";

import {
	DEVELOPER_RECEIPT_KIND_LABELS,
	createDeveloperReceiptSurface,
	developerProgressMessage,
	developerProgressStatus,
	developerProgressWidgetLines,
	developerReceiptStatus,
	developerReceiptSummary,
	developerReceiptViewMessage,
	developerReceiptWidgetLines,
	readDeveloperReceiptView,
	showDeveloperReceiptTui,
	type DeveloperReceiptTuiRead,
} from "../extensions/developer-receipt-tui.ts";
import {
	beginProjectionRefresh,
	completeProjectionRefresh,
	initialProjectionCoordinatorState,
	type ProjectionCoordinatorState,
	type ProjectionPublication,
} from "../src/projection-coordinator.ts";
import {
	createReceiptProjection,
	type DeveloperReceipt,
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

const theme = {
	bold: (text: string) => text,
	italic: (text: string) => text,
	underline: (text: string) => text,
	strikethrough: (text: string) => text,
	fg: (...args: [string, string]) => args[1],
	bg: (...args: [string, string]) => args[1],
} as Theme;

interface EventWriter {
	readonly workScopeId: DeveloperId;
	nextSequence: number;
	previousSha256: ReturnType<typeof sha> | null;
}

interface CurrentHead {
	readonly state: ProjectionCoordinatorState;
	readonly publication: ProjectionPublication | null;
}

function writer(suffix: string): EventWriter {
	return {
		workScopeId: id(`scope:receipt-tui-${suffix}`),
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
		occurredAt: "2033-01-01T00:00:00.000Z",
		kind: id(input.kind),
		payload: jsonValueFromUnknown(input.payload),
	});
	input.state.nextSequence += 1;
	input.state.previousSha256 = envelope.eventSha256;
	return envelope;
}

function projection(input: {
	readonly suffix: string;
	readonly supportCount: number;
}) {
	const state = writer(input.suffix);
	const events: DeveloperEventEnvelope[] = [
		append({ state, kind: "work-scope-opened", payload: {} }),
	];
	for (let index = 0; index < input.supportCount; index += 1) {
		events.push(
			append({
				state,
				kind: "support-observed",
				payload: {
					support: {
						supportId: id(`support:receipt-tui-${input.suffix}-${index}`),
						sourceKind: "judgment-result",
						sourceId: id(`judgment:receipt-tui-${input.suffix}-${index}`),
						sourceRevisionSha256: sha("a"),
						supportSha256: canonicalValueSha256({
							suffix: input.suffix,
							index,
						}),
					},
				},
			}),
		);
	}
	const replay = replayDeveloperRuntime(JSON.parse(JSON.stringify(events)));
	assert.equal(replay.rejectedCount, 0);
	return createReceiptProjection(replay.acceptedEvents);
}

function publish(input: {
	readonly suffix: string;
	readonly projection: ReturnType<typeof createReceiptProjection>;
}): CurrentHead {
	const initial = initialProjectionCoordinatorState(
		id(`coordinator:receipt-tui-${input.suffix}`),
	);
	const started = beginProjectionRefresh({
		state: initial,
		requestedRevisionSha256: canonicalValueSha256({
			suffix: input.suffix,
			projectionSha256: input.projection.projectionSha256,
		}),
	});
	assert.equal(started.ok, true);
	if (!started.ok) assert.fail("receipt projection refresh did not start");
	const completed = completeProjectionRefresh({
		state: started.state,
		ticket: started.value,
		projection: input.projection,
	});
	assert.equal(completed.ok, true);
	if (!completed.ok) assert.fail("receipt projection refresh did not complete");
	assert.equal(completed.state.availability.kind, "current");
	if (completed.state.availability.kind !== "current") {
		assert.fail("receipt projection is not current");
	}
	return {
		state: completed.state,
		publication: completed.state.availability.publication,
	};
}

function read(head: CurrentHead): DeveloperReceiptTuiRead {
	return () => head;
}

test("receipt view exposes only an exact current bounded page", () => {
	const head = publish({
		suffix: "current",
		projection: projection({ suffix: "current", supportCount: 24 }),
	});
	const first = readDeveloperReceiptView({
		readCurrent: read(head),
		cursor: null,
		pageSize: 10,
	});
	assert.equal(first.kind, "current");
	if (first.kind !== "current") assert.fail("current receipt page is missing");
	assert.equal(first.receiptCount, 25);
	assert.equal(first.page.entries.length, 10);
	assert.ok(first.page.nextCursor);
	assert.equal(developerReceiptStatus(first), "developer v8 · receipts 25");
	assert.match(developerReceiptViewMessage(first), /receipts 1-10 of 25/u);
	assert.deepEqual(
		developerReceiptWidgetLines({ view: first, maxLines: 3 }).length,
		3,
	);
	assert.match(
		developerReceiptWidgetLines({ view: first, maxLines: 3 }).at(-1) ?? "",
		/more on this page/u,
	);
});

test("progress is the compact bilingual default while audit receipts stay opt-in", () => {
	const head = publish({
		suffix: "progress",
		projection: projection({ suffix: "progress", supportCount: 2 }),
	});
	const progress = {
		phase: "verifying" as const,
		language: "en" as const,
		completed: ["Decision concluded", "Change recorded"],
		next: "Run repository checks",
	};
	assert.equal(developerProgressStatus(progress), "Developer · Verifying");
	assert.match(
		developerProgressMessage(progress),
		/Next: Run repository checks/u,
	);
	assert.deepEqual(developerProgressWidgetLines({ progress, maxLines: 3 }), [
		"Developer · Verifying",
		"✓ Change recorded",
		"→ Run repository checks",
	]);
	const korean = {
		...progress,
		language: "ko" as const,
		next: "저장소 검사를 실행하세요",
	};
	assert.equal(developerProgressStatus(korean), "Developer · 검증 중");
	assert.match(
		developerProgressMessage(korean),
		/다음: 저장소 검사를 실행하세요/u,
	);

	const copies: string[] = [];
	const surface = createDeveloperReceiptSurface({
		readCurrent: read(head),
		readProgress: () => progress,
		theme,
		done() {},
		requestRender() {},
		copy: (text) => copies.push(text),
	});
	const defaultView = surface
		.render({ width: 80, maximumHeight: 12 })
		.join("\n");
	assert.match(defaultView, /Verifying/u);
	assert.match(defaultView, /Run repository checks/u);
	assert.doesNotMatch(defaultView, /projection|[a-f0-9]{64}/u);
	surface.handleInput("y");
	assert.match(copies.at(-1) ?? "", /Developer · Verifying/u);
	surface.handleInput("d");
	assert.match(
		surface.render({ width: 80, maximumHeight: 12 }).join("\n"),
		/receipts 1-3 of 3/u,
	);
});

test("an exact current empty projection remains current without inventing status", () => {
	const head = publish({
		suffix: "empty",
		projection: createReceiptProjection([]),
	});
	const view = readDeveloperReceiptView({
		readCurrent: read(head),
		cursor: null,
	});
	assert.equal(view.kind, "current");
	if (view.kind !== "current") assert.fail("empty projection is not current");
	assert.equal(view.receiptCount, 0);
	assert.equal(view.page.entries.length, 0);
	assert.equal(developerReceiptStatus(view), undefined);
	assert.deepEqual(developerReceiptWidgetLines({ view, maxLines: 4 }), []);
	assert.match(developerReceiptViewMessage(view), /0 receipts/u);
});

test("unavailable, refreshing, stale, and cloned values never expose prior receipts", () => {
	const unavailableState = initialProjectionCoordinatorState(
		id("coordinator:receipt-tui-unavailable"),
	);
	const unavailable = readDeveloperReceiptView({
		readCurrent: read({ state: unavailableState, publication: null }),
		cursor: null,
	});
	assert.equal(unavailable.kind, "unavailable");

	const refreshInitial = initialProjectionCoordinatorState(
		id("coordinator:receipt-tui-refreshing"),
	);
	const started = beginProjectionRefresh({
		state: refreshInitial,
		requestedRevisionSha256: sha("b"),
	});
	assert.equal(started.ok, true);
	if (!started.ok) assert.fail("refreshing state is missing");
	const refreshing = readDeveloperReceiptView({
		readCurrent: read({ state: started.state, publication: null }),
		cursor: null,
	});
	assert.equal(refreshing.kind, "refreshing");
	assert.equal(
		developerReceiptStatus(refreshing),
		"developer v8 · receipts refreshing",
	);

	const current = publish({
		suffix: "stale-current",
		projection: projection({ suffix: "stale-current", supportCount: 2 }),
	});
	const foreign = publish({
		suffix: "stale-foreign",
		projection: projection({ suffix: "stale-foreign", supportCount: 1 }),
	});
	const stale = readDeveloperReceiptView({
		readCurrent: read({
			state: current.state,
			publication: foreign.publication,
		}),
		cursor: null,
	});
	assert.equal(stale.kind, "unavailable");
	if (stale.kind === "unavailable")
		assert.equal(stale.reason, "stale-publication");

	const clonedState = JSON.parse(JSON.stringify(current.state));
	const cloned = readDeveloperReceiptView({
		readCurrent: read({
			state: clonedState as ProjectionCoordinatorState,
			publication: current.publication,
		}),
		cursor: null,
	});
	assert.equal(cloned.kind, "unavailable");
	if (cloned.kind === "unavailable")
		assert.equal(cloned.reason, "invalid-state");

	const first = readDeveloperReceiptView({
		readCurrent: read(current),
		cursor: null,
		pageSize: 2,
	});
	assert.equal(first.kind, "current");
	if (first.kind !== "current" || first.page.nextCursor === null) {
		assert.fail("current cursor is missing");
	}
	const clonedCursor = JSON.parse(JSON.stringify(first.page.nextCursor));
	const cursorRejected = readDeveloperReceiptView({
		readCurrent: read(current),
		cursor: clonedCursor,
		pageSize: 2,
	});
	assert.equal(cursorRejected.kind, "unavailable");
	if (cursorRejected.kind === "unavailable") {
		assert.equal(cursorRejected.reason, "invalid-cursor");
	}
});

test("surface pages forward and backward with opaque cursors and binds one publication", () => {
	let head = publish({
		suffix: "surface-first",
		projection: projection({ suffix: "surface-first", supportCount: 45 }),
	});
	let renders = 0;
	let closed = false;
	const copies: string[] = [];
	const surface = createDeveloperReceiptSurface({
		readCurrent: () => head,
		theme,
		done: () => {
			closed = true;
		},
		requestRender: () => {
			renders += 1;
		},
		copy: (text) => copies.push(text),
		pageSize: 20,
	});
	assert.match(
		surface.render({ width: 80, maximumHeight: 26 }).join("\n"),
		/receipts 1-20 of 46/u,
	);
	const compact = surface.render({ width: 48, maximumHeight: 8 });
	assert.equal(compact.length, 8);
	assert.match(compact.join("\n"), /more receipts on this page/u);
	surface.handleInput("\u001b[6~");
	assert.match(
		surface.render({ width: 80, maximumHeight: 26 }).join("\n"),
		/receipts 21-40 of 46/u,
	);
	surface.handleInput("\u001b[6~");
	assert.match(
		surface.render({ width: 80, maximumHeight: 12 }).join("\n"),
		/receipts 41-46 of 46/u,
	);
	surface.handleInput("\u001b[6~");
	assert.match(
		surface.render({ width: 80, maximumHeight: 12 }).join("\n"),
		/receipts 41-46 of 46/u,
	);
	surface.handleInput("\u001b[5~");
	assert.match(
		surface.render({ width: 80, maximumHeight: 26 }).join("\n"),
		/receipts 21-40 of 46/u,
	);
	surface.handleInput("g");
	assert.match(
		surface.render({ width: 80, maximumHeight: 26 }).join("\n"),
		/receipts 1-20 of 46/u,
	);
	surface.handleInput("y");
	assert.match(copies[0] ?? "", /projection/u);
	assert.match(copies[0] ?? "", /#1 scope opened/u);
	assert.equal(renders, 4);

	head = publish({
		suffix: "surface-second",
		projection: projection({ suffix: "surface-second", supportCount: 1 }),
	});
	surface.handleInput("r");
	assert.match(
		surface.render({ width: 80, maximumHeight: 10 }).join("\n"),
		/projection-changed-reopen/u,
	);
	surface.handleInput("\u001b");
	assert.equal(closed, true);
	assert.ok(
		surface
			.render({ width: 42, maximumHeight: 10 })
			.every((line) => visibleWidth(line) <= 42),
	);
});

test("the Pi overlay adapter renders the exact current receipt page without effects", async () => {
	const head = publish({
		suffix: "overlay",
		projection: projection({ suffix: "overlay", supportCount: 2 }),
	});
	type OverlayComponent = {
		render(width: number): string[];
		handleInput(data: string): void;
		invalidate(): void;
	};
	let renderedLines: string[] = [];
	let overlayOptions: unknown;
	const ctx = {
		ui: {
			notify() {},
			async custom(...args: unknown[]) {
				const [factory, options] = args as [
					(...factoryArgs: unknown[]) => OverlayComponent,
					unknown,
				];
				overlayOptions = options;
				const component = factory(
					{
						terminal: { rows: 12 },
						requestRender() {},
					},
					theme,
					undefined,
					() => {},
				);
				renderedLines = component.render(80);
				return null;
			},
		},
	} as unknown as ExtensionContext;
	await showDeveloperReceiptTui({ ctx, readCurrent: read(head) });
	assert.match(renderedLines.join("\n"), /receipts 1-3 of 3/u);
	assert.deepEqual(overlayOptions, {
		overlay: true,
		overlayOptions: {
			anchor: "top-center",
			width: "100%",
			maxHeight: "100%",
		},
	});
});

test("all 18 receipt kinds have closed labels and the observer imports no authority effects", async () => {
	assert.deepEqual(Object.keys(DEVELOPER_RECEIPT_KIND_LABELS).sort(), [
		"can-serve-basis-created",
		"change-authorized",
		"frame-blocker-resolved",
		"frame-contribution-admitted",
		"implementation-landing-recorded",
		"invocation-settled",
		"obligation-discharged",
		"ready-assignment-recorded",
		"route-frame-concluded",
		"route-frame-opened",
		"route-frame-replaced",
		"routing-coverage-completed",
		"routing-page-accounted",
		"routing-snapshot-opened",
		"skill-invocation-started",
		"support-observed",
		"work-scope-closed",
		"work-scope-opened",
	]);
	const frameFields = {
		frameId: id("frame:receipt-tui-summary"),
		frameRevision: 1,
	};
	const summaryCases: Array<{
		readonly receipt: Record<string, unknown>;
		readonly label: string;
	}> = [
		{
			receipt: {
				kind: "work-scope-opened",
				workScopeId: id("scope:receipt-tui-summary"),
			},
			label: "scope opened",
		},
		{
			receipt: {
				kind: "work-scope-closed",
				workScopeId: id("scope:receipt-tui-summary"),
				reasonSha256: sha("1"),
			},
			label: "scope closed",
		},
		{
			receipt: {
				kind: "route-frame-opened",
				...frameFields,
				routeDefinitionId: id("route:receipt-tui-summary"),
				obligationCount: 1,
			},
			label: "frame opened",
		},
		{
			receipt: {
				kind: "route-frame-replaced",
				...frameFields,
				routeDefinitionId: id("route:receipt-tui-summary"),
				obligationCount: 2,
			},
			label: "frame replaced",
		},
		{
			receipt: {
				kind: "routing-snapshot-opened",
				snapshotId: id("snapshot:receipt-tui-summary"),
				candidateCount: 2,
				pageCount: 1,
			},
			label: "routing snapshot",
		},
		{
			receipt: {
				kind: "routing-page-accounted",
				pageIndex: 0,
				snapshotId: id("snapshot:receipt-tui-summary"),
				candidateCount: 2,
				dispositionCount: 2,
			},
			label: "routing page",
		},
		{
			receipt: {
				kind: "routing-coverage-completed",
				snapshotId: id("snapshot:receipt-tui-summary"),
				coverageSha256: sha("2"),
			},
			label: "routing complete",
		},
		{
			receipt: {
				kind: "can-serve-basis-created",
				basisId: id("basis:receipt-tui-summary"),
				candidateId: id("candidate:receipt-tui-summary"),
				targetCount: 1,
			},
			label: "can-serve basis",
		},
		{
			receipt: {
				kind: "ready-assignment-recorded",
				assignmentId: id("assignment:receipt-tui-summary"),
				skillCapabilityId: id("capability:receipt-tui-summary"),
				targetCount: 1,
			},
			label: "assignment ready",
		},
		{
			receipt: {
				kind: "skill-invocation-started",
				invocationId: id("invocation:receipt-tui-summary"),
				assignmentId: id("assignment:receipt-tui-summary"),
			},
			label: "invocation started",
		},
		{
			receipt: {
				kind: "invocation-settled",
				invocationId: id("invocation:receipt-tui-summary"),
				outcome: "returned-contribution",
			},
			label: "invocation settled",
		},
		{
			receipt: {
				kind: "support-observed",
				supportId: id("support:receipt-tui-summary"),
				sourceKind: "judgment-result",
				sourceId: id("judgment:receipt-tui-summary"),
			},
			label: "support observed",
		},
		{
			receipt: {
				kind: "frame-contribution-admitted",
				contributionId: id("contribution:receipt-tui-summary"),
				...frameFields,
				targetCount: 1,
			},
			label: "contribution admitted",
		},
		{
			receipt: {
				kind: "frame-blocker-resolved",
				blockerId: id("blocker:receipt-tui-summary"),
				frameId: frameFields.frameId,
			},
			label: "blocker resolved",
		},
		{
			receipt: {
				kind: "obligation-discharged",
				obligationId: id("obligation:receipt-tui-summary"),
				contributionCount: 1,
			},
			label: "obligation discharged",
		},
		{
			receipt: {
				kind: "route-frame-concluded",
				...frameFields,
				dischargeCount: 1,
			},
			label: "frame concluded",
		},
		{
			receipt: {
				kind: "change-authorized",
				authorizationId: id("authorization:receipt-tui-summary"),
				...frameFields,
			},
			label: "change authorized",
		},
		{
			receipt: {
				kind: "implementation-landing-recorded",
				landingId: id("landing:receipt-tui-summary"),
				changedPathCount: 2,
				verificationCount: 1,
			},
			label: "landing recorded",
		},
	];
	for (const summaryCase of summaryCases) {
		assert.match(
			developerReceiptSummary(summaryCase.receipt as DeveloperReceipt),
			new RegExp(summaryCase.label, "u"),
		);
	}

	const head = publish({
		suffix: "summary",
		projection: projection({ suffix: "summary", supportCount: 0 }),
	});
	const view = readDeveloperReceiptView({
		readCurrent: read(head),
		cursor: null,
	});
	assert.equal(view.kind, "current");
	if (view.kind !== "current") assert.fail("summary receipt is missing");
	assert.match(
		developerReceiptSummary(view.page.entries[0]?.receipt as never),
		/scope opened/u,
	);

	const source = await readFile(
		new URL("../extensions/developer-receipt-tui.ts", import.meta.url),
		"utf8",
	);
	assert.doesNotMatch(
		source,
		/appendEntry|prepareDeveloperRuntimeBatch|runtime-transition|startSkillInvocation|settleSkillInvocation|admitFrameContribution|dischargeObligation|concludeRouteFrame|createRuntimeChangeAuthorization/u,
	);
});
