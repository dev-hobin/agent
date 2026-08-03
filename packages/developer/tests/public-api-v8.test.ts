import assert from "node:assert/strict";
import test from "node:test";

import * as developer from "../src/index.ts";

const expectedV8Exports = [
	"AUTHORIZE_CHANGE_TOOL",
	"CONCLUDE_JUDGMENT_TOOL",
	"DEVELOPER_PROTOCOL_TOOLS",
	"DEVELOPER_RUNTIME_PROTOCOL",
	"OPEN_CONTEXT_SOURCES_TOOL",
	"OPEN_JUDGMENT_TOOL",
	"RECORD_LANDING_TOOL",
	"beginProjectionRefresh",
	"createReceiptProjection",
	"createRouteDefinition",
	"initialDeveloperWorkScopeState",
	"initialProjectionCoordinatorState",
	"parseDeveloperEventEnvelope",
	"projectionReadTarget",
	"readCurrentReceiptPage",
	"replayDeveloperRuntime",
] as const;

const forbiddenV7Exports = [
	"DEVELOPER_ACTIVATION_ENTRY",
	"DEVELOPER_EVENT_ENTRY",
	"DEVELOPER_FOCUS_ENTRY",
	"DEVELOPER_PROTOCOL",
	"activationChanged",
	"changeAuthorized",
	"contextBasisFromJudgment",
	"initialDeveloperState",
	"judgmentOpened",
	"parseDeveloperEvent",
	"replayDeveloper",
	"transitionDeveloper",
] as const;

test("package root exports only current runtime and receipt authority", () => {
	const names = Object.keys(developer);
	for (const name of expectedV8Exports) assert.ok(names.includes(name), name);
	for (const name of forbiddenV7Exports)
		assert.equal(names.includes(name), false, name);
	assert.equal(developer.DEVELOPER_RUNTIME_PROTOCOL, "developer/v8");
	assert.deepEqual(developer.DEVELOPER_PROTOCOL_TOOLS, [
		"developer_open_judgment",
		"developer_open_context_sources",
		"developer_conclude_judgment",
		"developer_authorize_change",
		"developer_record_landing",
	]);
});
