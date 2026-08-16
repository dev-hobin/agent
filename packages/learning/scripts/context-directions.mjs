import { posix } from "node:path";

const SECTION_HEADING = "## Context Directions";
const GENERATED_NOTICE =
	"This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.";
const POLICY_KEYS = new Set([
	"$schema",
	"specVersion",
	"when",
	"unless",
	"references",
]);
const REFERENCE_KEYS = new Set(["path", "when"]);

function fail(message) {
	throw new Error(message);
}

function record(value, path) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail(`Expected an object at ${path}.`);
	}
	return value;
}

function allowedKeys(value, allowed, path) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) fail(`Unexpected property ${path}/${key}.`);
	}
}

function statementKey(value) {
	return value.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
}

function statements(value, path) {
	if (!Array.isArray(value) || value.length === 0 || value.length > 64) {
		fail(`Expected 1 to 64 statements at ${path}.`);
	}
	const normalized = value.map((item, index) => {
		if (typeof item !== "string") {
			fail(`Expected text at ${path}/${index}.`);
		}
		if (item !== item.trim()) {
			fail(`Statement contains surrounding whitespace at ${path}/${index}.`);
		}
		const result = item.replace(/\s+/gu, " ");
		if (!result || result.length > 2000) {
			fail(`Expected non-blank text of at most 2000 characters at ${path}/${index}.`);
		}
		return result;
	});
	const seen = new Set();
	for (const item of normalized) {
		const key = statementKey(item);
		if (seen.has(key)) fail(`Semantic duplicate statement at ${path}: ${item}.`);
		seen.add(key);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}

function referencePath(value, path) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 1024 ||
		value !== value.trim() ||
		value.includes("\\") ||
		value.includes("\0") ||
		posix.isAbsolute(value)
	) {
		fail(`Reference path must be a relative POSIX path at ${path}.`);
	}
	const segments = value.split("/");
	if (
		segments.some(
			(segment) => segment.length === 0 || segment === "." || segment === "..",
		) ||
		posix.normalize(value) !== value
	) {
		fail(`Reference path is not directly normalized at ${path}.`);
	}
	return value;
}

function parseReference(value, index) {
	const path = `/references/${index}`;
	const input = record(value, path);
	allowedKeys(input, REFERENCE_KEYS, path);
	return Object.freeze({
		path: referencePath(input.path, `${path}/path`),
		when: statements(input.when, `${path}/when`),
	});
}

function list(items) {
	return items.map((item) => `- ${item}`).join("\n");
}

function policyDirections(policy) {
	const references = policy.references.flatMap((reference) => [
		`### \`${reference.path}\``,
		"",
		list(reference.when),
		"",
	]);
	return [
		SECTION_HEADING,
		"",
		"Use the owning capability when at least one condition applies:",
		"",
		list(policy.when),
		"",
		"Do not use it when any exclusion applies; these exclusions win:",
		"",
		list(policy.unless),
		"",
		"Prepared references are independent candidates, never requirements or authority:",
		"",
		...references,
	]
		.join("\n")
		.trimEnd();
}

export function renderLearningContextDirections(policy) {
	const body = policyDirections(policy).replace(
		/^## Context Directions\n\n/u,
		"",
	);
	return [SECTION_HEADING, "", GENERATED_NOTICE, "", body].join("\n").trimEnd();
}

export function parseLearningJudgmentPolicy(source) {
	let parsed;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error("Learning judgment policy is not valid JSON.", {
			cause: error,
		});
	}
	const input = record(parsed, "/");
	allowedKeys(input, POLICY_KEYS, "");
	if (input.specVersion !== "0.1") {
		fail("Learning judgment policy must use specVersion 0.1.");
	}
	if (
		!Array.isArray(input.references) ||
		input.references.length === 0 ||
		input.references.length > 128
	) {
		fail("Learning judgment policy must contain 1 to 128 references.");
	}
	const references = input.references
		.map(parseReference)
		.toSorted((left, right) => left.path.localeCompare(right.path));
	const seenPaths = new Set();
	for (const reference of references) {
		if (seenPaths.has(reference.path)) {
			fail(`Duplicate prepared reference path: ${reference.path}.`);
		}
		seenPaths.add(reference.path);
	}
	return Object.freeze({
		specVersion: "0.1",
		when: statements(input.when, "/when"),
		unless: statements(input.unless, "/unless"),
		references: Object.freeze(references),
	});
}

function sectionRange(markdown) {
	const start = markdown.indexOf(`${SECTION_HEADING}\n`);
	if (start < 0) return undefined;
	const next = markdown.indexOf("\n## ", start + SECTION_HEADING.length + 1);
	return { start, end: next < 0 ? markdown.length : next + 1 };
}

export function extractLearningContextDirections(markdown) {
	const range = sectionRange(markdown);
	return range ? markdown.slice(range.start, range.end).trimEnd() : undefined;
}

export function replaceLearningContextDirections(markdown, section) {
	const current = sectionRange(markdown);
	if (!current) throw new Error("SKILL.md has no Context Directions section.");
	return `${markdown.slice(0, current.start)}${section}\n\n${markdown.slice(current.end)}`;
}
