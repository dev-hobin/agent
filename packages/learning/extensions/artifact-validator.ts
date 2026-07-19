import { parseDocument } from "yaml";

export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface ArtifactValidation {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  artifact?: {
    id?: string;
    family?: string;
    status?: string;
    sourceIndependent?: boolean;
  };
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const STATUSES = new Set(["draft", "active", "retired"]);
const RELATIONS = [
  "uses",
  "requires",
  "references",
  "replaces",
  "source",
  "composes",
  "constrains",
  "refines",
  "splits",
  "strengthens",
  "axis",
  "transforms",
  "guides",
  "checks",
  "produces",
  "visualizes",
] as const;

const FAMILY_BY_PREFIX = [
  ["concept-update/", "ConceptUpdate"],
  ["concept-scheme/", "ConceptScheme"],
  ["concept/", "Concept"],
  ["pattern/", "Pattern"],
] as const;

const ROLES_BY_FAMILY = new Map([
  ["Concept", ["Atomic", "Pattern"]],
  ["ConceptScheme", ["Structure"]],
  ["Pattern", ["Workflow", "Decision", "Diagnostic", "Composition"]],
]);

const PREFIXES_BY_FOLDER = new Map([
  ["concept-updates", ["concept-update/"]],
  ["concepts", ["concept/", "concept-scheme/"]],
  ["patterns", ["pattern/"]],
]);

function issue(code: string, message: string, field?: string): ValidationIssue {
  return { code, message, ...(field ? { field } : {}) };
}

function asTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }
  return [];
}

function relationShapeIsValid(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string"))
  );
}

function folderFor(path: string): string | undefined {
  const segments = path.replaceAll("\\", "/").split("/");
  return [...segments].reverse().find((segment) => PREFIXES_BY_FOLDER.has(segment));
}

function familyFor(id: string): string | undefined {
  return FAMILY_BY_PREFIX.find(([prefix]) => id.startsWith(prefix))?.[1];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateLearningArtifact(source: string, path = "artifact.md"): ArtifactValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const match = source.match(FRONTMATTER);

  if (!match) {
    return {
      valid: false,
      errors: [issue("frontmatter.missing", "Markdown artifact must start with YAML frontmatter.")],
      warnings,
    };
  }

  const document = parseDocument(match[1]);
  if (document.errors.length > 0) {
    return {
      valid: false,
      errors: document.errors.map((error) => issue("frontmatter.yaml", error.message)),
      warnings,
    };
  }

  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      valid: false,
      errors: [issue("frontmatter.object", "YAML frontmatter must be a mapping.")],
      warnings,
    };
  }

  const data = value as Record<string, unknown>;
  const required = ["@context", "id", "type", "prefLabel", "inScheme", "status", "sourceIndependent", "source"];
  for (const field of required) {
    if (!(field in data)) errors.push(issue("field.required", `Missing required field: ${field}.`, field));
  }

  for (const field of ["@context", "id", "prefLabel", "inScheme"] as const) {
    if (field in data && !hasText(data[field])) {
      errors.push(issue("field.text", `${field} must be a non-empty string.`, field));
    }
  }

  const id = hasText(data.id) ? data.id.trim() : undefined;
  const family = id ? familyFor(id) : undefined;
  if (id && !family) {
    errors.push(issue("id.namespace", `Unsupported id namespace: ${id}.`, "id"));
  }

  const folder = folderFor(path);
  const expectedPrefixes = folder ? PREFIXES_BY_FOLDER.get(folder) : undefined;
  if (id && expectedPrefixes && !expectedPrefixes.some((prefix) => id.startsWith(prefix))) {
    errors.push(
      issue(
        "id.folder",
        `Artifact under ${folder}/ must use one of these id namespaces: ${expectedPrefixes.join(", ")}.`,
        "id",
      ),
    );
  }

  const types = asTypes(data.type);
  if (types.length === 0) {
    errors.push(issue("type.shape", "type must be a string or a non-empty array of strings.", "type"));
  } else if (family && !types.includes(family)) {
    errors.push(issue("type.family", `type must include ${family} for ${id}.`, "type"));
  }
  const expectedRoles = family ? ROLES_BY_FAMILY.get(family) : undefined;
  if (expectedRoles && !expectedRoles.some((role) => types.includes(role))) {
    errors.push(
      issue(
        "type.role",
        `${family} type must include one role: ${expectedRoles.join(", ")}.`,
        "type",
      ),
    );
  }

  if (data.status !== undefined && (!hasText(data.status) || !STATUSES.has(data.status))) {
    errors.push(issue("status.value", "status must be draft, active, or retired.", "status"));
  }

  if (data.sourceIndependent !== undefined && typeof data.sourceIndependent !== "boolean") {
    errors.push(issue("sourceIndependent.type", "sourceIndependent must be a boolean.", "sourceIndependent"));
  }

  if (family === "ConceptUpdate" && data.sourceIndependent !== false) {
    errors.push(
      issue(
        "sourceIndependent.update",
        "Concept updates are source-bound and must set sourceIndependent: false.",
        "sourceIndependent",
      ),
    );
  }
  if (
    (family === "Concept" || family === "ConceptScheme" || family === "Pattern") &&
    data.sourceIndependent !== true
  ) {
    errors.push(
      issue(
        "sourceIndependent.family",
        `${family} artifacts must set sourceIndependent: true.`,
        "sourceIndependent",
      ),
    );
  }

  for (const field of RELATIONS) {
    if (field in data && !relationShapeIsValid(data[field])) {
      errors.push(
        issue(
          "relation.shape",
          `${field} must be a non-empty string or non-empty array of strings.`,
          field,
        ),
      );
    }
  }

  if ("relations" in data) {
    warnings.push(
      issue(
        "relations.nested",
        "Use top-level typed relation fields instead of an opaque relations field.",
        "relations",
      ),
    );
  }

  if (hasText(data.inScheme) && !data.inScheme.startsWith("concept-scheme/")) {
    errors.push(issue("inScheme.namespace", "inScheme must use the concept-scheme/ namespace.", "inScheme"));
  }

  const context = hasText(data["@context"]) ? data["@context"] : undefined;
  if (context && folder === "concepts" && context !== "context.jsonld") {
    warnings.push(
      issue("context.shared", "Concept notes normally use context.jsonld from concepts/.", "@context"),
    );
  }
  if (
    context &&
    folder &&
    folder !== "concepts" &&
    context !== "../concepts/context.jsonld"
  ) {
    warnings.push(
      issue(
        "context.shared",
        `${folder}/ artifacts normally use ../concepts/context.jsonld.`,
        "@context",
      ),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    artifact: {
      ...(id ? { id } : {}),
      ...(family ? { family } : {}),
      ...(hasText(data.status) ? { status: data.status } : {}),
      ...(typeof data.sourceIndependent === "boolean"
        ? { sourceIndependent: data.sourceIndependent }
        : {}),
    },
  };
}
