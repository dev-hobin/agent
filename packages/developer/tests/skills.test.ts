import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

import {
  availablePackageSkills,
  isWithinRoot,
  renderSkillMethod,
} from "../extensions/skills.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(packageRoot, "skills");
const expected = [
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

test("Pi's loaded skill metadata is the package leaf catalog", () => {
  const catalog = loadSkillsFromDir({ dir: skillsRoot, source: "@hobin/developer" }).skills;
  assert.deepEqual(catalog.map((skill) => skill.name).sort(), expected);
  assert.equal(catalog.some((skill) => skill.name === "develop"), false);
  for (const skill of catalog) {
    assert.ok(skill.description.length > 20);
    assert.ok(skill.filePath.endsWith("SKILL.md"));
  }
});

test("every skill defines an inspection surface suited to its judgment", async () => {
  const expectedSurfaces: Record<string, RegExp> = {
    "abstraction-review": /review card or table/,
    "adversarial-eval": /escalation ladder as an ordered matrix/,
    model: /case, decision, or truth table/,
    "naming-judgment": /rename map as the primary inspection surface/,
    schedule: /compact timing matrix/,
    signal: /Make the comparison visible/,
    sketch: /compact case\/check table[\s\S]*wished-interface table[\s\S]*ASCII flow/,
    specify: /scope table separating in scope/,
    verify: /evidence matrix as the primary surface/,
    visualize: /render the completed table, ASCII\/Mermaid diagram/,
  };

  for (const [name, expectedSurface] of Object.entries(expectedSurfaces)) {
    const source = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
    assert.match(source, expectedSurface, `${name} should expose an inspectable output surface`);
  }
});

test("inherits Pi's recursive discovery, YAML parsing, and directory-name policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "developer-skills-"));
  const nested = join(root, "group", "directory-name-can-differ");
  await mkdir(nested, { recursive: true });
  await writeFile(
    join(nested, "SKILL.md"),
    "---\nname: actual-name\ndescription: >-\n  Folded description from Pi.\n---\n\n# Actual\n\nKeep this body.\n",
  );

  const catalog = loadSkillsFromDir({ dir: root, source: "test" }).skills;
  const actual = catalog.find((skill) => skill.name === "actual-name")!;
  assert.equal(actual.description, "Folded description from Pi.");
  const rendered = await renderSkillMethod(actual);
  assert.match(rendered, /location=".*SKILL\.md"/);
  assert.match(rendered, /base-dir=".*directory-name-can-differ"/);
  assert.match(rendered, /# Actual\n\nKeep this body\./);
});

test("routes only Pi-loaded, model-invocable leaves from this package", () => {
  const specify = loadSkillsFromDir({ dir: skillsRoot, source: "@hobin/developer" }).skills.find(
    (skill) => skill.name === "specify",
  )!;
  const external = {
    ...specify,
    filePath: "/outside/specify/SKILL.md",
    baseDir: "/outside/specify",
  };

  assert.deepEqual([...availablePackageSkills([external], skillsRoot).keys()], []);
  assert.deepEqual(
    [...availablePackageSkills([{ ...specify, disableModelInvocation: true }], skillsRoot).keys()],
    [],
  );
  assert.deepEqual([...availablePackageSkills([specify], skillsRoot).keys()], ["specify"]);
});

test("canonical path checks reject a skill symlink that escapes the package root", async () => {
  const root = await mkdtemp(join(tmpdir(), "developer-skill-root-"));
  const outside = await mkdtemp(join(tmpdir(), "developer-skill-outside-"));
  const outsideFile = join(outside, "SKILL.md");
  const linkedFile = join(root, "SKILL.md");
  await writeFile(outsideFile, "outside");
  await symlink(outsideFile, linkedFile);

  assert.equal(isWithinRoot(root, linkedFile), false);
});

test("rejects a forced leaf body that would exceed Pi's tool-output limit", async () => {
  const root = await mkdtemp(join(tmpdir(), "developer-large-skill-"));
  const skillDir = join(root, "large");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    `---\nname: large\ndescription: Large test skill.\n---\n\n# Large\n\n${"x".repeat(60_000)}`,
  );

  const skill = loadSkillsFromDir({ dir: root, source: "test" }).skills[0]!;
  await assert.rejects(renderSkillMethod(skill), /too large for safe forced loading/);
});
