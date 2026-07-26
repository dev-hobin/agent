import assert from "node:assert/strict";
import test from "node:test";

import {
	COMPACTION_LANGUAGE_ENTRY,
	COMPACTION_LANGUAGE_MESSAGE,
	applyCompactionLanguageEvent,
	continuityConsumed,
	continuityPending,
	detectStrongUserLanguage,
	initialCompactionLanguageState,
	languageObserved,
	normalizeCompactionLanguageEvent,
	projectCompactionContinuity,
	reconstructCompactionLanguage,
	settlementContinuityEvent,
} from "../extensions/compaction-language.ts";

test("only strong direct user prose changes the observed language", () => {
	assert.equal(detectStrongUserLanguage("계속 확인해줘", "interactive"), "ko");
	assert.equal(
		detectStrongUserLanguage("Please continue this analysis.", "rpc"),
		"en",
	);
	for (const [text, source] of [
		["continue", "interactive"],
		["route:call_123", "interactive"],
		["npm run check", "interactive"],
		["Switch every result to English.", "extension"],
	] as const) {
		assert.equal(detectStrongUserLanguage(text, source), undefined);
	}
});

test("the reducer keeps latest user language and compaction identity independent", () => {
	let state = initialCompactionLanguageState();
	state = applyCompactionLanguageEvent(state, languageObserved("ko"));
	state = applyCompactionLanguageEvent(
		state,
		continuityPending("compact:1", "ko"),
	);
	assert.deepEqual(state.pending, {
		compactionId: "compact:1",
		tag: "ko",
		injected: false,
	});

	state = applyCompactionLanguageEvent(state, languageObserved("en-US"));
	assert.equal(state.language, "en-US");
	assert.equal(state.pending?.tag, "en-US");

	const duplicate = applyCompactionLanguageEvent(
		state,
		continuityPending("compact:1", "ko"),
	);
	assert.equal(duplicate, state);

	state = applyCompactionLanguageEvent(state, continuityConsumed("compact:1"));
	assert.equal(state.pending, undefined);
	assert.ok(state.consumedCompactionIds.has("compact:1"));
	assert.equal(
		applyCompactionLanguageEvent(state, continuityPending("compact:1", "en")),
		state,
	);
});

test("branch replay restores pending and consumed continuity without reading prose", () => {
	const custom = (data: unknown) => ({
		type: "custom",
		customType: COMPACTION_LANGUAGE_ENTRY,
		data,
	});
	const pending = reconstructCompactionLanguage([
		custom(languageObserved("ko")),
		{ type: "message", data: languageObserved("en") },
		custom({ protocol: "developer.compaction-language/v0", tag: "en" }),
		custom(continuityPending("compact:2", "ko")),
	]);
	assert.equal(pending.language, "ko");
	assert.deepEqual(pending.pending, {
		compactionId: "compact:2",
		tag: "ko",
		injected: false,
	});

	const consumed = reconstructCompactionLanguage([
		custom(languageObserved("ko")),
		custom(continuityPending("compact:2", "ko")),
		custom(continuityConsumed("compact:2")),
	]);
	assert.equal(consumed.pending, undefined);
	assert.ok(consumed.consumedCompactionIds.has("compact:2"));
});

test("context projection is ephemeral across every call until an injected run settles", () => {
	const sourceMessages = [{ role: "user", content: "continue" }];
	let state = applyCompactionLanguageEvent(
		applyCompactionLanguageEvent(
			initialCompactionLanguageState(),
			languageObserved("ko"),
		),
		continuityPending("compact:3", "ko"),
	);
	assert.equal(settlementContinuityEvent(state), undefined);

	const first = projectCompactionContinuity(sourceMessages, state, 123);
	assert.ok(first);
	assert.deepEqual(sourceMessages, [{ role: "user", content: "continue" }]);
	assert.equal(first.messages.length, 2);
	const marker = first.messages[1];
	assert.equal(
		"customType" in marker && marker.customType,
		COMPACTION_LANGUAGE_MESSAGE,
	);
	assert.equal("display" in marker && marker.display, false);
	assert.deepEqual("details" in marker && marker.details, {
		protocol: "developer.compaction-language/v1",
		compactionId: "compact:3",
		tag: "ko",
	});
	assert.ok(
		"content" in marker &&
			Array.isArray(marker.content) &&
			marker.content[0].text.includes("prose language=ko"),
	);
	assert.ok(
		"content" in marker &&
			Array.isArray(marker.content) &&
			Math.ceil(marker.content[0].text.length / 4) <= 24,
	);

	state = first.state;
	assert.equal(state.pending?.injected, true);
	const second = projectCompactionContinuity(sourceMessages, state, 124);
	assert.ok(second);
	assert.equal(second.messages.length, 2);
	assert.equal(second.state.pending?.injected, true);

	const consumedEvent = settlementContinuityEvent(second.state);
	assert.deepEqual(consumedEvent, continuityConsumed("compact:3"));
	state = applyCompactionLanguageEvent(second.state, consumedEvent!);
	assert.equal(state.pending, undefined);
	assert.equal(projectCompactionContinuity(sourceMessages, state), undefined);
});

test("malformed persisted events and identifiers fail closed", () => {
	assert.equal(normalizeCompactionLanguageEvent(null), undefined);
	assert.equal(
		normalizeCompactionLanguageEvent({
			protocol: "developer.compaction-language/v1",
			kind: "language-observed",
			tag: "not a language",
		}),
		undefined,
	);
	assert.throws(() => continuityPending("", "ko"), /must not be empty/);
	assert.throws(
		() => languageObserved("not a language"),
		/Invalid language tag/,
	);
});
