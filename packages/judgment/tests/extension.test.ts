import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import judgmentExtension from "../extensions/judgment.ts";

interface RegisteredTool {
	readonly name: string;
	readonly execute: (...args: readonly unknown[]) => Promise<{
		readonly content: readonly {
			readonly type: string;
			readonly text: string;
		}[];
	}>;
}

test("a project policy becomes visible before applicability is recorded", async () => {
	const root = await mkdtemp(join(tmpdir(), "judgment-project-skill-"));
	try {
		const policyRoot = join(root, "policy-aware");
		const plainRoot = join(root, "plain");
		await Promise.all([
			mkdir(join(policyRoot, "references"), { recursive: true }),
			mkdir(plainRoot, { recursive: true }),
		]);
		await Promise.all([
			writeFile(
				join(policyRoot, "SKILL.md"),
				"---\nname: policy-aware\ndescription: Policy fixture.\n---\n# Policy fixture\n",
				"utf8",
			),
			writeFile(
				join(policyRoot, "references/boundary.md"),
				"# Boundary\n",
				"utf8",
			),
			writeFile(
				join(policyRoot, "judgment.json"),
				`${JSON.stringify(
					{
						specVersion: "0.1",
						when: ["A project boundary remains unresolved."],
						unless: ["Another capability already owns the concrete boundary."],
						references: [
							{
								path: "references/boundary.md",
								when: [
									"An unresolved project boundary needs the ownership distinction in this reference.",
								],
							},
						],
					},
					null,
					2,
				)}\n`,
				"utf8",
			),
			writeFile(
				join(plainRoot, "SKILL.md"),
				"---\nname: plain\ndescription: Plain fixture.\n---\n# Plain fixture\n",
				"utf8",
			),
		]);

		const tools = new Map<string, RegisteredTool>();
		const handlers = new Map<
			string,
			(...args: readonly unknown[]) => unknown
		>();
		const appended: unknown[] = [];
		const pi = {
			registerTool(tool: RegisteredTool) {
				tools.set(tool.name, tool);
			},
			on(name: string, handler: (...args: readonly unknown[]) => unknown) {
				handlers.set(name, handler);
			},
			getAllTools() {
				return [];
			},
			getActiveTools() {
				return [];
			},
			appendEntry(type: string, data: unknown) {
				appended.push({ type, data });
			},
		};
		Reflect.apply(judgmentExtension, undefined, [pi]);
		const before = handlers.get("before_agent_start");
		assert.ok(before);
		await before(
			{
				systemPrompt: "base",
				systemPromptOptions: {
					skills: [
						{
							name: "policy-aware",
							description: "Policy fixture.",
							filePath: join(policyRoot, "SKILL.md"),
							baseDir: policyRoot,
							disableModelInvocation: false,
							sourceInfo: {
								source: "project-fixtures",
								scope: "project",
								origin: "top-level",
								path: root,
							},
						},
						{
							name: "plain",
							description: "Plain fixture.",
							filePath: join(plainRoot, "SKILL.md"),
							baseDir: plainRoot,
							disableModelInvocation: false,
							sourceInfo: {
								source: "project-fixtures",
								scope: "project",
								origin: "top-level",
								path: root,
							},
						},
					],
					contextFiles: [],
				},
			},
			{ sessionManager: { getBranch: () => [] } },
		);

		const open = tools.get("judgment_open_context");
		const assess = tools.get("judgment_assess_applicability");
		assert.ok(open);
		assert.ok(assess);
		const opened = await open.execute("open-policy", {
			skillName: "policy-aware",
			question: "Which capability owns this boundary?",
			basisMaterialIds: [],
		});
		const text = opened.content.map((item) => item.text).join("\n");
		assert.match(text, /A project boundary remains unresolved/u);
		assert.match(text, /exclusions win/u);
		assert.match(text, /State: started/u);
		const judgmentId = /Judgment: (judgment-[a-f0-9]+)/u.exec(text)?.[1];
		assert.ok(judgmentId);
		const assessed = await assess.execute("assess-policy", {
			judgmentId,
			applicability: {
				kind: "applicable",
				basis: ["The positive condition matches and the exclusion does not."],
			},
		});
		assert.match(assessed.content[0]?.text ?? "", /State: selection-open/u);

		const plain = await open.execute("open-plain", {
			skillName: "plain",
			question: "What exact external evidence changes this judgment?",
			basisMaterialIds: [],
		});
		assert.match(
			plain.content.map((item) => item.text).join("\n"),
			/No judgment\.json is present/u,
		);
		assert.equal(appended.length, 3);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
