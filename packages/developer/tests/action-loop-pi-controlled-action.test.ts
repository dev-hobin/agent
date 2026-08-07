import assert from "node:assert/strict";
import test from "node:test";

import {
	MAX_PI_CONTROLLED_ACTION_INPUT_CHARS,
	bindPiControlledAction,
} from "../extensions/action-loop-pi-action.ts";

test("one exact Pi tool input has an order-independent controlled Action identity", () => {
	const first = bindPiControlledAction("write", {
		path: "/tmp/example.txt",
		content: "bounded output",
	});
	const reordered = bindPiControlledAction("write", {
		content: "bounded output",
		path: "/tmp/example.txt",
	});
	assert.equal(first.status, "bound");
	assert.equal(reordered.status, "bound");
	if (first.status === "bound" && reordered.status === "bound") {
		assert.deepEqual(first.value, reordered.value);
		assert.equal(first.canonicalInput, reordered.canonicalInput);
		assert.equal(first.value.kind, "pi-tool-call:write");
		assert.match(first.value.fingerprint, /^[a-f0-9]{64}$/);
		assert.equal(Object.isFrozen(first.value), true);
	}
});

test("tool name and exact input remain part of controlled Action identity", () => {
	const write = bindPiControlledAction("write", {
		path: "/tmp/example.txt",
		content: "first",
	});
	const changed = bindPiControlledAction("write", {
		path: "/tmp/example.txt",
		content: "second",
	});
	const edit = bindPiControlledAction("edit", {
		path: "/tmp/example.txt",
		content: "first",
	});
	assert.equal(write.status, "bound");
	assert.equal(changed.status, "bound");
	assert.equal(edit.status, "bound");
	if (
		write.status === "bound" &&
		changed.status === "bound" &&
		edit.status === "bound"
	) {
		assert.notEqual(write.value.fingerprint, changed.value.fingerprint);
		assert.notEqual(write.value.fingerprint, edit.value.fingerprint);
	}
});

test("unsupported, non-JSON, deeply nested, and oversized inputs fail closed", () => {
	assert.deepEqual(bindPiControlledAction("read", { path: "/tmp/a" }), {
		status: "invalid",
		message: "Unsupported controlled Pi tool: read",
	});
	assert.equal(bindPiControlledAction("write", { content: undefined }).status, "invalid");
	let nested: unknown = "leaf";
	for (let depth = 0; depth < 34; depth += 1) nested = [nested];
	assert.equal(bindPiControlledAction("write", { nested }).status, "invalid");
	assert.equal(
		bindPiControlledAction("write", {
			content: "x".repeat(MAX_PI_CONTROLLED_ACTION_INPUT_CHARS),
		}).status,
		"invalid",
	);
});
