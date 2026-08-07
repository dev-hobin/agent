// src/action-loop/identity/hash-identity.ts
import { createHash } from "node:crypto";
function sha256Bytes(bytes) {
  return `sha256_${createHash("sha256").update(bytes).digest("hex")}`;
}
function hashIdentity(prefix, domain, parts) {
  const hash = createHash("sha256");
  for (const part of [domain, ...parts]) {
    const bytes = typeof part === "string" ? Buffer.from(part, "utf8") : part;
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(bytes.byteLength));
    hash.update(length);
    hash.update(bytes);
  }
  return `${prefix}_${hash.digest("hex")}`;
}

// src/action-loop/routing/bind-capability.ts
var CAPABILITY_ID_VERSION = "developer-capability/v1";
var CAPABILITY_REVISION_VERSION = "developer-capability-revision/v1";
var SOURCE_KINDS = /* @__PURE__ */ new Set([
  "package",
  "global",
  "project",
  "settings",
  "cli"
]);
function failure(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function isCanonicalLocator(locator) {
  return locator.length > 0 && locator === locator.trim() && !locator.includes("\0");
}
function isNormalizedSkillRoot(root) {
  if (root === ".") return true;
  if (root.length === 0 || root !== root.trim() || root.startsWith("/") || /^[A-Za-z]:/.test(root) || root.includes("\\") || root.includes("\0")) {
    return false;
  }
  return root.split("/").every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".."
  );
}
function bindSourceIdentity(source) {
  if (!SOURCE_KINDS.has(source.kind)) {
    return failure(
      "unsupported-source-kind",
      "source.kind",
      `Unsupported Capability source kind ${source.kind}`
    );
  }
  if (!isCanonicalLocator(source.locator)) {
    return failure(
      "invalid-source-locator",
      "source.locator",
      "Capability source locator must be a nonblank canonical value"
    );
  }
  if (!isNormalizedSkillRoot(source.skillRoot)) {
    return failure(
      "invalid-skill-root",
      "source.skillRoot",
      "Skill root must be '.' or a normalized relative POSIX path"
    );
  }
  const boundSource = Object.freeze({
    kind: source.kind,
    locator: source.locator,
    skillRoot: source.skillRoot
  });
  return {
    ok: true,
    value: {
      source: boundSource,
      capabilityId: hashIdentity("cap", CAPABILITY_ID_VERSION, [
        boundSource.kind,
        boundSource.locator,
        boundSource.skillRoot
      ])
    }
  };
}
function canonicalTocBytes(toc) {
  return Buffer.from(
    JSON.stringify({
      schema: toc.schema,
      when: toc.when,
      unless: toc.unless,
      references: toc.references.map((reference) => ({
        path: reference.path,
        when: reference.when
      }))
    }),
    "utf8"
  );
}
function bindCapability(source, toc, skillBytes) {
  const sourceIdentity = bindSourceIdentity(source);
  if (!sourceIdentity.ok) return sourceIdentity;
  const { capabilityId, source: boundSource } = sourceIdentity.value;
  const skillHash = sha256Bytes(skillBytes);
  const tocHash = sha256Bytes(canonicalTocBytes(toc));
  const capabilityRevisionId = hashIdentity(
    "caprev",
    CAPABILITY_REVISION_VERSION,
    [capabilityId, skillHash, tocHash]
  );
  return {
    ok: true,
    value: Object.freeze({
      capabilityId,
      capabilityRevisionId,
      skillHash,
      tocHash,
      source: boundSource,
      toc
    })
  };
}

// src/action-loop/routing/parse-toc.ts
var SKILL_TOC_SCHEMA_URI = "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json";
var MAX_TOC_BYTES = 64 * 1024;
function failure2(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkFields(value, path, allowed, required) {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      return failure2(
        "unknown-field",
        path === "$" ? `$.${field}` : `${path}.${field}`,
        `Unknown field ${field}`
      );
    }
  }
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      return failure2(
        "missing-field",
        path === "$" ? `$.${field}` : `${path}.${field}`,
        `Missing required field ${field}`
      );
    }
  }
  return void 0;
}
function parseConditions(value, path) {
  if (!Array.isArray(value)) {
    return failure2("expected-array", path, "Expected an array of conditions");
  }
  if (value.length === 0) {
    return failure2("empty-list", path, "Expected at least one condition");
  }
  const conditions = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < value.length; index += 1) {
    const condition = value[index];
    const conditionPath = `${path}[${index}]`;
    if (typeof condition !== "string") {
      return failure2(
        "expected-string",
        conditionPath,
        "Expected a condition string"
      );
    }
    const normalized = condition.trim();
    if (normalized.length === 0) {
      return failure2(
        "empty-string",
        conditionPath,
        "Condition must not be blank"
      );
    }
    if (seen.has(normalized)) {
      return failure2(
        "duplicate-value",
        conditionPath,
        "Condition duplicates an earlier normalized value"
      );
    }
    seen.add(normalized);
    conditions.push(normalized);
  }
  return { ok: true, value: Object.freeze(conditions) };
}
function isNormalizedReferencePath(path) {
  if (path.length === 0 || path !== path.trim() || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.includes("\\") || path.includes("\0")) {
    return false;
  }
  const segments = path.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".."
  );
}
function parseReference(value, index) {
  const path = `$.references[${index}]`;
  if (!isObject(value)) {
    return failure2("expected-object", path, "Expected a Reference object");
  }
  const fieldFailure = checkFields(
    value,
    path,
    ["path", "when"],
    ["path", "when"]
  );
  if (fieldFailure !== void 0) return fieldFailure;
  if (typeof value.path !== "string") {
    return failure2(
      "expected-string",
      `${path}.path`,
      "Expected a Reference path string"
    );
  }
  if (!isNormalizedReferencePath(value.path)) {
    return failure2(
      "invalid-reference-path",
      `${path}.path`,
      "Reference path must be a normalized relative POSIX path"
    );
  }
  const when = parseConditions(value.when, `${path}.when`);
  if (!when.ok) return when;
  return {
    ok: true,
    value: Object.freeze({ path: value.path, when: when.value })
  };
}
function parseReferences(value) {
  if (!Array.isArray(value)) {
    return failure2(
      "expected-array",
      "$.references",
      "Expected an array of References"
    );
  }
  const references = [];
  const paths = /* @__PURE__ */ new Set();
  for (let index = 0; index < value.length; index += 1) {
    const reference = parseReference(value[index], index);
    if (!reference.ok) return reference;
    if (paths.has(reference.value.path)) {
      return failure2(
        "duplicate-reference",
        `$.references[${index}].path`,
        "Reference path duplicates an earlier declaration"
      );
    }
    paths.add(reference.value.path);
    references.push(reference.value);
  }
  return { ok: true, value: Object.freeze(references) };
}
function parseRoot(value) {
  if (!isObject(value)) {
    return failure2("expected-object", "$", "Expected a TOC object");
  }
  const fieldFailure = checkFields(
    value,
    "$",
    ["$schema", "when", "unless", "references"],
    ["$schema", "when", "unless", "references"]
  );
  if (fieldFailure !== void 0) return fieldFailure;
  if (value.$schema !== SKILL_TOC_SCHEMA_URI) {
    return failure2(
      "schema-mismatch",
      "$.$schema",
      `Expected schema ${SKILL_TOC_SCHEMA_URI}`
    );
  }
  const when = parseConditions(value.when, "$.when");
  if (!when.ok) return when;
  const unless = parseConditions(value.unless, "$.unless");
  if (!unless.ok) return unless;
  const references = parseReferences(value.references);
  if (!references.ok) return references;
  return {
    ok: true,
    value: Object.freeze({
      schema: SKILL_TOC_SCHEMA_URI,
      when: when.value,
      unless: unless.value,
      references: references.value
    })
  };
}
function parseTocBytes(bytes) {
  if (bytes.byteLength > MAX_TOC_BYTES) {
    return failure2("too-large", "$", `TOC exceeds ${MAX_TOC_BYTES} bytes`);
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return failure2("invalid-utf8", "$", "TOC must be valid UTF-8");
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return failure2("invalid-json", "$", "TOC must be valid JSON");
  }
  return parseRoot(value);
}

// src/action-loop/sdk/capability-routing-controller.ts
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

// src/action-loop/routing/accept-applicability.ts
var CAPABILITY_ASSIGNMENT_VERSION = "developer-capability-assignment/v1";
var APPLICABILITY_STATUSES = /* @__PURE__ */ new Set([
  "applicable",
  "not-applicable",
  "needs-context"
]);
function invalid(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId(id) {
  return id.length > 0 && id === id.trim() && !id.includes("\0");
}
function normalizeList(values, path, emptyCode) {
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]?.trim() ?? "";
    if (value.length === 0) {
      return {
        ok: false,
        error: {
          code: emptyCode,
          path: `${path}[${index}]`,
          message: "Expected a nonblank value"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Value duplicates an earlier normalized value"
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalMatches(proposed, declared, path, referenceOnly = []) {
  const normalized = normalizeList(proposed, path, "empty-context-item");
  if (!normalized.ok) return normalized;
  const proposedSet = new Set(normalized.value);
  for (const condition of proposedSet) {
    if (!declared.includes(condition)) {
      const exactConditions = declared.length > 0 ? declared.join(" | ") : "none";
      const message = referenceOnly.includes(condition) ? `Condition belongs to Reference selection, not Capability applicability: ${condition}. Use it only when selecting References. Exact Capability conditions for ${path}: ${exactConditions}` : `Condition is not declared by the Capability: ${condition}. Exact Capability conditions for ${path}: ${exactConditions}`;
      return {
        ok: false,
        error: {
          code: "undeclared-condition",
          path,
          message
        }
      };
    }
  }
  return {
    ok: true,
    value: Object.freeze(
      declared.filter((condition) => proposedSet.has(condition))
    )
  };
}
function isStructuredCapability(capability) {
  return "toc" in capability;
}
function checkTarget(target) {
  for (const [path, id] of [
    ["target.workCaseId", target.workCaseId],
    ["target.judgmentId", target.judgmentId],
    ["target.contributionNeedId", target.contributionNeedId]
  ]) {
    if (!validId(id)) {
      return invalid(
        "invalid-target-id",
        path,
        "Expected a canonical target ID"
      );
    }
  }
  return void 0;
}
function checkIdentity(target, proposal) {
  for (const [path, actual, expected] of [
    ["proposal.workCaseId", proposal.workCaseId, target.workCaseId],
    ["proposal.judgmentId", proposal.judgmentId, target.judgmentId],
    [
      "proposal.contributionNeedId",
      proposal.contributionNeedId,
      target.contributionNeedId
    ],
    [
      "proposal.capabilityRevisionId",
      proposal.capabilityRevisionId,
      target.capability.capabilityRevisionId
    ]
  ]) {
    if (actual !== expected) {
      return invalid(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
function assessStatus(proposal, matchedWhen, matchedUnless, missingContext, requiresWhenMatch) {
  if (!APPLICABILITY_STATUSES.has(proposal.status)) {
    return invalid(
      "unsupported-status",
      "proposal.status",
      `Unsupported applicability status ${proposal.status}`
    );
  }
  if (proposal.status !== "needs-context" && missingContext.length > 0) {
    return invalid(
      "unexpected-missing-context",
      "proposal.missingContext",
      "Only needs-context may carry missing context"
    );
  }
  if (proposal.status === "applicable") {
    if (requiresWhenMatch && matchedWhen.length === 0) {
      return invalid(
        "applicable-without-when",
        "proposal.matchedWhen",
        "Structured applicability requires at least one declared when match"
      );
    }
    if (matchedUnless.length > 0) {
      return invalid(
        "excluded-by-unless",
        "proposal.matchedUnless",
        "A matched unless condition overrides applicability"
      );
    }
    return void 0;
  }
  if (proposal.status === "not-applicable") {
    if (matchedWhen.length > 0 && matchedUnless.length === 0) {
      return invalid(
        "not-applicable-with-positive-match",
        "proposal.status",
        "A positive when match requires an excluding unless match"
      );
    }
    return void 0;
  }
  if (matchedUnless.length > 0) {
    return invalid(
      "decisive-unless-cannot-wait",
      "proposal.matchedUnless",
      "A matched unless condition is already not-applicable"
    );
  }
  if (missingContext.length === 0) {
    return invalid(
      "missing-context-required",
      "proposal.missingContext",
      "Needs-context requires at least one missing context item"
    );
  }
  return void 0;
}
function makeAssessment(target, proposal, evidence) {
  return Object.freeze({
    workCaseId: target.workCaseId,
    judgmentId: target.judgmentId,
    contributionNeedId: target.contributionNeedId,
    capabilityId: target.capability.capabilityId,
    capabilityRevisionId: target.capability.capabilityRevisionId,
    status: proposal.status,
    ...evidence
  });
}
function makeAssignment(assessment) {
  const assignmentId = hashIdentity("assign", CAPABILITY_ASSIGNMENT_VERSION, [
    assessment.workCaseId,
    assessment.judgmentId,
    assessment.contributionNeedId,
    assessment.capabilityRevisionId,
    ...assessment.matchedWhen,
    ...assessment.basis
  ]);
  return Object.freeze({
    assignmentId,
    workCaseId: assessment.workCaseId,
    judgmentId: assessment.judgmentId,
    contributionNeedId: assessment.contributionNeedId,
    capabilityId: assessment.capabilityId,
    capabilityRevisionId: assessment.capabilityRevisionId,
    applicabilityBasis: assessment.basis,
    matchedWhen: assessment.matchedWhen
  });
}
function acceptCapabilityApplicability(target, proposal) {
  const targetFailure = checkTarget(target);
  if (targetFailure !== void 0) return targetFailure;
  const identityFailure = checkIdentity(target, proposal);
  if (identityFailure !== void 0) return identityFailure;
  const structured = isStructuredCapability(target.capability);
  const referenceOnlyConditions = structured ? target.capability.toc.references.flatMap((reference) => reference.when) : [];
  const matchedWhen = canonicalMatches(
    proposal.matchedWhen,
    structured ? target.capability.toc.when : [],
    "proposal.matchedWhen",
    referenceOnlyConditions
  );
  if (!matchedWhen.ok) return { status: "invalid", error: matchedWhen.error };
  const matchedUnless = canonicalMatches(
    proposal.matchedUnless,
    structured ? target.capability.toc.unless : [],
    "proposal.matchedUnless",
    referenceOnlyConditions
  );
  if (!matchedUnless.ok)
    return { status: "invalid", error: matchedUnless.error };
  const basis = normalizeList(proposal.basis, "proposal.basis", "empty-basis");
  if (!basis.ok) return { status: "invalid", error: basis.error };
  if (basis.value.length === 0) {
    return invalid(
      "empty-basis",
      "proposal.basis",
      "Applicability assessment requires explicit basis"
    );
  }
  const missingContext = normalizeList(
    proposal.missingContext,
    "proposal.missingContext",
    "empty-context-item"
  );
  if (!missingContext.ok) {
    return { status: "invalid", error: missingContext.error };
  }
  const statusFailure = assessStatus(
    proposal,
    matchedWhen.value,
    matchedUnless.value,
    missingContext.value,
    structured
  );
  if (statusFailure !== void 0) return statusFailure;
  const assessment = makeAssessment(target, proposal, {
    matchedWhen: matchedWhen.value,
    matchedUnless: matchedUnless.value,
    basis: basis.value,
    missingContext: missingContext.value
  });
  if (assessment.status === "applicable") {
    return {
      status: "assigned",
      assessment,
      assignment: makeAssignment(assessment)
    };
  }
  return { status: assessment.status, assessment };
}

// src/action-loop/routing/bind-reference-selection.ts
var REFERENCE_SELECTION_VERSION = "developer-reference-selection/v1";
function failure3(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function checkAssignment(assignment, capability) {
  if (assignment.capabilityId !== capability.capabilityId) {
    return failure3(
      "assignment-capability-mismatch",
      "assignment.capabilityId",
      "Assignment belongs to another Capability"
    );
  }
  if (assignment.capabilityRevisionId !== capability.capabilityRevisionId) {
    return failure3(
      "assignment-capability-mismatch",
      "assignment.capabilityRevisionId",
      "Assignment belongs to another Capability revision"
    );
  }
  return void 0;
}
function copyDispositions(dispositions) {
  return Object.freeze(
    dispositions.map(
      (disposition) => Object.freeze({
        path: disposition.path,
        status: disposition.status,
        basis: Object.freeze([...disposition.basis])
      })
    )
  );
}
function checkDeclarations(capability, dispositions) {
  const declared = capability.toc.references;
  if (dispositions.length !== declared.length) {
    return failure3(
      "declaration-mismatch",
      "selection.dispositions",
      "Selection must disposition the current TOC Reference inventory"
    );
  }
  for (let index = 0; index < declared.length; index += 1) {
    if (dispositions[index]?.path !== declared[index]?.path) {
      return failure3(
        "declaration-mismatch",
        `selection.dispositions[${index}].path`,
        "Selection order and paths must match the current TOC"
      );
    }
  }
  return void 0;
}
function deriveSelection(dispositions) {
  const selectedPaths = [];
  const unresolved = [];
  for (const disposition of dispositions) {
    if (disposition.status === "selected") {
      selectedPaths.push(disposition.path);
    } else if (disposition.status === "needs-context") {
      unresolved.push(disposition);
    }
  }
  return {
    selectedPaths: Object.freeze(selectedPaths),
    unresolved: Object.freeze(unresolved)
  };
}
function sameStrings(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function checkSelectionState(selection, derived) {
  if (!sameStrings(selection.selectedPaths, derived.selectedPaths)) {
    return failure3(
      "selection-invariant-failed",
      "selection.selectedPaths",
      "Selected paths must be derived from ordered dispositions"
    );
  }
  if (selection.status === "ready" && derived.unresolved.length > 0) {
    return failure3(
      "selection-invariant-failed",
      "selection.status",
      "Ready selection cannot contain needs-context dispositions"
    );
  }
  if (selection.status === "needs-context" && derived.unresolved.length === 0) {
    return failure3(
      "selection-invariant-failed",
      "selection.status",
      "Needs-context selection requires an unresolved disposition"
    );
  }
  return void 0;
}
function identityParts(assignment, dispositions) {
  const parts = [assignment.assignmentId, assignment.capabilityRevisionId];
  for (const disposition of dispositions) {
    parts.push(
      "disposition",
      disposition.path,
      disposition.status,
      String(disposition.basis.length),
      ...disposition.basis
    );
  }
  return parts;
}
function bindReferenceSelection(assignment, capability, selection) {
  const assignmentFailure = checkAssignment(assignment, capability);
  if (assignmentFailure !== void 0) return assignmentFailure;
  if (selection.status === "invalid") {
    return failure3(
      "invalid-selection",
      "selection",
      "An invalid Reference selection cannot be bound"
    );
  }
  const declarationFailure = checkDeclarations(
    capability,
    selection.dispositions
  );
  if (declarationFailure !== void 0) return declarationFailure;
  const dispositions = copyDispositions(selection.dispositions);
  const derived = deriveSelection(dispositions);
  const stateFailure = checkSelectionState(selection, derived);
  if (stateFailure !== void 0) return stateFailure;
  const selectionId = hashIdentity(
    "selection",
    REFERENCE_SELECTION_VERSION,
    identityParts(assignment, dispositions)
  );
  return {
    ok: true,
    value: Object.freeze({
      status: selection.status,
      selectionId,
      assignmentId: assignment.assignmentId,
      capabilityRevisionId: capability.capabilityRevisionId,
      dispositions,
      selectedPaths: derived.selectedPaths,
      unresolved: derived.unresolved
    })
  };
}

// src/action-loop/routing/reference-selection.ts
function hasBasis(disposition) {
  return disposition.basis.length > 0 && disposition.basis.every((entry) => entry.trim().length > 0);
}
function indexDeclarations(declarations) {
  const paths = /* @__PURE__ */ new Set();
  const issues = [];
  for (const declaration of declarations) {
    if (paths.has(declaration.path)) {
      issues.push({ code: "duplicate-declaration", path: declaration.path });
    } else {
      paths.add(declaration.path);
    }
  }
  return { paths, issues };
}
function indexProposals(declaredPaths, proposals) {
  const byPath = /* @__PURE__ */ new Map();
  const issues = [];
  for (const proposal of proposals) {
    if (!declaredPaths.has(proposal.path)) {
      issues.push({ code: "undeclared-disposition", path: proposal.path });
    }
    if (byPath.has(proposal.path)) {
      issues.push({ code: "duplicate-disposition", path: proposal.path });
    } else {
      byPath.set(proposal.path, proposal);
    }
    if (!hasBasis(proposal)) {
      issues.push({ code: "empty-basis", path: proposal.path });
    }
  }
  return { byPath, issues };
}
function findMissingDispositions(declaredPaths, proposalsByPath) {
  const issues = [];
  for (const path of declaredPaths) {
    if (!proposalsByPath.has(path)) {
      issues.push({ code: "missing-disposition", path });
    }
  }
  return issues;
}
function orderDispositions(declarations, proposalsByPath) {
  return declarations.map((declaration) => {
    const disposition = proposalsByPath.get(declaration.path);
    if (disposition === void 0) {
      throw new Error(
        `Reference disposition invariant failed for ${declaration.path}`
      );
    }
    return {
      path: disposition.path,
      status: disposition.status,
      basis: [...disposition.basis]
    };
  });
}
function classifySelection(dispositions) {
  const selectedPaths = [];
  const unresolved = [];
  for (const disposition of dispositions) {
    if (disposition.status === "selected") {
      selectedPaths.push(disposition.path);
    } else if (disposition.status === "needs-context") {
      unresolved.push(disposition);
    }
  }
  if (unresolved.length > 0) {
    return {
      status: "needs-context",
      dispositions,
      selectedPaths,
      unresolved
    };
  }
  return { status: "ready", dispositions, selectedPaths };
}
function selectDeclaredReferences(declarations, proposals) {
  const declarationIndex = indexDeclarations(declarations);
  const proposalIndex = indexProposals(declarationIndex.paths, proposals);
  const issues = [
    ...declarationIndex.issues,
    ...proposalIndex.issues,
    ...findMissingDispositions(declarationIndex.paths, proposalIndex.byPath)
  ];
  if (issues.length > 0) {
    return { status: "invalid", issues };
  }
  return classifySelection(
    orderDispositions(declarations, proposalIndex.byPath)
  );
}

// src/action-loop/sdk/capability-routing-controller.ts
var applicabilityParameters = Type.Object(
  {
    status: StringEnum([
      "applicable",
      "not-applicable",
      "needs-context"
    ]),
    matches_when: Type.Boolean(),
    matches_unless: Type.Boolean(),
    basis: Type.String({ minLength: 1, maxLength: 2048 }),
    missing_context: Type.Optional(Type.String({ maxLength: 2048 }))
  },
  { additionalProperties: false }
);
var referenceStatuses = ["selected", "not-needed", "needs-context"];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApplicabilityStatus(value) {
  return value === "applicable" || value === "not-applicable" || value === "needs-context";
}
function isReferenceStatus(value) {
  return value === "selected" || value === "not-needed" || value === "needs-context";
}
function rejected(code, message) {
  return { status: "rejected", code, message };
}
function applicabilityTool(target, toc) {
  return {
    name: "submit_capability_applicability",
    label: "Submit capability applicability",
    description: "Submit one semantic applicability decision; the SDK controller supplies exact canonical conditions and identities.",
    parameters: applicabilityParameters,
    execute: async (raw) => {
      if (!isRecord(raw)) {
        return rejected(
          "invalid-arguments",
          "Applicability arguments must be an object."
        );
      }
      if (!isApplicabilityStatus(raw.status) || typeof raw.matches_when !== "boolean" || typeof raw.matches_unless !== "boolean" || typeof raw.basis !== "string" || raw.missing_context !== void 0 && typeof raw.missing_context !== "string") {
        return rejected(
          "invalid-arguments",
          "Applicability requires status, matches_when, matches_unless, basis, and optional missing_context with their declared scalar types."
        );
      }
      const missingContext = typeof raw.missing_context === "string" ? raw.missing_context.trim() : "";
      const result = acceptCapabilityApplicability(target, {
        workCaseId: target.workCaseId,
        judgmentId: target.judgmentId,
        contributionNeedId: target.contributionNeedId,
        capabilityRevisionId: target.capability.capabilityRevisionId,
        status: raw.status,
        matchedWhen: raw.matches_when ? toc.when : [],
        matchedUnless: raw.matches_unless ? toc.unless : [],
        basis: [raw.basis],
        missingContext: raw.status === "needs-context" && missingContext ? [missingContext] : []
      });
      if (result.status === "invalid") {
        return rejected(result.error.code, result.error.message);
      }
      return {
        status: "accepted",
        value: { result, basis: raw.basis },
        message: `Applicability accepted as ${result.status}.`,
        resultStatus: result.status
      };
    }
  };
}
function referenceParameters(toc) {
  const fields = {};
  for (const [index, reference] of toc.references.entries()) {
    fields[`status_${index}`] = StringEnum(referenceStatuses, {
      description: `${reference.path} \u2014 ${reference.when.join(" | ")}`
    });
    fields[`basis_${index}`] = Type.String({
      minLength: 1,
      maxLength: 2048,
      description: `Why ${reference.path} is selected, not needed, or needs context relative to every other declared Reference.`
    });
  }
  return Type.Object(fields, { additionalProperties: false });
}
function referenceTool(toc) {
  return {
    name: "submit_reference_dispositions",
    label: "Submit comparative Reference dispositions",
    description: "Disposition every declared Reference in one comparative proposal; the SDK controller maps flat fields to canonical paths.",
    parameters: referenceParameters(toc),
    execute: async (raw) => {
      if (!isRecord(raw)) {
        return rejected(
          "invalid-arguments",
          "Reference arguments must be an object."
        );
      }
      const dispositions = [];
      for (const [index, reference] of toc.references.entries()) {
        const status = raw[`status_${index}`];
        const basis = raw[`basis_${index}`];
        if (!isReferenceStatus(status) || typeof basis !== "string") {
          return rejected(
            "invalid-reference-disposition",
            `Reference disposition ${index} requires canonical status_${index} and non-empty basis_${index}.`
          );
        }
        dispositions.push({ path: reference.path, status, basis: [basis] });
      }
      const selected = selectDeclaredReferences(toc.references, dispositions);
      if (selected.status === "invalid") {
        return rejected(
          "invalid-reference-selection",
          `Reference dispositions are invalid: ${selected.issues.map((issue) => `${issue.code}:${issue.path}`).join(" | ")}`
        );
      }
      return {
        status: "accepted",
        value: { dispositions: Object.freeze(dispositions) },
        message: `Comparative Reference dispositions accepted as ${selected.status}.`,
        resultStatus: selected.status
      };
    }
  };
}
function routingPrompt(request, toc) {
  return [
    `User request: ${request}`,
    "Compare all declared Reference conditions before deciding:",
    ...toc.references.map(
      (reference, index) => `[${index}] ${reference.path} \u2014 ${reference.when.join(" | ")}`
    ),
    "For every index, submit status_N and basis_N. Select only materially necessary References."
  ].join("\n");
}
function stoppedResult(stage, result, decisions) {
  if (result.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      stage,
      reason: result.reason,
      decisions
    };
  }
  return {
    status: "runtime-failure",
    stage,
    message: result.message,
    decisions
  };
}
async function routeStructuredCapabilityWithSdk(input) {
  const decisions = [];
  const applicability = await input.runner.run({
    systemPrompt: [
      "Make one bounded semantic applicability proposal.",
      "Call the supplied decision tool exactly once. Do not copy condition text into tool arguments.",
      "The SDK controller owns identities, exact conditions, validation, retry limits, and state transitions."
    ].join("\n"),
    prompt: [
      `User request: ${input.request}`,
      `Capability when: ${input.toc.when.join(" | ")}`,
      `Capability unless: ${input.toc.unless.join(" | ") || "none"}`,
      "Decide only whether the Capability applies to this request."
    ].join("\n"),
    tool: applicabilityTool(input.target, input.toc)
  });
  decisions.push({ stage: "applicability", metrics: applicability.metrics });
  if (applicability.status !== "accepted") {
    return stoppedResult("applicability", applicability, decisions);
  }
  if (applicability.value.result.status !== "assigned") {
    return {
      status: "not-assigned",
      applicability: applicability.value.result,
      decisions: Object.freeze(decisions)
    };
  }
  const references = await input.runner.run({
    systemPrompt: [
      "Make one comparative local Reference routing proposal.",
      "Call the supplied decision tool exactly once and disposition every declared Reference.",
      "Choose the smallest set whose declared conditions materially apply; adjacent subject matter alone is not enough.",
      "The SDK controller owns exact paths, complete inventory, validation, retry limits, and canonical binding."
    ].join("\n"),
    prompt: routingPrompt(input.request, input.toc),
    tool: referenceTool(input.toc)
  });
  decisions.push({ stage: "references", metrics: references.metrics });
  if (references.status !== "accepted") {
    return stoppedResult("references", references, decisions);
  }
  const selection = selectDeclaredReferences(
    input.toc.references,
    references.value.dispositions
  );
  if (selection.status === "invalid") {
    return {
      status: "invariant-failure",
      stage: "references",
      code: "accepted-selection-became-invalid",
      message: "An accepted Reference proposal did not reproduce its canonical selection.",
      decisions: Object.freeze(decisions)
    };
  }
  const bound = bindReferenceSelection(
    applicability.value.result.assignment,
    input.target.capability,
    selection
  );
  if (!bound.ok) {
    return {
      status: "invariant-failure",
      stage: "references",
      code: bound.error.code,
      message: bound.error.message,
      decisions: Object.freeze(decisions)
    };
  }
  return {
    status: "routed",
    applicability: applicability.value.result,
    selection: bound.value,
    decisions: Object.freeze(decisions)
  };
}

// src/action-loop/sdk/decision-controller.ts
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}
function compactError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 320) || "Unknown SDK error";
}
function fullControlLoader(bindings, systemPrompt) {
  return {
    getExtensions: () => ({
      extensions: [],
      errors: [],
      runtime: bindings.createExtensionRuntime()
    }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    extendResources: () => {
    },
    reload: async () => {
    }
  };
}
function currentMetrics(counters) {
  return Object.freeze({
    runs: counters.runs,
    toolCalls: counters.toolCalls,
    toolErrors: counters.toolErrors,
    runtimeFailures: counters.runtimeFailures,
    errorMessages: Object.freeze([...counters.errorMessages])
  });
}
function resultText(result) {
  return result.content.flatMap(
    (item) => item.type === "text" && typeof item.text === "string" ? [item.text] : []
  ).join(" ");
}
function subscribeToAttempt(input) {
  return input.session.subscribe((event) => {
    if (event.type === "tool_execution_start" && event.toolName === input.toolName) {
      input.counters.toolCalls += 1;
      return;
    }
    if (event.type !== "tool_execution_end" || event.toolName !== input.toolName || !event.isError) {
      return;
    }
    input.observation.toolErrors += 1;
    input.counters.toolErrors += 1;
    input.counters.errorMessages.push(
      `${event.toolName}: ${compactError(resultText(event.result))}`
    );
    if (input.observation.toolErrors >= input.maximumErrors) {
      void input.session.abort();
    }
  });
}
async function createDecisionSession(options, request, tool) {
  const created = await options.bindings.createAgentSession({
    cwd: options.cwd,
    model: options.model,
    thinkingLevel: options.thinkingLevel ?? "medium",
    modelRuntime: options.modelRuntime,
    resourceLoader: fullControlLoader(options.bindings, request.systemPrompt),
    customTools: [tool],
    tools: [tool.name],
    sessionManager: options.bindings.SessionManager.inMemory(options.cwd),
    settingsManager: options.bindings.SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: false }
    })
  });
  return created.session;
}
async function runDecisionAttempt(input) {
  let acceptedProposal;
  const observation = { toolErrors: 0 };
  const tool = input.options.bindings.defineTool({
    name: input.request.tool.name,
    label: input.request.tool.label,
    description: input.request.tool.description,
    parameters: input.request.tool.parameters,
    execute: async (_toolCallId, raw) => {
      const admission = await input.request.tool.execute(raw);
      if (admission.status === "rejected") {
        return {
          content: [{ type: "text", text: admission.message }],
          details: {
            accepted: false,
            status: "rejected",
            reason: admission.code
          },
          isError: true
        };
      }
      if (acceptedProposal === void 0) {
        acceptedProposal = { value: admission.value };
      }
      return {
        content: [{ type: "text", text: admission.message }],
        details: {
          accepted: true,
          status: admission.resultStatus,
          reason: ""
        }
      };
    }
  });
  let session;
  let unsubscribe;
  let runtimeError;
  try {
    session = await createDecisionSession(input.options, input.request, tool);
    unsubscribe = subscribeToAttempt({
      session,
      toolName: input.request.tool.name,
      maximumErrors: input.maximumErrors,
      counters: input.counters,
      observation
    });
    await session.prompt(input.request.prompt);
    input.counters.nonRuntimeRuns += 1;
  } catch (error) {
    if (observation.toolErrors >= input.maximumErrors) {
      input.counters.nonRuntimeRuns += 1;
    } else {
      input.counters.runtimeFailures += 1;
      runtimeError = compactError(error);
      input.counters.errorMessages.push(`runtime: ${runtimeError}`);
    }
  } finally {
    unsubscribe?.();
    session?.dispose();
  }
  if (acceptedProposal !== void 0) {
    return { status: "accepted", value: acceptedProposal.value };
  }
  return runtimeError === void 0 ? { status: "not-accepted" } : { status: "runtime-failure", message: runtimeError };
}
async function runBoundedDecision(options, request, maximumRuns, maximumErrors) {
  const counters = {
    runs: 0,
    toolCalls: 0,
    toolErrors: 0,
    runtimeFailures: 0,
    nonRuntimeRuns: 0,
    errorMessages: []
  };
  let lastRuntimeError;
  for (let run = 1; run <= maximumRuns; run += 1) {
    counters.runs = run;
    const attempt = await runDecisionAttempt({
      options,
      request,
      maximumErrors,
      counters
    });
    if (attempt.status === "accepted") {
      return {
        status: "accepted",
        value: attempt.value,
        metrics: currentMetrics(counters)
      };
    }
    if (attempt.status === "runtime-failure") {
      lastRuntimeError = attempt.message;
    }
  }
  if (counters.nonRuntimeRuns === 0 && lastRuntimeError !== void 0) {
    return {
      status: "runtime-failure",
      message: lastRuntimeError,
      metrics: currentMetrics(counters)
    };
  }
  return {
    status: "bounded-stop",
    reason: "decision-run-budget",
    metrics: currentMetrics(counters)
  };
}
function createPiSdkDecisionRunner(options) {
  const maximumRuns = positiveInteger(options.maxRuns, "maxRuns");
  const maximumErrors = positiveInteger(
    options.maxToolErrorsPerRun,
    "maxToolErrorsPerRun"
  );
  return Object.freeze({
    run: (request) => runBoundedDecision(options, request, maximumRuns, maximumErrors)
  });
}
export {
  SKILL_TOC_SCHEMA_URI,
  bindCapability,
  createPiSdkDecisionRunner,
  parseTocBytes,
  routeStructuredCapabilityWithSdk
};
