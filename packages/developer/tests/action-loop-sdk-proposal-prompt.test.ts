import assert from "node:assert/strict";
import test from "node:test";

import {
	renderSdkProposalPrompt,
	withSdkProposalRejectionFeedback,
} from "../src/action-loop/sdk/proposal-prompt.ts";

test("SDK proposal prompts separate authority from generated stage data", () => {
	const rendered = renderSdkProposalPrompt({
		stage: "need-coverage",
		objective: "Assess one exact current Need.",
		rules: ["Use only the complete supplied Contribution inventory."],
		sections: [
			{ name: "delegated_request", content: "Check the result." },
			{
				name: "current_contributions",
				content: ["0: resolved", "1: partial"],
			},
		],
		decision: "Disposition every current Contribution.",
	});

	assert.match(rendered.systemPrompt, /proposal_stage: need-coverage/);
	assert.match(rendered.systemPrompt, /authority: proposal-only/);
	assert.match(rendered.systemPrompt, /controller alone grants permission/);
	assert.doesNotMatch(rendered.systemPrompt, /proposal-only; cannot/);
	assert.match(rendered.systemPrompt, /packet_sections: current data only/);
	assert.match(rendered.systemPrompt, /complete supplied Contribution inventory/);
	assert.equal(
		rendered.prompt,
		[
			"[proposal_packet]",
			"stage: need-coverage",
			"[delegated_request]\nCheck the result.",
			"[current_contributions]\n0: resolved\n1: partial",
			"[decision]\nDisposition every current Contribution.",
		].join("\n\n"),
	);
	assert.doesNotMatch(rendered.systemPrompt, /Check the result/);
	assert.ok(rendered.systemPrompt.length <= 500);
});

test("SDK proposal packets preserve exact material content", () => {
	const material = "\n  source line  \n";
	const rendered = renderSdkProposalPrompt({
		stage: "skill-contribution",
		objective: "Use exact sealed material.",
		sections: [{ name: "sealed_skill_context", content: material }],
		decision: "Produce one local Contribution.",
	});
	assert.ok(rendered.prompt.includes(`[sealed_skill_context]\n${material}`));
});

test("SDK proposal rejection feedback is conditional and structured", () => {
	const prompt = "[proposal_packet]\n\nstage: action-candidate";
	assert.equal(withSdkProposalRejectionFeedback(prompt, []), prompt);
	const retried = withSdkProposalRejectionFeedback(prompt, [
		"tool_input_json must encode one object",
	]);
	assert.match(retried, /\[retry\]/);
	assert.match(retried, /1\. tool_input_json must encode one object/);
	assert.match(retried, /Submit one corrected proposal/);
});

test("SDK proposal prompts reject ambiguous section structure", () => {
	const base = {
		stage: "work-case-opening" as const,
		objective: "Propose one Outcome.",
		decision: "Submit one proposal.",
	};
	assert.throws(
		() =>
			renderSdkProposalPrompt({
				...base,
				sections: [
					{ name: "request", content: "first" },
					{ name: "request", content: "second" },
				],
			}),
		/Duplicate proposal prompt section/,
	);
	assert.throws(
		() =>
			renderSdkProposalPrompt({
				...base,
				sections: [{ name: "decision", content: "hidden" }],
			}),
		/Invalid proposal prompt section name/,
	);
});
