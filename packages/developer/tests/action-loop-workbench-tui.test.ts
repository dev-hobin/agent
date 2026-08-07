import assert from "node:assert/strict";
import test from "node:test";

import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

import { ActionLoopWorkbenchSurface } from "../extensions/action-loop-workbench-tui.ts";
import type { ActionLoopWorkbenchSnapshot } from "../extensions/action-loop-workbench.ts";

const theme = {
	bold: (text: string) => text,
	italic: (text: string) => text,
	underline: (text: string) => text,
	strikethrough: (text: string) => text,
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
} as Theme;

const snapshot: ActionLoopWorkbenchSnapshot = {
	status: "waiting",
	statusLabel: "Waiting",
	headline:
		"Release the verified package without exposing internal protocol state.",
	next: "Send a normal update when the external condition changes.",
	sections: [
		{
			id: "overview",
			label: "Overview",
			items: [
				{
					title: "Waiting for",
					summary: "External security approval is pending.",
					tone: "warning",
					details: [
						{
							label: "Continue when",
							lines: ["The approval status is confirmed as granted."],
						},
					],
				},
			],
		},
		{ id: "decisions", label: "Decisions", items: [] },
		{ id: "evidence", label: "Evidence", items: [] },
		{ id: "effects", label: "Effects", items: [] },
		{ id: "history", label: "History", items: [] },
	],
};

function rendered(
	surface: ActionLoopWorkbenchSurface,
	width: number,
	height: number,
) {
	return surface.render(width, height);
}

test("canonical Workbench is bounded, semantic, and identity-free", () => {
	let renders = 0;
	let closed = false;
	const surface = new ActionLoopWorkbenchSurface({
		snapshot,
		theme,
		done: () => {
			closed = true;
		},
		requestRender: () => {
			renders += 1;
		},
	});
	const compact = rendered(surface, 48, 12);
	assert.ok(compact.length <= 12);
	assert.ok(compact.every((line) => visibleWidth(line) <= 48));
	assert.match(compact.join("\n"), /Waiting for/);
	assert.doesNotMatch(
		compact.join("\n"),
		/(?:observation|work_case|revision|conclusion|transition)_[a-z0-9]+/,
	);

	surface.handleInput("\r");
	const expanded = rendered(surface, 60, 20).join("\n");
	assert.match(expanded, /Continue when/);
	assert.match(expanded, /approval status is confirmed as granted/);
	assert.ok(renders > 0);
	surface.handleInput("\x1b");
	assert.equal(closed, false);
	surface.handleInput("\x1b");
	assert.equal(closed, true);
});

test("canonical Workbench section navigation stays read-only", () => {
	let renders = 0;
	const surface = new ActionLoopWorkbenchSurface({
		snapshot,
		theme,
		done: () => {},
		requestRender: () => {
			renders += 1;
		},
	});
	surface.handleInput("\x1b[C");
	assert.match(rendered(surface, 80, 20).join("\n"), /No current items/);
	assert.equal(
		snapshot.sections[0]?.items[0]?.summary,
		"External security approval is pending.",
	);
	assert.ok(renders > 0);
});

test("canonical Workbench bounds Korean text in a narrow terminal", () => {
	const koreanSnapshot: ActionLoopWorkbenchSnapshot = {
		...snapshot,
		headline: "외부 패키지 검증이 끝나면 안전하게 릴리스한다.",
		next: "외부 조건이 바뀌면 일반 메시지로 알려 주세요.",
		sections: snapshot.sections.map((section) =>
			section.id === "overview"
				? {
						...section,
						items: [
							{
								...section.items[0]!,
								summary: "registry 응답을 기다리는 중입니다.",
								details: [
									{
										label: "계속할 조건",
										lines: ["검증된 release가 확인됨"],
									},
								],
							},
						],
					}
				: section,
		),
	};
	const surface = new ActionLoopWorkbenchSurface({
		snapshot: koreanSnapshot,
		theme,
		done: () => {},
		requestRender: () => {},
	});
	const compact = rendered(surface, 28, 10);
	assert.ok(compact.length <= 10);
	assert.ok(compact.every((line) => visibleWidth(line) <= 28));
	assert.match(compact.join("\n"), /외부|registry/);

	surface.handleInput("\r");
	const expanded = rendered(surface, 28, 12);
	assert.ok(expanded.every((line) => visibleWidth(line) <= 28));
	assert.match(expanded.join("\n"), /계속할 조건|검증된 release/);
});
