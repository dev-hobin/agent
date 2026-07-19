import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSkills = [
  "abstraction-review",
  "adversarial-eval",
  "model",
  "naming-judgment",
  "schedule",
  "signal",
  "sketch",
  "specify",
  "verify",
  "visualize",
];

const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.equal(manifest.name, "@hobin/developer");
assert.equal(manifest.version, "0.1.1");
assert.deepEqual(manifest.pi.extensions, ["./extensions/developer.ts"]);
assert.deepEqual(manifest.pi.skills, ["./skills"]);
assert.deepEqual(manifest.files, ["extensions", "skills", "README.md", "LICENSE"]);
for (const dependency of [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
]) {
  assert.equal(manifest.peerDependencies[dependency], "*");
}

const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const skills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(skills, expectedSkills);
assert.equal(skills.includes("develop"), false);

const loaded = loadSkillsFromDir({ dir: join(root, "skills"), source: "@hobin/developer" });
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(loaded.skills.map((skill) => skill.name).sort(), expectedSkills);

for (const name of skills) {
  const source = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
  assert.match(source, new RegExp("^---\\nname: " + name + "\\n", "m"));
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.doesNotMatch(frontmatter, /\bskip\b/i);
  assert.match(source, /^Status: resolved \| needs-evidence \| not-applicable \| blocked$/m);
  assert.doesNotMatch(source, /Codex|developer-toolbox|openai\.yaml/);
}

const requiredReferences = [
  "skills/abstraction-review/references/field-card.md",
  "skills/abstraction-review/references/recipe-cards.md",
  "skills/abstraction-review/references/repair-table.md",
  "skills/abstraction-review/references/worked-examples.md",
  "skills/model/references/problem-modeling.md",
  "skills/naming-judgment/references/elements-of-clojure-naming.md",
  "skills/schedule/references/structural-change-timing.md",
  "skills/signal/references/flocking-and-structural-movement.md",
  "skills/sketch/references/design-recipe-and-abstraction-barriers.md",
  "skills/verify/references/verifier-selection-and-pass-but-wrong.md",
];

const referenceRoutes = {
  "abstraction-review": [
    "references/field-card.md",
    "references/recipe-cards.md",
    "references/repair-table.md",
    "references/worked-examples.md",
  ],
  model: ["references/problem-modeling.md"],
  "naming-judgment": ["references/elements-of-clojure-naming.md"],
  schedule: ["references/structural-change-timing.md"],
  signal: ["references/flocking-and-structural-movement.md"],
  sketch: ["references/design-recipe-and-abstraction-barriers.md"],
  verify: ["references/verifier-selection-and-pass-but-wrong.md"],
};

for (const [name, routes] of Object.entries(referenceRoutes)) {
  const source = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
  for (const route of routes) {
    assert.ok(source.includes(`](${route})`), `Expected ${name} to route ${route}`);
  }
}

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
    if (/^[a-z][a-z0-9+.-]*:/i.test(match[1])) continue;
    await readFile(join(dirname(absoluteDocumentPath), match[1]), "utf8");
  }
}

const extension = await readFile(join(root, "extensions", "developer.ts"), "utf8");
assert.match(extension, /name: ROUTE_TOOL/);
assert.match(extension, /name: JUDGMENT_TOOL/);
assert.match(extension, /registerCommand\("develop"/);
assert.match(extension, /getArgumentCompletions/);
assert.match(extension, /ctx\.ui\.confirm/);
assert.doesNotMatch(extension, /developer\.snapshot|acceptedContract|verifiedClaims|completionState/);
assert.doesNotMatch(extension, /isError\s*:/);

const tui = await readFile(join(root, "extensions", "tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /DeveloperStatusPanel/);
assert.match(tui, /showPendingQuestionSelector/);
assert.match(tui, /overlay:\s*true/);

const state = await readFile(join(root, "extensions", "state.ts"), "utf8");
assert.match(state, /developer\/v2/);
assert.match(state, /pendingQuestions/);
assert.doesNotMatch(state, /acceptedContract|verifiedClaims/);

console.log("developer package structure is consistent");
