import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";

import skillReferencesDisclosure, {
	MAX_REFERENCES_BYTES,
} from "../extensions/skill-references/index.js";

function createHarness() {
	const handlers = new Map();
	const sentMessages = [];
	const pi = {
		on(event, handler) {
			assert.equal(handlers.has(event), false, `duplicate ${event} handler`);
			handlers.set(event, handler);
		},
		sendMessage(message, options) {
			sentMessages.push({ message, options });
		},
	};

	skillReferencesDisclosure(pi);
	return {
		handlers,
		sentMessages,
		before: handlers.get("before_agent_start"),
		toolResult: handlers.get("tool_result"),
	};
}

async function createWorkspace(t) {
	const root = await mkdtemp(join(tmpdir(), "developer-references-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
}

async function createSkill(root, name, options = {}) {
	const skillDir = join(root, options.directory ?? name);
	const skillPath = join(skillDir, "SKILL.md");
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		skillPath,
		`---\nname: ${name}\ndescription: fixture\n---\n\n# ${name}\n`,
	);
	if (options.referencesJson !== undefined) {
		await writeFile(
			join(skillDir, "references.json"),
			options.referencesJson,
		);
	}
	return {
		name,
		description: "fixture",
		filePath: skillPath,
		baseDir: skillDir,
		disableModelInvocation: false,
		sourceInfo: {
			path: skillPath,
			source: options.source ?? "fixture",
			scope: options.scope ?? "temporary",
			origin: options.origin ?? "top-level",
			baseDir: skillDir,
		},
	};
}

function beforeEvent(cwd, skills, prompt = "ordinary request") {
	return {
		type: "before_agent_start",
		prompt,
		systemPrompt: "",
		systemPromptOptions: { cwd, skills },
	};
}

function readResult(
	path,
	content = [{ type: "text", text: "skill body" }],
	toolCallId = "read-1",
) {
	return {
		type: "tool_result",
		toolName: "read",
		toolCallId,
		input: { path },
		content,
		details: {},
		isError: false,
	};
}

test("registers only passive lifecycle hooks", () => {
	const harness = createHarness();
	assert.deepEqual([...harness.handlers.keys()].sort(), [
		"before_agent_start",
		"tool_result",
	]);
});

test("queues hidden Skill References for discovered package, global, and project Skill reads", async (t) => {
	const cwd = await createWorkspace(t);
	const referencesJson = JSON.stringify({
		routes: [{ path: "references/detail.md" }],
	});
	const skills = await Promise.all([
		createSkill(cwd, "package-method", {
			directory: "package/method",
			referencesJson,
			source: "npm:@example/methods",
			origin: "package",
		}),
		createSkill(cwd, "global-method", {
			directory: "global/method",
			referencesJson,
			source: "local",
			scope: "user",
		}),
		createSkill(cwd, "project-method", {
			directory: "project/method",
			referencesJson,
			source: "local",
			scope: "project",
		}),
	]);
	const harness = createHarness();
	assert.equal(await harness.before(beforeEvent(cwd, skills)), undefined);

	for (const [index, skill] of skills.entries()) {
		const path = index === 0
			? `@${relative(cwd, skill.filePath)}`
			: skill.filePath;
		const original = [{ type: "text", text: `body:${skill.name}` }];
		const event = readResult(path, original, `read-${index}`);
		const result = await harness.toolResult(event, { cwd });
		const sent = harness.sentMessages[index];

		assert.equal(result, undefined);
		assert.deepEqual(event.content, original);
		assert.equal(sent.message.display, false);
		assert.match(sent.message.content, /developer-skill-references/);
		assert.match(
			sent.message.content,
			new RegExp(`skill="${skill.name}"`),
		);
		assert.match(sent.message.content, /references\/detail\.md/);
		assert.deepEqual(sent.options, { deliverAs: "steer" });
	}
});

test("discloses Skill References for direct /skill expansion without a read Tool call", async (t) => {
	const cwd = await createWorkspace(t);
	const skill = await createSkill(cwd, "direct-method", {
		referencesJson: JSON.stringify({ arbitrary: "schema-free" }),
	});
	const prompt = [
		`<skill name="${skill.name}" location="${skill.filePath}">`,
		`References are relative to ${skill.baseDir}.`,
		"",
		"# Direct method",
		"</skill>",
		"",
		"user arguments",
	].join("\n");
	const harness = createHarness();
	const result = await harness.before(beforeEvent(cwd, [skill], prompt));

	assert.equal(result.message.customType, "developer-skill-references");
	assert.equal(result.message.display, false);
	assert.match(result.message.content, /"arbitrary":"schema-free"/);
	assert.equal(result.message.details.skillPath, skill.filePath);
});

test("requires the expanded Skill name and location to match Pi discovery", async (t) => {
	const cwd = await createWorkspace(t);
	const skill = await createSkill(cwd, "known-method", {
		referencesJson: JSON.stringify({ route: true }),
	});
	const harness = createHarness();
	const forged = `<skill name="other-method" location="${skill.filePath}">\nbody\n</skill>`;

	assert.equal(
		await harness.before(beforeEvent(cwd, [skill], forged)),
		undefined,
	);
});

test("leaves missing, malformed, oversized, and unreadable Skill References as silent no-ops", async (t) => {
	const cwd = await createWorkspace(t);
	const missing = await createSkill(cwd, "missing");
	const malformed = await createSkill(cwd, "malformed", {
		referencesJson: "{oops",
	});
	const oversized = await createSkill(cwd, "oversized", {
		referencesJson: JSON.stringify({
			value: "x".repeat(MAX_REFERENCES_BYTES),
		}),
	});
	const unreadable = await createSkill(cwd, "unreadable");
	await mkdir(join(dirname(unreadable.filePath), "references.json"));
	const skills = [missing, malformed, oversized, unreadable];
	const harness = createHarness();
	await harness.before(beforeEvent(cwd, skills));

	for (const skill of skills) {
		assert.equal(
			await harness.toolResult(readResult(skill.filePath), { cwd }),
			undefined,
		);
	}
	assert.equal(harness.sentMessages.length, 0);
});

test("ignores ordinary reads, failed reads, and undiscovered SKILL.md files", async (t) => {
	const cwd = await createWorkspace(t);
	const discovered = await createSkill(cwd, "discovered", {
		referencesJson: JSON.stringify({ route: true }),
	});
	const undiscovered = await createSkill(cwd, "undiscovered", {
		referencesJson: JSON.stringify({ route: true }),
	});
	const ordinaryPath = join(cwd, "ordinary.md");
	await writeFile(ordinaryPath, "ordinary");
	const harness = createHarness();
	await harness.before(beforeEvent(cwd, [discovered]));

	assert.equal(
		await harness.toolResult(readResult(ordinaryPath), { cwd }),
		undefined,
	);
	assert.equal(
		await harness.toolResult(readResult(undiscovered.filePath), { cwd }),
		undefined,
	);
	assert.equal(
		await harness.toolResult(
			{ ...readResult(discovered.filePath), isError: true },
			{ cwd },
		),
		undefined,
	);
	assert.equal(harness.sentMessages.length, 0);
});

test("preserves native read results, never eager-loads References, and deduplicates a Tool result", async (t) => {
	const cwd = await createWorkspace(t);
	const skill = await createSkill(cwd, "bounded-method", {
		referencesJson: JSON.stringify({
			references: [{ path: "references/detail.md" }],
		}),
	});
	const referenceDir = join(dirname(skill.filePath), "references");
	await mkdir(referenceDir);
	await writeFile(join(referenceDir, "detail.md"), "REFERENCE_BODY_SENTINEL");
	const harness = createHarness();
	await harness.before(beforeEvent(cwd, [skill]));

	const original = [{ type: "text", text: "skill body" }];
	const event = readResult(skill.filePath, original);
	assert.equal(await harness.toolResult(event, { cwd }), undefined);
	assert.deepEqual(event.content, original);
	assert.doesNotMatch(harness.sentMessages[0].message.content, /REFERENCE_BODY_SENTINEL/);

	assert.equal(await harness.toolResult(event, { cwd }), undefined);
	assert.equal(harness.sentMessages.length, 1);

	assert.equal(
		await harness.toolResult(
			readResult(join(referenceDir, "detail.md"), [
				{ type: "text", text: "REFERENCE_BODY_SENTINEL" },
			]),
			{ cwd },
		),
		undefined,
	);
	assert.equal(harness.sentMessages.length, 1);
});
