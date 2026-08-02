import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJsonlDecoder } from "./jsonl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePackage = resolve(process.env.LEARNING_EVAL_PACKAGE_PATH || root);
const piBin = process.env.PI_BIN ? resolve(process.env.PI_BIN) : "pi";
const configDir = process.env.PI_CODING_AGENT_DIR;
const timeoutMs = Number(process.env.LEARNING_EVAL_TIMEOUT_MS || 180_000);
const thinking = process.env.LEARNING_EVAL_THINKING || "medium";

if (!configDir) {
	throw new Error(
		"Learning contrast eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.",
	);
}
const version = spawnSync(piBin, ["--version"], { encoding: "utf8" });
if (version.status !== 0) {
	throw new Error(`Could not resolve Pi version: ${version.stderr}`);
}
const piVersion = version.stdout.trim();

const fixtures = [
	{
		id: "no-reference",
		skill: "exercise",
		request: [
			"다음 개념만 사용해 하나의 짧은 회상 문제와 정답 기준을 만들어라.",
			"개념: 순수 함수는 같은 입력에 같은 출력을 내고 외부 상태를 변경하지 않는다.",
			"학습자가 답을 실제로 산출해야 하며, 결과는 이 응답만으로 완전해야 한다.",
		].join("\n"),
		references: [],
		output: /회상|문제|정답|기준/u,
	},
	{
		id: "one-reference",
		skill: "technical-reading",
		request: [
			"기술 서적의 연속된 절을 읽는 상황이다.",
			"앞 절은 '파싱이 경계에서 불확실성을 제거한다'를 세웠고, 현재 절은 '정제된 값은 내부에서 다시 검사하지 않는다'고 말한다.",
			"현재 절이 앞 절을 어떻게 전진시키는지 설명하고, 출처 재구성과 코칭을 분리하라.",
		].join("\n"),
		references: ["technical-reading/references/book-continuity.md"],
		output: /앞 절|이전 절|연속|전진|의존/u,
	},
	{
		id: "several-references",
		skill: "patternize",
		request: [
			"세 사례를 하나의 실행 가능한 패턴으로 판단하라.",
			"사례 A: 배포 전 계약·선택·검증을 분리하지 않아 잘못된 승인이 났다.",
			"사례 B: 학습 자료에서 사용 가능성과 필수성을 합쳐 불필요한 문서를 모두 읽었다.",
			"사례 C: 관찰 기록에서 증거 수집과 의미 판단을 합쳐 출처 권위가 위조됐다.",
			"세 사례는 표면 용어와 산출물이 달라 직접 비교만으로 같은 조정 메커니즘인지 단순 주제 유사성인지 판별하기 어렵다.",
			"공통 힘, 조정 축, 순서, 건너뛸 때의 실패를 제시하고, 여러 분기와 반복 피드백을 가장 작게 드러내는 시각 형태도 포함하라.",
		].join("\n"),
		references: [
			"patternize/references/recurrence-and-forces.md",
			"patternize/references/pattern-visualization.md",
		],
		output: /힘|조정|패턴|피드백|분기/u,
	},
	{
		id: "missing-reference",
		skill: "technical-reading",
		remove: "skills/technical-reading/references/book-continuity.md",
		request: [
			"기술 서적의 현재 절이 이전 장의 용어와 예제 순서에 의존하므로 책 연속성 판단이 결과를 바꾼다.",
			"이전 장은 raw input과 refined value를 구분했고, 현재 절은 그 구분을 API 경계에 적용한다.",
			"선언된 조건부 지침을 사용할 수 없다면 계약의 missing policy에 따라 진행하고 그 한계를 명시하라.",
		].join("\n"),
		references: ["technical-reading/references/book-continuity.md"],
		missing: true,
		output: /한계|제한|없|접근|확인/u,
	},
	{
		id: "conflicting-sources",
		skill: "conceptualize",
		request: [
			"두 출처의 같은 용어를 하나의 개념으로 성급히 합치지 말고 개념 경계를 판단하라.",
			"출처 A: 'validation'은 boolean 검사이며 원래 값을 그대로 통과시킨다.",
			"출처 B: 'validation'은 외부 표현을 내부 불변식 보유 값으로 파싱하는 변환이며 실패를 값으로 표현한다.",
			"충돌을 보존하고, 합칠 수 있는 부분과 분리해야 하는 부분, 필요한 후속 증거를 제시하라.",
		].join("\n"),
		allowedReferences: [
			"conceptualize/references/concept-boundaries.md",
			"conceptualize/references/cross-source-synthesis.md",
		],
		minimumReferenceReads: 0,
		output: /충돌|분리|경계|출처 A|출처 B/u,
	},
];

const selected = process.env.LEARNING_EVAL_FIXTURE
	? fixtures.filter(
			(fixture) => fixture.id === process.env.LEARNING_EVAL_FIXTURE,
		)
	: fixtures;
if (selected.length === 0) {
	throw new Error(
		`Unknown LEARNING_EVAL_FIXTURE: ${process.env.LEARNING_EVAL_FIXTURE}`,
	);
}

async function packageFor(fixture, temporaryRoot) {
	if (!fixture.remove) return sourcePackage;
	const candidate = join(temporaryRoot, "learning");
	const sourceNodeModules = join(sourcePackage, "node_modules");
	await cp(sourcePackage, candidate, {
		recursive: true,
		filter(source) {
			return (
				source !== sourceNodeModules &&
				!source.startsWith(`${sourceNodeModules}/`)
			);
		},
	});
	await symlink(join(root, "node_modules"), join(candidate, "node_modules"));
	await rm(join(candidate, fixture.remove), { force: true });
	return candidate;
}

async function runFixture(fixture) {
	const temporaryRoot = await mkdtemp(
		join(tmpdir(), `learning-${fixture.id}-`),
	);
	const workspace = join(temporaryRoot, "workspace");
	await mkdir(workspace, { recursive: true });
	const packageUnderTest = await packageFor(fixture, temporaryRoot);
	const child = spawn(
		piBin,
		[
			"--mode",
			"rpc",
			"--offline",
			"--no-session",
			"--no-context-files",
			"--no-prompt-templates",
			"--no-extensions",
			"--no-skills",
			"--extension",
			join(packageUnderTest, "extensions", "learning.ts"),
			"--skill",
			join(packageUnderTest, "skills"),
			"--thinking",
			thinking,
		],
		{
			cwd: workspace,
			env: { ...process.env, PI_CODING_AGENT_DIR: configDir },
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
	const events = [];
	let stderr = "";
	let response;
	let responseResolve;
	const responseReady = new Promise((resolveResponse) => {
		responseResolve = resolveResponse;
	});
	let settledResolve;
	const settled = new Promise((resolveSettled) => {
		settledResolve = resolveSettled;
	});
	const decoder = createJsonlDecoder({
		onValue(value) {
			if (value.type !== "message_update") events.push(value);
			if (value.type === "response" && value.id === `learning-${fixture.id}`) {
				response = value;
				responseResolve();
			}
			if (value.type === "agent_settled") settledResolve();
		},
		onError(error, record) {
			stderr += `\nRPC JSONL parse error: ${error.message}\nRecord: ${record}`;
		},
	});
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => decoder.push(chunk));
	child.stdout.on("end", () => decoder.end());
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	child.on("error", (error) => {
		stderr += error.message;
		responseResolve();
		settledResolve();
	});
	let timeoutHandle;
	try {
		child.stdin.write(
			`${JSON.stringify({
				type: "prompt",
				id: `learning-${fixture.id}`,
				message: `/skill:${fixture.skill} ${fixture.request}`,
			})}\n`,
		);
		const timer = new Promise((_, reject) => {
			timeoutHandle = setTimeout(
				() => reject(new Error(`${fixture.id}: timeout\n${stderr}`)),
				timeoutMs,
			);
		});
		await Promise.race([responseReady, timer]);
		assert.equal(response?.success, true, response?.error ?? stderr);
		await Promise.race([settled, timer]);

		const reads = events
			.filter(
				(event) =>
					event.type === "tool_execution_start" &&
					event.toolName === "read" &&
					typeof event.args?.path === "string",
			)
			.map((event) => event.args.path);
		const packageReferenceReads = reads.filter(
			(path) =>
				path.includes(`${join("skills", "")}`) && path.includes("references"),
		);
		if (fixture.allowedReferences) {
			assert.ok(
				packageReferenceReads.length >= fixture.minimumReferenceReads,
				`${fixture.id}: too few justified reference reads`,
			);
			for (const path of packageReferenceReads) {
				assert.equal(
					fixture.allowedReferences.some((suffix) => path.endsWith(suffix)),
					true,
					`${fixture.id}: unrelated reference read ${path}`,
				);
			}
		} else {
			assert.equal(
				packageReferenceReads.length,
				fixture.references.length,
				`${fixture.id}: unexpected reference reads: ${packageReferenceReads.join(", ")}`,
			);
			for (const suffix of fixture.references) {
				assert.equal(
					packageReferenceReads.some((path) => path.endsWith(suffix)),
					true,
					`${fixture.id}: missing reference read ${suffix}`,
				);
			}
		}
		if (fixture.missing) {
			assert.equal(
				events.some(
					(event) =>
						event.type === "tool_execution_end" &&
						event.toolName === "read" &&
						JSON.stringify(event.result).includes("ENOENT"),
				),
				true,
				`${fixture.id}: missing source did not produce an exact read error`,
			);
		}
		const assistantText = events
			.filter(
				(event) =>
					event.type === "message_end" && event.message?.role === "assistant",
			)
			.flatMap((event) => event.message.content ?? [])
			.filter((content) => content.type === "text")
			.map((content) => content.text)
			.join("\n");
		assert.match(
			assistantText,
			fixture.output,
			`${fixture.id}: incomplete result`,
		);
		assert.doesNotMatch(stderr, /failed to load|unknown command/iu);
		return {
			id: fixture.id,
			skill: fixture.skill,
			referenceReads: packageReferenceReads.map((path) =>
				path.slice(path.indexOf(`${join("skills", "")}`)),
			),
			missing: Boolean(fixture.missing),
		};
	} finally {
		if (timeoutHandle) clearTimeout(timeoutHandle);
		child.kill("SIGTERM");
		await rm(temporaryRoot, { recursive: true, force: true });
	}
}

for (const fixture of selected) {
	const result = await runFixture(fixture);
	process.stdout.write(`LEARNING_CONTRAST_RESULT ${JSON.stringify(result)}\n`);
}
process.stdout.write(
	`Learning contrast eval passed ${selected.length}/${selected.length} cases on Pi ${piVersion}\n`,
);
