import assert from "node:assert/strict";
import test from "node:test";

import { createProposedFrameContribution } from "../src/routing-context.ts";
import {
	authorizeRuntimeChange,
	closeRuntimeScope,
	createRuntimeChangeAuthorization,
	createRuntimeImplementationLanding,
	createRuntimeScopeClosure,
	initialRuntimeRootState,
	observeRuntimeFrameConcluded,
	observeRuntimeFrameOpened,
	recordRuntimeLanding,
	verifyRuntimeChangeAuthorization,
	verifyRuntimeImplementationLanding,
	verifyRuntimeRootState,
} from "../src/runtime-root.ts";
import {
	canonicalValueSha256,
	createRouteDefinition,
	obligationSetSha256,
	parseDeveloperEventRef,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseObligation,
	parseRouteFrame,
	parseSha256Digest,
	type DeveloperEventRef,
	type DeveloperId,
	type RouteFrame,
} from "../src/runtime-protocol.ts";
import {
	admitFrameContribution,
	concludeRouteFrame,
	dischargeObligation,
	initialDeveloperWorkScopeState,
	openRouteFrame,
	runtimeBlockerSetSha256,
	runtimeFrameState,
	type DeveloperWorkScopeState,
	type RuntimeTransitionResult,
} from "../src/runtime-transition.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

function accept(result: RuntimeTransitionResult): DeveloperWorkScopeState {
	if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
	return result.state;
}

function rootAccept(result: ReturnType<typeof authorizeRuntimeChange>) {
	if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
	return result.state;
}

function eventRef(input: {
	readonly suffix: string;
	readonly character: string;
}): DeveloperEventRef {
	return parseDeveloperEventRef({
		workScopeId: "scope:root",
		eventId: id(`event:${input.suffix}`),
		eventSha256: sha(input.character),
	});
}

function addSettledFrame(input: {
	readonly state: DeveloperWorkScopeState;
	readonly suffix: string;
	readonly frameId?: DeveloperId;
	readonly routeDefinitionId?: DeveloperId;
}): Readonly<{ state: DeveloperWorkScopeState; frame: RouteFrame }> {
	const route = createRouteDefinition({
		routeDefinitionId:
			input.routeDefinitionId ?? id(`route:root-${input.suffix}`),
		sign: `${input.suffix} settlement`,
		sense: `Settle ${input.suffix} with explicit current support.`,
	});
	const frameId = input.frameId ?? id(`frame:root-${input.suffix}`);
	const obligation = parseObligation({
		obligationId: id(`obligation:root-${input.suffix}`),
		frameId,
		statement: `The ${input.suffix} obligation has current support.`,
	});
	const frame = parseRouteFrame({
		frameId,
		frameRevision: 0,
		workScopeId: input.state.workScopeId,
		parentFrameId: null,
		routeDefinitionId: route.routeDefinitionId,
		routeDefinitionRevisionSha256: route.revisionSha256,
		exactQuestion: `What resolves ${input.suffix}?`,
		obligationIds: [obligation.obligationId],
		obligationSetSha256: obligationSetSha256([obligation]),
	});
	let state = accept(openRouteFrame(input.state, frame, [obligation]));
	const contributionId = id(`contribution:root-${input.suffix}`);
	const proposal = createProposedFrameContribution({
		proposalId: id(`proposal:root-${input.suffix}`),
		frameId,
		frameRevision: 0,
		source: {
			kind: "judgment-result",
			sourceId: id(`judgment:root-${input.suffix}`),
			sourceRevisionSha256: sha("a"),
		},
		claim: `The ${input.suffix} claim is supported.`,
		applicability: `Current for ${frameId}.`,
		targetUses: [{ obligationId: obligation.obligationId, useAs: "evidence" }],
		limitations: [],
		supportSha256: canonicalValueSha256({ suffix: input.suffix }),
	});
	state = accept(
		admitFrameContribution(state, proposal, contributionId, sha("b")),
	);
	const dischargeId = id(`discharge:root-${input.suffix}`);
	state = accept(
		dischargeObligation(state, {
			dischargeId,
			frameId,
			expectedFrameRevision: 0,
			obligationId: obligation.obligationId,
			contributionIds: [contributionId],
			stopEvidence: [`The ${input.suffix} evidence is current.`],
			conclusion: `Resolved ${input.suffix}.`,
		}),
	);
	const current = runtimeFrameState(state, frameId);
	assert.ok(current);
	state = accept(
		concludeRouteFrame(
			state,
			parseFrameConclusionProposal({
				frameId,
				expectedFrameRevision: 0,
				dischargeIds: [dischargeId],
				stopEvidence: [`All ${input.suffix} obligations are discharged.`],
				expectedBlockerSetSha256: runtimeBlockerSetSha256(current.blockers),
				conclusion: `The ${input.suffix} frame is resolved.`,
			}),
		),
	);
	return Object.freeze({ state, frame });
}

function authorization(input: {
	readonly frame: RouteFrame;
	readonly state: DeveloperWorkScopeState;
}) {
	const concluded = runtimeFrameState(input.state, input.frame.frameId);
	assert.ok(concluded?.conclusion);
	return createRuntimeChangeAuthorization({
		authorizationId: "change:root",
		frameId: input.frame.frameId,
		frameRevision: input.frame.frameRevision,
		conclusionSha256: concluded.conclusion.conclusionSha256,
		movement: "Implement the bounded root change.",
		stableLanding: "The bounded files form a stable landing.",
		verificationTarget: "Focused and regression checks pass.",
		boundary: null,
	});
}

test("authorization and landing are refined process-local root authority", () => {
	const settled = addSettledFrame({
		state: initialDeveloperWorkScopeState(id("scope:root")),
		suffix: "authorization",
	});
	const change = authorization({ frame: settled.frame, state: settled.state });
	assert.equal(verifyRuntimeChangeAuthorization(change), change);
	let root = rootAccept(
		authorizeRuntimeChange({
			root: initialRuntimeRootState(),
			scope: settled.state,
			authorization: change,
		}),
	);
	assert.equal(root.activeAuthorization, change);
	const landing = createRuntimeImplementationLanding({
		landingId: "landing:root",
		authorizationId: change.authorizationId,
		changedPaths: ["packages/a.ts", "packages/b.ts"],
		result: "The bounded root change landed.",
		verification: ["focused checks passed"],
		rerouteFrameId: "frame:reroute-debt",
		verificationFrameId: "frame:verification-debt",
	});
	assert.equal(verifyRuntimeImplementationLanding(landing), landing);
	const landingRef = eventRef({ suffix: "landing", character: "c" });
	root = rootAccept(
		recordRuntimeLanding({
			root,
			scope: settled.state,
			landing,
			landingEventRef: landingRef,
		}),
	);
	assert.equal(root.activeAuthorization, null);
	assert.equal(root.debts[0]?.reroutePending, true);
	assert.equal(root.debts[0]?.verificationPending, true);
	assert.throws(() => verifyRuntimeRootState(structuredClone(root)));
	assert.throws(() =>
		verifyRuntimeChangeAuthorization(structuredClone(change)),
	);
	assert.throws(() =>
		verifyRuntimeImplementationLanding(structuredClone(landing)),
	);
});

test("landing debt requires exact causal reroute and verification frames", () => {
	const settled = addSettledFrame({
		state: initialDeveloperWorkScopeState(id("scope:root")),
		suffix: "debt-origin",
	});
	const change = authorization({ frame: settled.frame, state: settled.state });
	let root = rootAccept(
		authorizeRuntimeChange({
			root: initialRuntimeRootState(),
			scope: settled.state,
			authorization: change,
		}),
	);
	const landing = createRuntimeImplementationLanding({
		landingId: "landing:debt",
		authorizationId: change.authorizationId,
		changedPaths: ["packages/debt.ts"],
		result: "Debt is explicit.",
		verification: [],
		rerouteFrameId: "frame:debt-reroute",
		verificationFrameId: "frame:debt-verification",
	});
	const landingRef = eventRef({ suffix: "debt-landing", character: "d" });
	root = rootAccept(
		recordRuntimeLanding({
			root,
			scope: settled.state,
			landing,
			landingEventRef: landingRef,
		}),
	);
	const reroute = addSettledFrame({
		state: settled.state,
		suffix: "debt-reroute",
		frameId: landing.rerouteFrameId,
	});
	const wrongReroute = observeRuntimeFrameOpened({
		root,
		scope: reroute.state,
		frameId: reroute.frame.frameId,
		causalRefs: [],
	});
	assert.equal(wrongReroute.ok, false);
	assert.equal(wrongReroute.state, root);
	root = rootAccept(
		observeRuntimeFrameOpened({
			root,
			scope: reroute.state,
			frameId: reroute.frame.frameId,
			causalRefs: [landingRef],
		}),
	);
	assert.equal(root.debts[0]?.reroutePending, false);
	const verification = addSettledFrame({
		state: reroute.state,
		suffix: "debt-verification",
		frameId: landing.verificationFrameId,
		routeDefinitionId: id("route:claim-evidence-assessment"),
	});
	const wrongVerification = observeRuntimeFrameConcluded({
		root,
		scope: verification.state,
		frameId: verification.frame.frameId,
		causalRefs: [],
	});
	assert.equal(wrongVerification.ok, false);
	root = rootAccept(
		observeRuntimeFrameConcluded({
			root,
			scope: verification.state,
			frameId: verification.frame.frameId,
			causalRefs: [landingRef],
		}),
	);
	assert.equal(root.debts[0]?.verificationPending, false);
	const closed = closeRuntimeScope({
		root,
		scope: verification.state,
		closure: createRuntimeScopeClosure({ reason: "User disabled Developer." }),
	});
	if (!closed.ok) assert.fail(closed.error.message);
	assert.equal(closed.state.status, "closed");
	const afterClose = observeRuntimeFrameOpened({
		root: closed.state,
		scope: verification.state,
		frameId: verification.frame.frameId,
		causalRefs: [],
	});
	assert.equal(afterClose.ok, false);
	if (!afterClose.ok) assert.equal(afterClose.error.code, "scope-closed");
});

test("authorization and closure fail closed while work remains active", () => {
	const scope = initialDeveloperWorkScopeState(id("scope:root"));
	const fakeFrame = parseRouteFrame({
		frameId: "frame:missing",
		frameRevision: 0,
		workScopeId: scope.workScopeId,
		parentFrameId: null,
		routeDefinitionId: "route:missing",
		routeDefinitionRevisionSha256: sha("e"),
		exactQuestion: "Missing frame?",
		obligationIds: ["obligation:missing"],
		obligationSetSha256: sha("f"),
	});
	const stale = createRuntimeChangeAuthorization({
		authorizationId: "change:stale",
		frameId: fakeFrame.frameId,
		frameRevision: 0,
		conclusionSha256: sha("1"),
		movement: "Do not authorize stale work.",
		stableLanding: "No stale landing.",
		verificationTarget: "The stale authorization is rejected.",
		boundary: null,
	});
	const result = authorizeRuntimeChange({
		root: initialRuntimeRootState(),
		scope,
		authorization: stale,
	});
	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "authorization-stale");
});
