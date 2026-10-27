import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = fileURLToPath(new URL("..", import.meta.url));
let manifest;
try {
	manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
} catch (error) {
	throw new Error("Invalid Learning package manifest", { cause: error });
}
assert.deepEqual(manifest.pi, {
	extensions: ["./adapters/pi/learning.ts"], skills: ["./skills"],
});
const entries = await readdir(join(root, "skills"), { withFileTypes: true });
const expectedSkills = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const loaded = loadSkillsFromDir({ dir: join(root, "skills"), source: "@hobin/learning" });
assert.deepEqual(loaded.diagnostics, []);
assert.deepEqual(loaded.skills.map((skill) => skill.name).sort(), expectedSkills);

const extension = await readFile(join(root, "adapters/pi/learning.ts"), "utf8");
assert.match(extension, /registerCommand\("learning"/);
assert.doesNotMatch(extension, /registerTool|validate_learning_artifact/);
const tui = await readFile(join(root, "adapters/pi/tui.ts"), "utf8");
assert.match(tui, /SelectList/);
assert.match(tui, /LEARNING_SKILL_NAMES/);
assert.match(tui, /showLearningSkillSelector/);
assert.match(tui, /prepareLearningSkill/);
assert.doesNotMatch(tui, /LEARNING_ROUTES|LearningRoute|parseLearningAction|prepareLearningAction/u);
assert.match(tui, /setEditorText/);
assert.doesNotMatch(tui, /validate_learning_artifact|value:\s*"validate"|Validate a saved artifact/);
const evalScript = await readFile(join(root, "scripts/eval-rpc.mjs"), "utf8");
assert.match(evalScript, /"skill:technical-reading"/);
assert.doesNotMatch(evalScript, /validate_learning_artifact/);
assert.match(evalScript, /LEARNING_EVAL_PACKAGE_PATH/);
assert.doesNotMatch(evalScript, /node:readline/);
console.log("learning optional Pi discovery, chooser, and evaluation wiring are consistent");
