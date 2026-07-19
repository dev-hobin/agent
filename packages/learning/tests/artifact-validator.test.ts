import assert from "node:assert/strict";
import test from "node:test";

import { validateLearningArtifact } from "../extensions/artifact-validator.ts";

test("accepts a graph-shaped concept artifact", () => {
  const result = validateLearningArtifact(
    `---
"@context": context.jsonld
id: concept/evidence-boundary
type:
  - Concept
  - Atomic
prefLabel: Evidence Boundary
inScheme: concept-scheme/learning
status: active
sourceIndependent: true
source:
  - ../concept-updates/2026-07-19-evidence.md
uses:
  - concept/verification
---

# Evidence Boundary
`,
    "/archive/concepts/evidence-boundary.md",
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.artifact?.family, "Concept");
});

test("rejects namespace, family, status, boolean, and relation-shape mismatches", () => {
  const result = validateLearningArtifact(
    `---
"@context": ../concepts/context.jsonld
id: concept/not-a-pattern
type: Workflow
prefLabel: Broken Pattern
inScheme: archive/main
status: stable
sourceIndependent: "yes"
source: []
uses:
  target: concept/example
---
`,
    "/archive/patterns/broken.md",
  );

  assert.equal(result.valid, false);
  const codes = new Set(result.errors.map((entry) => entry.code));
  assert.ok(codes.has("id.folder"));
  assert.ok(codes.has("type.family"));
  assert.ok(codes.has("status.value"));
  assert.ok(codes.has("sourceIndependent.type"));
  assert.ok(codes.has("relation.shape"));
  assert.ok(codes.has("inScheme.namespace"));
});

test("requires concept updates to remain source-bound", () => {
  const result = validateLearningArtifact(
    `---
"@context": ../concepts/context.jsonld
id: concept-update/2026-07-19-example
type: ConceptUpdate
prefLabel: Example Concept Update
inScheme: concept-scheme/learning
status: active
sourceIndependent: true
source: books/example.md
---
`,
    "/archive/concept-updates/2026-07-19-example.md",
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === "sourceIndependent.update"));
});

test("accepts a concept scheme structure note under concepts", () => {
  const result = validateLearningArtifact(
    `---
"@context": context.jsonld
id: concept-scheme/learning
type:
  - ConceptScheme
  - Structure
prefLabel: Learning Concept Structure
inScheme: concept-scheme/learning
status: active
sourceIndependent: true
source:
  - concept/evidence-boundary
---
`,
    "/archive/concepts/README.md",
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.artifact?.family, "ConceptScheme");
});

test("accepts a workflow pattern linked to the shared concept graph", () => {
  const result = validateLearningArtifact(
    `---
"@context": ../concepts/context.jsonld
id: pattern/evidence-to-check
type:
  - Pattern
  - Workflow
prefLabel: Evidence To Check
inScheme: concept-scheme/learning
status: draft
sourceIndependent: true
source:
  - open-source/example.md
uses:
  - concept/evidence-boundary
checks:
  - concept/verification
---
`,
    "/archive/patterns/evidence-to-check.md",
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.artifact?.family, "Pattern");
});

test("reports nested relations as a warning without changing structural validity", () => {
  const result = validateLearningArtifact(
    `---
"@context": context.jsonld
id: concept/edge-shape
type:
  - Concept
  - Atomic
prefLabel: Edge Shape
inScheme: concept-scheme/learning
status: draft
sourceIndependent: true
source: books/example.md
relations:
  - uses: concept/verification
---
`,
    "/archive/concepts/edge-shape.md",
  );

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((entry) => entry.code === "relations.nested"));
});

test("rejects missing or malformed frontmatter", () => {
  assert.equal(validateLearningArtifact("# No metadata").valid, false);
  const malformed = validateLearningArtifact("---\nid: [broken\n---\n");
  assert.equal(malformed.valid, false);
  assert.equal(malformed.errors[0]?.code, "frontmatter.yaml");
});

test("does not claim an undefined graph schema for standalone diagnostics or exercises", () => {
  for (const id of ["diagnostic/example", "exercise/example"]) {
    const result = validateLearningArtifact(
      `---
"@context": ../concepts/context.jsonld
id: ${id}
type: Example
prefLabel: Example
inScheme: concept-scheme/learning
status: draft
sourceIndependent: true
source: books/example.md
---
`,
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((entry) => entry.code === "id.namespace"));
  }
});
