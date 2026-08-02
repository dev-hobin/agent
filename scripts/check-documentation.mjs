import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageNames = ["judgment", "developer", "learning", "observer"];

async function markdownNames(directory) {
	return (await readdir(directory, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => entry.name)
		.sort();
}

const pairs = [{ english: "README.md", korean: "README.ko.md" }];
for (const packageName of packageNames) {
	const packageRoot = join(root, "packages", packageName);
	const englishNames = await markdownNames(join(packageRoot, "docs"));
	const koreanNames = await markdownNames(join(packageRoot, "docs", "ko"));
	assert.deepEqual(
		koreanNames,
		englishNames,
		`${packageName} English and Korean documentation files must match.`,
	);
	pairs.push({
		english: `packages/${packageName}/README.md`,
		korean: `packages/${packageName}/README.ko.md`,
	});
	for (const name of englishNames) {
		pairs.push({
			english: `packages/${packageName}/docs/${name}`,
			korean: `packages/${packageName}/docs/ko/${name}`,
		});
	}
}

async function checkLocalLinks(relativePath, source) {
	for (const match of source.matchAll(/\]\(([^)]+)\)/gu)) {
		const href = match[1];
		if (/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(href)) continue;
		const target = decodeURI(href.split("#", 1)[0] ?? "");
		if (!target) continue;
		await access(resolve(dirname(join(root, relativePath)), target));
	}
}

function count(source, pattern) {
	return [...source.matchAll(pattern)].length;
}

for (const pair of pairs) {
	const [english, korean] = await Promise.all([
		readFile(join(root, pair.english), "utf8"),
		readFile(join(root, pair.korean), "utf8"),
	]);
	assert.match(
		english,
		/^# .+\n\nEnglish \| \[한국어\]\([^\n]+\)/u,
		`Missing English-to-Korean language switch: ${pair.english}`,
	);
	assert.match(
		korean,
		/^# .+\n\n\[English\]\([^\n]+\) \| 한국어/u,
		`Missing Korean-to-English language switch: ${pair.korean}`,
	);
	for (const [label, pattern] of [
		["code fences", /^```/gmu],
		["Mermaid diagrams", /^```mermaid$/gmu],
	]) {
		assert.equal(
			count(korean, pattern),
			count(english, pattern),
			`${label} must match between ${pair.english} and ${pair.korean}.`,
		);
	}
	await Promise.all([
		checkLocalLinks(pair.english, english),
		checkLocalLinks(pair.korean, korean),
	]);
}

process.stdout.write(
	`documentation locale parity and local links are consistent for ${pairs.length} pairs\n`,
);
