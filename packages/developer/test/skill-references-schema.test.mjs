import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const skillsRoot = join(packageRoot, "skills");
const schemaPath = join(
	repositoryRoot,
	"schemas/skill-references-v0.1.schema.json",
);

test("bundled Skill References satisfy the retained schema and reference existing files", async () => {
	const schema = JSON.parse(await readFile(schemaPath, "utf8"));
	const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
	const skillEntries = await readdir(skillsRoot, { withFileTypes: true });
	const referencesPaths = [];

	for (const entry of skillEntries) {
		if (!entry.isDirectory()) continue;
		const referencesPath = join(skillsRoot, entry.name, "references.json");
		try {
			await access(referencesPath);
			referencesPaths.push(referencesPath);
		} catch {
			continue;
		}
	}

	assert.equal(referencesPaths.length, 13);
	for (const referencesPath of referencesPaths) {
		const skillReferences = JSON.parse(
			await readFile(referencesPath, "utf8"),
		);
		assert.equal(
			validate(skillReferences),
			true,
			`${referencesPath}: ${JSON.stringify(validate.errors)}`,
		);
		for (const reference of skillReferences.references) {
			await access(join(dirname(referencesPath), reference.path));
		}
	}
});
