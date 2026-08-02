import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const textExtensions = new Set([
	".json",
	".md",
	".mjs",
	".ts",
	".yaml",
	".yml",
]);
const packagePolicies = [
	{
		directory: "developer",
		forbidden: [
			"@hobin/learning",
			"@hobin/observer",
			"observer_sidecar",
			"validate_learning_artifact",
			"technical-reading",
			"opensource-reading",
			"conceptualize",
			"patternize",
		],
	},
	{
		directory: "learning",
		forbidden: [
			"@hobin/developer",
			"@hobin/observer",
			"developer_route_question",
			"observer_sidecar",
		],
	},
	{
		directory: "observer",
		forbidden: [
			"@hobin/developer",
			"@hobin/learning",
			"developer_route_question",
			"validate_learning_artifact",
			"technical-reading",
			"opensource-reading",
			"conceptualize",
			"patternize",
		],
	},
	{
		directory: "judgment",
		forbidden: [
			"@hobin/developer",
			"@hobin/learning",
			"@hobin/observer",
			"developer_route_question",
			"observer_sidecar",
			"validate_learning_artifact",
			"technical-reading",
			"opensource-reading",
			"conceptualize",
			"patternize",
		],
	},
];

async function* textFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			yield* textFiles(path);
			continue;
		}
		if (entry.isFile() && textExtensions.has(extname(entry.name))) yield path;
	}
}

const violations = [];
for (const policy of packagePolicies) {
	const packageRoot = join(root, "packages", policy.directory);
	for await (const path of textFiles(packageRoot)) {
		const source = await readFile(path, "utf8");
		for (const token of policy.forbidden) {
			if (source.includes(token)) {
				violations.push({
					package: policy.directory,
					path: relative(root, path),
					token,
				});
			}
		}
	}
}

const judgmentCoreRoot = join(root, "packages", "judgment", "src");
for await (const path of textFiles(judgmentCoreRoot)) {
	const source = await readFile(path, "utf8");
	if (source.includes("@earendil-works/pi-")) {
		violations.push({
			package: "judgment",
			path: relative(root, path),
			token: "@earendil-works/pi-* in the package-neutral core",
		});
	}
}

if (violations.length > 0) {
	const details = violations
		.map(
			(violation) =>
				`${violation.package}: ${violation.path} references forbidden sibling surface ${JSON.stringify(violation.token)}`,
		)
		.join("\n");
	throw new Error(`Package isolation check failed:\n${details}`);
}

process.stdout.write("package isolation is consistent\n");
