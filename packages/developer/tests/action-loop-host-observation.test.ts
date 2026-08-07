import assert from "node:assert/strict";
import test from "node:test";

import {
	admitLiveToolResultObservation,
	admitLiveUserPromptObservation,
	bindLiveHostObservation,
	liveHostObservationPrompt,
	matchingLiveHostObservation,
	MAX_LIVE_HOST_OBSERVATION_STATEMENT_CHARS,
} from "../extensions/action-loop-host-observation.ts";

test("the exact current user prompt becomes bounded human evidence without interpretation", () => {
	const prompt = `Vendor approval is still pending. ${"detail ".repeat(600)}`;
	const first = admitLiveUserPromptObservation(prompt);
	const second = admitLiveUserPromptObservation(prompt);
	assert.equal(first.status, "admitted");
	assert.equal(second.status, "admitted");
	if (first.status !== "admitted" || second.status !== "admitted") return;
	assert.equal(first.observation.kind, "human");
	assert.equal(first.observation.source, "pi:user-prompt");
	assert.equal(
		first.observation.observationId,
		second.observation.observationId,
	);
	assert.ok(
		first.observation.statement.length <=
			MAX_LIVE_HOST_OBSERVATION_STATEMENT_CHARS,
	);
	assert.match(first.observation.basis[0] ?? "", /exact current user prompt/);
});

test("one exact finalized tool result becomes provenance-bound evidence", () => {
	const first = admitLiveToolResultObservation(
		"check_ci",
		"call-1",
		{ isError: false, content: [{ type: "text", text: "pending" }] },
		"work-case-1",
	);
	const changed = admitLiveToolResultObservation(
		"check_ci",
		"call-1",
		{ isError: false, content: [{ type: "text", text: "success" }] },
		"work-case-1",
	);
	assert.equal(first.status, "admitted");
	assert.equal(changed.status, "admitted");
	if (first.status !== "admitted" || changed.status !== "admitted") return;
	assert.notEqual(
		first.observation.observationId,
		changed.observation.observationId,
	);
	assert.equal(first.observation.kind, "tool");
	assert.match(first.observation.source, /check_ci:call-1/);
	assert.match(
		first.observation.basis.join("\n"),
		/does not imply semantic truth/,
	);
});

test("pre-opening evidence binds to one Work Case and cannot cross ownership", () => {
	const admitted = admitLiveUserPromptObservation(
		"The external review is pending.",
	);
	assert.equal(admitted.status, "admitted");
	if (admitted.status !== "admitted") return;
	const bound = bindLiveHostObservation(admitted.observation, "work-case-1");
	assert.ok(bound);
	assert.equal(
		matchingLiveHostObservation(
			bound ? [bound] : [],
			admitted.observation.observationId,
			"work-case-1",
		)?.observationId,
		admitted.observation.observationId,
	);
	assert.equal(bindLiveHostObservation(bound!, "work-case-2"), undefined);
	assert.equal(
		matchingLiveHostObservation(
			bound ? [bound] : [],
			admitted.observation.observationId,
			"work-case-2",
		),
		undefined,
	);
});

test("observation prompts expose exact IDs without promoting evidence to conclusions", () => {
	const admitted = admitLiveUserPromptObservation(
		"The operator says deployment may resume.",
		"work-case-1",
	);
	assert.equal(admitted.status, "admitted");
	if (admitted.status !== "admitted") return;
	const prompt = liveHostObservationPrompt([admitted.observation]);
	assert.match(prompt, new RegExp(admitted.observation.observationId));
	assert.match(prompt, /evidence, not conclusions/);
});

test("blank prompts and non-canonical tool evidence fail before admission", () => {
	assert.equal(admitLiveUserPromptObservation("  ").status, "invalid");
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	assert.equal(
		admitLiveToolResultObservation("read", "call-1", cyclic, "work-case-1")
			.status,
		"invalid",
	);
});
