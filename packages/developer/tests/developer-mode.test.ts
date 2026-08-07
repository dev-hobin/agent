import assert from "node:assert/strict";
import test from "node:test";

import {
	DEVELOPER_MODE_ENTRY,
	decodeDeveloperModeEvent,
	developerModeEvent,
	reconstructDeveloperMode,
} from "../extensions/developer-mode.ts";

test("Developer mode replays only exact closed activation events", () => {
	assert.equal(reconstructDeveloperMode([]), false);
	assert.equal(
		reconstructDeveloperMode([
			{ customType: DEVELOPER_MODE_ENTRY, data: developerModeEvent(true) },
		]),
		true,
	);
	assert.equal(
		reconstructDeveloperMode([
			{ customType: DEVELOPER_MODE_ENTRY, data: developerModeEvent(true) },
			{ customType: DEVELOPER_MODE_ENTRY, data: developerModeEvent(false) },
		]),
		false,
	);
	assert.equal(
		decodeDeveloperModeEvent({ ...developerModeEvent(true), extra: true }),
		undefined,
	);
	assert.equal(
		decodeDeveloperModeEvent({
			protocol: "not-developer-mode/v1",
			kind: "activation",
			enabled: true,
		}),
		undefined,
	);
});
