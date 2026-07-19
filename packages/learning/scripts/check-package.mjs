import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSkills = [
  "conceptualize",
  "exercise",
  "opensource-reading",
  "patternize",
  "technical-reading",
];

const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(manifest.name, "@hobin/learning");
assert.equal(manifest.version, "0.1.0");
assert.deepEqual(manifest.files, ["extensions", "references", "skills", "README.md", "LICENSE"]);
assert.deepEqual(manifest.pi.extensions, ["./extensions/learning.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.equal(manifest.dependencies.yaml, "^2.9.0");
assert.deepEqual(manifest.peerDependencies, {
  "@earendil-works/pi-coding-agent": "*",
  "@earendil-works/pi-tui": "*",
  typebox: "*",
});

const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const skills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(skills, expectedSkills);

const loaded = loadSkillsFromDir({ dir: join(root, "skills"), source: "@hobin/learning" });
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(loaded.skills.map((skill) => skill.name).sort(), expectedSkills);

const codexSyntax = /\$learning:|\$(?:technical-reading|opensource-reading|conceptualize|patternize|exercise)|learning:(?:technical-reading|opensource-reading|conceptualize|patternize|exercise)/;

for (const name of skills) {
  const skillRoot = join(root, "skills", name);
  const source = await readFile(join(skillRoot, "SKILL.md"), "utf8");
  assert.match(source, new RegExp("^---\\nname: " + name + "(?:\\n|$)", "m"));
  assert.match(source, /^description:/m);
  assert.doesNotMatch(source, codexSyntax);

  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(frontmatterMatch, "Expected skill frontmatter: " + name);
  const frontmatter = parse(frontmatterMatch[1]);
  assert.equal(frontmatter.name, name);
  assert.equal(typeof frontmatter.description, "string");
  assert.ok(frontmatter.description.length > 0, "Description is missing: " + name);
  assert.ok(frontmatter.description.length <= 1024, "Description is too long: " + name);
  assert.doesNotMatch(frontmatter.description, /\bskip\b/i);

  const children = await readdir(skillRoot, { withFileTypes: true });
  assert.equal(children.some((entry) => entry.name === "agents"), false);
}

const requiredReferences = [
  "references/graph-artifact-standard.md",
  "references/skill-boundaries.md",
  "skills/conceptualize/references/concept-artifacts.md",
  "skills/exercise/references/exercise-patterns.md",
  "skills/exercise/references/workbook-design.md",
  "skills/opensource-reading/references/repository-lenses.md",
  "skills/patternize/references/pattern-foundations.md",
  "skills/technical-reading/references/artifact-writing.md",
  "skills/technical-reading/references/book-continuity.md",
  "skills/technical-reading/references/lens-library.md",
];

for (const path of requiredReferences) {
  const source = await readFile(join(root, path), "utf8");
  assert.ok(source.length > 0, "Expected non-empty reference: " + path);
}

const markdownDocuments = [
  ...skills.map((name) => `skills/${name}/SKILL.md`),
  ...requiredReferences,
];
for (const documentPath of markdownDocuments) {
  const absoluteDocumentPath = join(root, documentPath);
  const source = await readFile(absoluteDocumentPath, "utf8");
  for (const match of source.matchAll(/\]\(([^)]+\.md)\)/g)) {
    await readFile(join(dirname(absoluteDocumentPath), match[1]), "utf8");
  }
}

assert.match(await readFile(join(root, "LICENSE"), "utf8"), /^MIT License$/m);

const extension = await readFile(join(root, "extensions", "learning.ts"), "utf8");
assert.match(extension, /name: "validate_learning_artifact"/);
assert.match(extension, /truncateHead/);
assert.match(extension, /throw new Error/);
assert.match(extension, /renderCall/);
assert.match(extension, /renderResult/);
assert.match(extension, /keyHint/);
assert.match(extension, /registerCommand\("learning"/);
assert.doesNotMatch(extension, /isError\s*:/);
assert.doesNotMatch(extension, /executionMode\s*:/);

const tui = await readFile(join(root, "extensions", "tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /showLearningActionSelector/);
assert.match(tui, /prepareLearningAction/);
assert.match(tui, /setEditorText/);

const validator = await readFile(join(root, "extensions", "artifact-validator.ts"), "utf8");
assert.match(validator, /export function validateLearningArtifact/);

const evalScript = await readFile(join(root, "scripts", "eval-rpc.mjs"), "utf8");
assert.match(evalScript, /"skill:technical-reading"/);
assert.match(evalScript, /"validate_learning_artifact"/);
assert.match(evalScript, /LEARNING_EVAL_PACKAGE_PATH/);
assert.doesNotMatch(evalScript, /node:readline/);

console.log("learning package structure is consistent");
