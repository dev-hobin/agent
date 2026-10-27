import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	InMemoryCredentialStore,
} from "@earendil-works/pi-ai";
import {
	createAgentSession,
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

const extensionPath = fileURLToPath(
	new URL("../adapters/pi/skill-references/index.js", import.meta.url),
);

async function createFixture(t) {
	const cwd = await mkdtemp(join(tmpdir(), "developer-pi-integration-"));
	t.after(() => rm(cwd, { recursive: true, force: true }));
	const agentDir = join(cwd, "agent");
	const skillDir = join(cwd, "external-skills", "fixture-method");
	const skillPath = join(skillDir, "SKILL.md");
	await mkdir(agentDir, { recursive: true });
	await mkdir(skillDir, { recursive: true });
	await writeFile(
		skillPath,
		"---\nname: fixture-method\ndescription: Integration fixture\n---\n\n# Fixture method\n\nFollow fixture guidance.\n",
	);
	await writeFile(
		join(skillDir, "references.json"),
		JSON.stringify({ route: "INTEGRATION_REFERENCES_SENTINEL" }),
	);
	return { cwd, agentDir, skillDir, skillPath };
}

async function createFixtureSession(fixture, faux) {
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: false },
	});
	const resourceLoader = new DefaultResourceLoader({
		cwd: fixture.cwd,
		agentDir: fixture.agentDir,
		settingsManager,
		additionalExtensionPaths: [extensionPath],
		additionalSkillPaths: [fixture.skillDir],
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
	});
	await resourceLoader.reload();

	const modelRuntime = await ModelRuntime.create({
		credentials: new InMemoryCredentialStore(),
		modelsPath: null,
	});
	modelRuntime.registerNativeProvider(faux.provider);
	const model = modelRuntime.getModel(faux.provider.id, faux.models[0].id);
	assert.ok(model);

	const result = await createAgentSession({
		cwd: fixture.cwd,
		agentDir: fixture.agentDir,
		model,
		modelRuntime,
		tools: ["read"],
		resourceLoader,
		sessionManager: SessionManager.inMemory(fixture.cwd),
		settingsManager,
	});
	assert.deepEqual(result.extensionsResult.errors, []);
	return result.session;
}

test("actual Pi read Tool lifecycle returns Skill References to the next native model turn", async (t) => {
	const fixture = await createFixture(t);
	const faux = fauxProvider();
	let followUpContext;
	faux.setResponses([
		fauxAssistantMessage(
			fauxToolCall("read", { path: fixture.skillPath }),
			{ stopReason: "toolUse" },
		),
		(context) => {
			followUpContext = JSON.stringify(context);
			return fauxAssistantMessage("done");
		},
	]);
	const session = await createFixtureSession(fixture, faux);
	t.after(() => session.dispose());

	await session.prompt("Load the fixture Skill.");

	assert.ok(
		followUpContext,
		`missing faux follow-up context: ${JSON.stringify(session.messages)}`,
	);
	const context = followUpContext;
	assert.match(context, /Follow fixture guidance/);
	assert.match(context, /INTEGRATION_REFERENCES_SENTINEL/);
	assert.match(context, /developer-skill-references/);

	const toolResult = session.messages.find(
		(message) => message.role === "toolResult",
	);
	assert.ok(toolResult);
	assert.match(JSON.stringify(toolResult), /Follow fixture guidance/);
	assert.doesNotMatch(
		JSON.stringify(toolResult),
		/INTEGRATION_REFERENCES_SENTINEL/,
	);

	const disclosure = session.messages.find(
		(message) => message.role === "custom" &&
			message.customType === "developer-skill-references",
	);
	assert.ok(disclosure);
	assert.equal(disclosure.display, false);
	assert.equal(faux.state.callCount, 2);
});

test("actual Pi /skill expansion receives Skill References before its native model turn", async (t) => {
	const fixture = await createFixture(t);
	const faux = fauxProvider();
	let initialContext;
	faux.setResponses([
		(context) => {
			initialContext = JSON.stringify(context);
			return fauxAssistantMessage("done");
		},
	]);
	const session = await createFixtureSession(fixture, faux);
	t.after(() => session.dispose());

	await session.prompt("/skill:fixture-method");

	assert.ok(
		initialContext,
		`missing faux initial context: ${JSON.stringify(session.messages)}`,
	);
	const context = initialContext;
	assert.match(context, /<skill name=\\?"fixture-method/);
	assert.match(context, /INTEGRATION_REFERENCES_SENTINEL/);
	assert.match(context, /developer-skill-references/);
	assert.equal(faux.state.callCount, 1);
});
