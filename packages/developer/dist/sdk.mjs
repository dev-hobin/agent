// src/action-loop/pi/bind-pi-capability-inventory.ts
import { constants as constants2 } from "node:fs";
import { open as open2 } from "node:fs/promises";

// src/action-loop/io/seal-skill-context.ts
import { constants } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

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

// src/action-loop/io/seal-skill-context.ts
var SEALED_SKILL_CONTEXT_VERSION = "developer-sealed-skill-context/v1";
var SEALED_UNSTRUCTURED_SKILL_CONTEXT_VERSION = "developer-sealed-unstructured-skill-context/v1";
var MAX_SEALED_MATERIAL_BYTES = 256 * 1024;
var MAX_SEALED_CONTEXT_BYTES = 1024 * 1024;
function failure(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function materialFailure(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function nodeErrorCode(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return void 0;
  }
  return typeof error.code === "string" ? error.code : void 0;
}
function isContained(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder === "" || !remainder.startsWith("..") && !isAbsolute(remainder);
}
function sameFileState(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}
async function closeQuietly(handle) {
  if (handle === void 0) return;
  try {
    await handle.close();
  } catch {
  }
}
function validateIdentity(request) {
  const { assignment, capability, selection } = request;
  if (selection.status !== "ready") {
    return failure(
      "selection-not-ready",
      "selection.status",
      "Only a ready Reference selection can be sealed"
    );
  }
  for (const [path, actual, expected] of [
    [
      "assignment.capabilityId",
      assignment.capabilityId,
      capability.capabilityId
    ],
    [
      "assignment.capabilityRevisionId",
      assignment.capabilityRevisionId,
      capability.capabilityRevisionId
    ],
    ["selection.assignmentId", selection.assignmentId, assignment.assignmentId],
    [
      "selection.capabilityRevisionId",
      selection.capabilityRevisionId,
      capability.capabilityRevisionId
    ]
  ]) {
    if (actual !== expected) {
      return failure(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
async function resolveSkillRoot(skillRootPath) {
  if (!isAbsolute(skillRootPath)) {
    return {
      ok: false,
      error: {
        code: "invalid-root",
        path: "skillRootPath",
        message: "Skill root must be an absolute path"
      }
    };
  }
  const lexical = resolve(skillRootPath);
  try {
    const physical = await realpath(lexical);
    const rootStat = await stat(physical);
    if (!rootStat.isDirectory()) {
      return {
        ok: false,
        error: {
          code: "invalid-root",
          path: "skillRootPath",
          message: "Skill root must resolve to a directory"
        }
      };
    }
    return { ok: true, lexical, physical };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "invalid-root",
        path: "skillRootPath",
        message: `Skill root cannot be resolved (${nodeErrorCode(error) ?? "unknown"})`
      }
    };
  }
}
async function resolveMaterialPath(root, path) {
  const lexical = resolve(root.lexical, ...path.split("/"));
  if (!isContained(root.lexical, lexical)) {
    return {
      ok: false,
      error: {
        code: "path-escape",
        path,
        message: "Material escapes the lexical Skill root"
      }
    };
  }
  try {
    const physical = await realpath(lexical);
    if (!isContained(root.physical, physical)) {
      return {
        ok: false,
        error: {
          code: "path-escape",
          path,
          message: "Material escapes the physical Skill root"
        }
      };
    }
    return { ok: true, physical };
  } catch (error) {
    const code = nodeErrorCode(error);
    return {
      ok: false,
      error: {
        code: code === "ENOENT" || code === "ENOTDIR" ? "material-missing" : "material-unreadable",
        path,
        message: `Material cannot be resolved (${code ?? "unknown"})`
      }
    };
  }
}
async function acquireMaterial(root, kind, path) {
  const resolved = await resolveMaterialPath(root, path);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  let handle;
  try {
    handle = await open(
      resolved.physical,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      return materialFailure(
        "material-not-regular",
        path,
        "Material must be a regular file"
      );
    }
    if (before.size > BigInt(MAX_SEALED_MATERIAL_BYTES)) {
      return materialFailure(
        "material-too-large",
        path,
        `Material exceeds ${MAX_SEALED_MATERIAL_BYTES} bytes`
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameFileState(before, after) || BigInt(bytes.byteLength) !== before.size) {
      return materialFailure(
        "material-changed",
        path,
        "Material changed while it was being acquired"
      );
    }
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return materialFailure(
        "invalid-utf8",
        path,
        "Material must contain valid UTF-8"
      );
    }
    return {
      ok: true,
      value: Object.freeze({
        kind,
        path,
        locator: resolved.physical,
        byteLength: bytes.byteLength,
        hash: sha256Bytes(bytes),
        bytesBase64: bytes.toString("base64"),
        content
      })
    };
  } catch (error) {
    return materialFailure(
      "material-unreadable",
      path,
      `Material cannot be read (${nodeErrorCode(error) ?? "unknown"})`
    );
  } finally {
    await closeQuietly(handle);
  }
}
function contextIdentityParts(selection, materials) {
  const parts = [selection.selectionId, selection.capabilityRevisionId];
  for (const material of materials) {
    parts.push("material", material.kind, material.path, material.hash);
  }
  return parts;
}
function validateUnstructuredIdentity(request) {
  for (const [path, actual, expected] of [
    [
      "assignment.capabilityId",
      request.assignment.capabilityId,
      request.capability.capabilityId
    ],
    [
      "assignment.capabilityRevisionId",
      request.assignment.capabilityRevisionId,
      request.capability.capabilityRevisionId
    ]
  ]) {
    if (actual !== expected) {
      return failure(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
function unstructuredContextIdentityParts(request, material) {
  return [
    request.assignment.assignmentId,
    request.capability.capabilityRevisionId,
    "routing",
    "unstructured",
    "material",
    material.kind,
    material.path,
    material.hash
  ];
}
async function sealSkillContext(request) {
  const identityFailure = validateIdentity(request);
  if (identityFailure !== void 0) return identityFailure;
  const root = await resolveSkillRoot(request.skillRootPath);
  if (!root.ok) return { ok: false, error: root.error };
  const requested = [
    { kind: "skill", path: "SKILL.md" },
    ...request.selection.selectedPaths.map((path) => ({
      kind: "reference",
      path
    }))
  ];
  const materials = [];
  let totalBytes = 0;
  for (const materialRequest of requested) {
    const acquired = await acquireMaterial(
      root,
      materialRequest.kind,
      materialRequest.path
    );
    if (!acquired.ok) return { ok: false, error: acquired.error };
    totalBytes += acquired.value.byteLength;
    if (totalBytes > MAX_SEALED_CONTEXT_BYTES) {
      return failure(
        "context-too-large",
        materialRequest.path,
        `Selected context exceeds ${MAX_SEALED_CONTEXT_BYTES} bytes`
      );
    }
    materials.push(acquired.value);
  }
  if (materials[0]?.hash !== request.capability.skillHash) {
    return failure(
      "skill-drift",
      "SKILL.md",
      "SKILL.md no longer matches the bound Capability revision"
    );
  }
  const sealedContextId = hashIdentity(
    "sealed",
    SEALED_SKILL_CONTEXT_VERSION,
    contextIdentityParts(request.selection, materials)
  );
  if (request.expectedSealedContextId !== void 0 && request.expectedSealedContextId !== sealedContextId) {
    return failure(
      "context-drift",
      "expectedSealedContextId",
      "Selected material no longer matches the expected sealed context"
    );
  }
  const source = Object.freeze({ ...request.capability.source });
  return {
    ok: true,
    value: Object.freeze({
      sealedContextId,
      workCaseId: request.assignment.workCaseId,
      judgmentId: request.assignment.judgmentId,
      contributionNeedId: request.assignment.contributionNeedId,
      assignmentId: request.assignment.assignmentId,
      selectionId: request.selection.selectionId,
      capabilityId: request.capability.capabilityId,
      capabilityRevisionId: request.capability.capabilityRevisionId,
      source,
      skillRootLocator: root.physical,
      selectedPaths: Object.freeze([...request.selection.selectedPaths]),
      materials: Object.freeze(materials)
    })
  };
}
async function sealUnstructuredSkillContext(request) {
  const identityFailure = validateUnstructuredIdentity(request);
  if (identityFailure !== void 0) return identityFailure;
  if (!isAbsolute(request.skillFilePath)) {
    return failure(
      "invalid-skill-file",
      "skillFilePath",
      "Skill file must be an absolute path"
    );
  }
  const lexicalSkillFile = resolve(request.skillFilePath);
  const root = await resolveSkillRoot(dirname(lexicalSkillFile));
  if (!root.ok) {
    return failure(
      "invalid-skill-file",
      "skillFilePath",
      `Skill file parent is invalid: ${root.error.message}`
    );
  }
  const acquired = await acquireMaterial(
    root,
    "skill",
    basename(lexicalSkillFile)
  );
  if (!acquired.ok) return { ok: false, error: acquired.error };
  if (acquired.value.hash !== request.capability.skillHash) {
    return failure(
      "skill-drift",
      acquired.value.path,
      "Skill material no longer matches the bound Capability revision"
    );
  }
  const sealedContextId = hashIdentity(
    "sealed",
    SEALED_UNSTRUCTURED_SKILL_CONTEXT_VERSION,
    unstructuredContextIdentityParts(request, acquired.value)
  );
  if (request.expectedSealedContextId !== void 0 && request.expectedSealedContextId !== sealedContextId) {
    return failure(
      "context-drift",
      "expectedSealedContextId",
      "Skill material no longer matches the expected sealed context"
    );
  }
  const selectedPaths = Object.freeze([]);
  const materials = Object.freeze([acquired.value]);
  return {
    ok: true,
    value: Object.freeze({
      routing: "unstructured",
      sealedContextId,
      workCaseId: request.assignment.workCaseId,
      judgmentId: request.assignment.judgmentId,
      contributionNeedId: request.assignment.contributionNeedId,
      assignmentId: request.assignment.assignmentId,
      capabilityId: request.capability.capabilityId,
      capabilityRevisionId: request.capability.capabilityRevisionId,
      source: Object.freeze({ ...request.capability.source }),
      skillLocator: acquired.value.locator,
      selectedPaths,
      materials
    })
  };
}

// src/action-loop/routing/bind-capability.ts
var CAPABILITY_ID_VERSION = "developer-capability/v1";
var CAPABILITY_REVISION_VERSION = "developer-capability-revision/v1";
var UNSTRUCTURED_CAPABILITY_MARKER = "developer-capability-routing/unstructured-no-toc/v1";
var SOURCE_KINDS = /* @__PURE__ */ new Set([
  "package",
  "global",
  "project",
  "settings",
  "cli"
]);
function failure2(code, path, message) {
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
    return failure2(
      "unsupported-source-kind",
      "source.kind",
      `Unsupported Capability source kind ${source.kind}`
    );
  }
  if (!isCanonicalLocator(source.locator)) {
    return failure2(
      "invalid-source-locator",
      "source.locator",
      "Capability source locator must be a nonblank canonical value"
    );
  }
  if (!isNormalizedSkillRoot(source.skillRoot)) {
    return failure2(
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
function bindUnstructuredCapability(source, skillBytes) {
  const sourceIdentity = bindSourceIdentity(source);
  if (!sourceIdentity.ok) return sourceIdentity;
  const { capabilityId, source: boundSource } = sourceIdentity.value;
  const skillHash = sha256Bytes(skillBytes);
  const capabilityRevisionId = hashIdentity(
    "caprev",
    CAPABILITY_REVISION_VERSION,
    [capabilityId, skillHash, UNSTRUCTURED_CAPABILITY_MARKER]
  );
  return {
    ok: true,
    value: Object.freeze({
      routing: "unstructured",
      capabilityId,
      capabilityRevisionId,
      skillHash,
      source: boundSource
    })
  };
}

// src/action-loop/pi/bind-pi-capability-inventory.ts
var MAX_CAPABILITY_SKILL_BYTES = MAX_SEALED_MATERIAL_BYTES;
function nodeErrorCode2(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return void 0;
  }
  return typeof error.code === "string" ? error.code : void 0;
}
function sameFileState2(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}
async function closeQuietly2(handle) {
  if (handle === void 0) return;
  try {
    await handle.close();
  } catch {
  }
}
function acquisitionFailure(code, path, message) {
  return {
    ok: false,
    error: Object.freeze({ code, path, message })
  };
}
async function readAtMost(handle, maximumBytes) {
  const buffer = Buffer.alloc(maximumBytes + 1);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      buffer.byteLength - offset,
      null
    );
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return buffer.subarray(0, offset);
}
async function acquireSkillBytes(entry) {
  const path = entry.candidate.skillFilePath;
  let handle;
  try {
    handle = await open2(
      path,
      constants2.O_RDONLY | constants2.O_NOFOLLOW | constants2.O_NONBLOCK
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      return acquisitionFailure(
        "skill-not-regular",
        path,
        "Skill material must be a regular file"
      );
    }
    if (before.size > BigInt(MAX_CAPABILITY_SKILL_BYTES)) {
      return acquisitionFailure(
        "skill-too-large",
        path,
        `Skill material exceeds ${MAX_CAPABILITY_SKILL_BYTES} bytes`
      );
    }
    const bytes = await readAtMost(handle, Number(before.size));
    const after = await handle.stat({ bigint: true });
    if (!sameFileState2(before, after) || BigInt(bytes.byteLength) !== before.size) {
      return acquisitionFailure(
        "skill-changed",
        path,
        "Skill material changed while it was being acquired"
      );
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return acquisitionFailure(
        "invalid-utf8",
        path,
        "Skill material must contain valid UTF-8"
      );
    }
    return { ok: true, bytes };
  } catch (error) {
    const code = nodeErrorCode2(error);
    return acquisitionFailure(
      code === "ENOENT" || code === "ENOTDIR" ? "skill-missing" : "skill-unreadable",
      path,
      `Skill material cannot be read (${code ?? "unknown"})`
    );
  } finally {
    await closeQuietly2(handle);
  }
}
async function bindStructuredEntry(entry) {
  const acquired = await acquireSkillBytes(entry);
  if (!acquired.ok) {
    return Object.freeze({
      status: "binding-failed",
      routing: "structured",
      stage: "skill-acquisition",
      candidate: entry.candidate,
      descriptor: entry.descriptor,
      error: acquired.error
    });
  }
  const bound = bindCapability(
    entry.candidate.source,
    entry.descriptor.toc,
    acquired.bytes
  );
  if (!bound.ok) {
    return Object.freeze({
      status: "binding-failed",
      routing: "structured",
      stage: "capability-binding",
      candidate: entry.candidate,
      descriptor: entry.descriptor,
      error: Object.freeze({ ...bound.error })
    });
  }
  return Object.freeze({
    status: "bound",
    routing: "structured",
    candidate: entry.candidate,
    descriptor: entry.descriptor,
    capability: bound.value
  });
}
async function bindUnstructuredEntry(entry) {
  const acquired = await acquireSkillBytes(entry);
  if (!acquired.ok) {
    return Object.freeze({
      status: "binding-failed",
      routing: "unstructured",
      stage: "skill-acquisition",
      candidate: entry.candidate,
      reason: entry.reason,
      error: acquired.error
    });
  }
  const bound = bindUnstructuredCapability(
    entry.candidate.source,
    acquired.bytes
  );
  if (!bound.ok) {
    return Object.freeze({
      status: "binding-failed",
      routing: "unstructured",
      stage: "capability-binding",
      candidate: entry.candidate,
      reason: entry.reason,
      error: Object.freeze({ ...bound.error })
    });
  }
  return Object.freeze({
    status: "bound",
    routing: "unstructured",
    candidate: entry.candidate,
    reason: entry.reason,
    capability: bound.value
  });
}
async function bindPiCapabilityInventory(catalog) {
  if (catalog.status === "rejected") return catalog;
  const entries = [];
  for (const entry of catalog.entries) {
    if (entry.status === "structured") {
      entries.push(await bindStructuredEntry(entry));
    } else if (entry.status === "unstructured") {
      entries.push(await bindUnstructuredEntry(entry));
    } else {
      entries.push(entry);
    }
  }
  return Object.freeze({
    status: "inventoried",
    entries: Object.freeze(entries),
    excluded: catalog.excluded
  });
}

// src/action-loop/pi/adapt-skill-catalog.ts
import { realpath as realpath2, stat as stat2 } from "node:fs/promises";
import {
  basename as basename2,
  dirname as dirname2,
  isAbsolute as isAbsolute2,
  relative as relative2,
  resolve as resolve2,
  sep
} from "node:path";
import { pathToFileURL } from "node:url";
var SOURCE_SCOPES = /* @__PURE__ */ new Set([
  "user",
  "project",
  "temporary"
]);
var SOURCE_ORIGINS = /* @__PURE__ */ new Set(["package", "top-level"]);
function failure3(code, index, path, message) {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, index, path, message })
  });
}
function descriptorFailure(code, index, path, message) {
  return {
    ok: false,
    error: { code, index, path, message }
  };
}
function nodeErrorCode3(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return void 0;
  }
  return typeof error.code === "string" ? error.code : void 0;
}
function canonicalText(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length > 0 && !normalized.includes("\0") ? normalized : void 0;
}
function isContained2(root, candidate) {
  const remainder = relative2(root, candidate);
  return remainder === "" || !remainder.startsWith("..") && !isAbsolute2(remainder);
}
function toPosixPath(path) {
  return path.split(sep).join("/");
}
function sourceKind(skill) {
  const { origin, scope } = skill.sourceInfo;
  if (!SOURCE_ORIGINS.has(origin) || !SOURCE_SCOPES.has(scope)) {
    return void 0;
  }
  if (origin === "package") return "package";
  if (scope === "user") return "global";
  if (scope === "project") return "project";
  return "cli";
}
async function canonicalFile(path, index, field) {
  if (!isAbsolute2(path)) {
    return {
      ok: false,
      error: {
        code: "invalid-skill-path",
        index,
        path: `skills[${index}].${field}`,
        message: "Pi Skill file paths must be absolute"
      }
    };
  }
  try {
    const physical = await realpath2(resolve2(path));
    const fileStat = await stat2(physical);
    if (!fileStat.isFile()) {
      return {
        ok: false,
        error: {
          code: "skill-material-not-regular",
          index,
          path: `skills[${index}].${field}`,
          message: "Pi Skill material must resolve to a regular file"
        }
      };
    }
    return { ok: true, value: physical };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "invalid-skill-path",
        index,
        path: `skills[${index}].${field}`,
        message: `Pi Skill material cannot be resolved (${nodeErrorCode3(error) ?? "unknown"})`
      }
    };
  }
}
async function canonicalDirectory(path, index, field) {
  if (!isAbsolute2(path)) {
    return {
      ok: false,
      error: {
        code: "invalid-source-root",
        index,
        path: `skills[${index}].${field}`,
        message: "Pi Skill root paths must be absolute"
      }
    };
  }
  try {
    const physical = await realpath2(resolve2(path));
    const directoryStat = await stat2(physical);
    if (!directoryStat.isDirectory()) {
      return {
        ok: false,
        error: {
          code: "invalid-source-root",
          index,
          path: `skills[${index}].${field}`,
          message: "Pi Skill root must resolve to a directory"
        }
      };
    }
    return { ok: true, value: physical };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "invalid-source-root",
        index,
        path: `skills[${index}].${field}`,
        message: `Pi Skill root cannot be resolved (${nodeErrorCode3(error) ?? "unknown"})`
      }
    };
  }
}
function validateDescriptorMetadata(skill, index) {
  const label = canonicalText(skill.name);
  const description = canonicalText(skill.description);
  if (label === void 0 || description === void 0) {
    return descriptorFailure(
      "invalid-skill",
      index,
      `skills[${index}]`,
      "Pi Skill requires a nonblank name and description"
    );
  }
  const kind = sourceKind(skill);
  const sourceName = canonicalText(skill.sourceInfo.source);
  if (kind === void 0 || sourceName === void 0) {
    return descriptorFailure(
      "invalid-source-provenance",
      index,
      kind === void 0 ? `skills[${index}].sourceInfo.scope` : `skills[${index}].sourceInfo.source`,
      "Pi Skill source provenance is incomplete or unsupported"
    );
  }
  if (skill.sourceInfo.baseDir === void 0) {
    return descriptorFailure(
      "invalid-source-provenance",
      index,
      `skills[${index}].sourceInfo.baseDir`,
      "Pi Skill source provenance requires its resource base directory"
    );
  }
  return {
    ok: true,
    value: {
      label,
      description,
      kind,
      sourceName,
      sourceBaseDir: skill.sourceInfo.baseDir
    }
  };
}
async function resolveDescriptorPaths(skill, index, sourceBaseDir) {
  const skillFile = await canonicalFile(skill.filePath, index, "filePath");
  if (!skillFile.ok) return skillFile;
  const sourceFile = await canonicalFile(
    skill.sourceInfo.path,
    index,
    "sourceInfo.path"
  );
  if (!sourceFile.ok) return sourceFile;
  if (sourceFile.value !== skillFile.value) {
    return descriptorFailure(
      "source-path-mismatch",
      index,
      `skills[${index}].sourceInfo.path`,
      "Pi Skill sourceInfo.path must identify the same material as filePath"
    );
  }
  const skillRoot = await canonicalDirectory(skill.baseDir, index, "baseDir");
  if (!skillRoot.ok) return skillRoot;
  if (dirname2(skillFile.value) !== skillRoot.value) {
    return descriptorFailure(
      "skill-root-mismatch",
      index,
      `skills[${index}].baseDir`,
      "Pi Skill baseDir must be the direct parent of its material"
    );
  }
  const sourceRoot = await canonicalDirectory(
    sourceBaseDir,
    index,
    "sourceInfo.baseDir"
  );
  if (!sourceRoot.ok) return sourceRoot;
  if (!isContained2(sourceRoot.value, skillFile.value)) {
    return descriptorFailure(
      "source-root-escape",
      index,
      `skills[${index}].sourceInfo.baseDir`,
      "Pi Skill material escapes its declared source root"
    );
  }
  return {
    ok: true,
    value: {
      skillFile: skillFile.value,
      skillRoot: skillRoot.value,
      sourceRoot: sourceRoot.value
    }
  };
}
async function adaptDescriptor(skill, index) {
  const metadata = validateDescriptorMetadata(skill, index);
  if (!metadata.ok) return metadata;
  const paths = await resolveDescriptorPaths(
    skill,
    index,
    metadata.value.sourceBaseDir
  );
  if (!paths.ok) return paths;
  const skillMaterialPath = basename2(paths.value.skillFile);
  const supportsStructuredToc = skillMaterialPath === "SKILL.md";
  const identityTarget = supportsStructuredToc ? paths.value.skillRoot : paths.value.skillFile;
  const relativeRoot = relative2(paths.value.sourceRoot, identityTarget);
  const source = Object.freeze({
    kind: metadata.value.kind,
    locator: metadata.value.kind === "package" ? metadata.value.sourceName : pathToFileURL(paths.value.sourceRoot).href,
    skillRoot: relativeRoot.length === 0 ? "." : toPosixPath(relativeRoot)
  });
  return {
    ok: true,
    value: Object.freeze({
      label: metadata.value.label,
      description: metadata.value.description,
      skillFilePath: paths.value.skillFile,
      skillRootPath: paths.value.skillRoot,
      skillMaterialPath,
      supportsStructuredToc,
      source
    })
  };
}
function occurrenceKey(descriptor) {
  return [
    descriptor.source.kind,
    descriptor.source.locator,
    descriptor.source.skillRoot
  ].join("\0");
}
async function adaptPiSkillCatalog(skills) {
  const inventory = [];
  const excluded = [];
  const occurrences = /* @__PURE__ */ new Set();
  for (let index = 0; index < skills.length; index += 1) {
    const skill = skills[index];
    if (skill === void 0) {
      return failure3(
        "invalid-skill",
        index,
        `skills[${index}]`,
        "Pi Skill catalog contains an empty entry"
      );
    }
    if (skill.disableModelInvocation) {
      excluded.push(
        Object.freeze({
          label: skill.name,
          skillFilePath: skill.filePath,
          reason: "model-invocation-disabled"
        })
      );
      continue;
    }
    const adapted = await adaptDescriptor(skill, index);
    if (!adapted.ok) {
      return Object.freeze({
        ok: false,
        error: Object.freeze(adapted.error)
      });
    }
    const key = occurrenceKey(adapted.value);
    if (occurrences.has(key)) {
      return failure3(
        "duplicate-occurrence",
        index,
        `skills[${index}]`,
        "Pi Skill catalog repeats one source-bound occurrence"
      );
    }
    occurrences.add(key);
    inventory.push(adapted.value);
  }
  return Object.freeze({
    ok: true,
    inventory: Object.freeze(inventory),
    excluded: Object.freeze(excluded)
  });
}

// src/action-loop/io/discover-skill-toc.ts
import { constants as constants3 } from "node:fs";
import {
  open as open3,
  readdir,
  realpath as realpath3,
  stat as stat3
} from "node:fs/promises";
import { isAbsolute as isAbsolute3, join, resolve as resolve3 } from "node:path";

// src/action-loop/routing/parse-toc.ts
var SKILL_TOC_SCHEMA_URI = "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json";
var MAX_TOC_BYTES = 64 * 1024;
function failure4(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkFields(value, path, allowed, required) {
  const allowedFields = new Set(allowed);
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      return failure4(
        "unknown-field",
        path === "$" ? `$.${field}` : `${path}.${field}`,
        `Unknown field ${field}`
      );
    }
  }
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      return failure4(
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
    return failure4("expected-array", path, "Expected an array of conditions");
  }
  if (value.length === 0) {
    return failure4("empty-list", path, "Expected at least one condition");
  }
  const conditions = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < value.length; index += 1) {
    const condition = value[index];
    const conditionPath = `${path}[${index}]`;
    if (typeof condition !== "string") {
      return failure4(
        "expected-string",
        conditionPath,
        "Expected a condition string"
      );
    }
    const normalized = condition.trim();
    if (normalized.length === 0) {
      return failure4(
        "empty-string",
        conditionPath,
        "Condition must not be blank"
      );
    }
    if (seen.has(normalized)) {
      return failure4(
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
    return failure4("expected-object", path, "Expected a Reference object");
  }
  const fieldFailure = checkFields(
    value,
    path,
    ["path", "when"],
    ["path", "when"]
  );
  if (fieldFailure !== void 0) return fieldFailure;
  if (typeof value.path !== "string") {
    return failure4(
      "expected-string",
      `${path}.path`,
      "Expected a Reference path string"
    );
  }
  if (!isNormalizedReferencePath(value.path)) {
    return failure4(
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
    return failure4(
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
      return failure4(
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
    return failure4("expected-object", "$", "Expected a TOC object");
  }
  const fieldFailure = checkFields(
    value,
    "$",
    ["$schema", "when", "unless", "references"],
    ["$schema", "when", "unless", "references"]
  );
  if (fieldFailure !== void 0) return fieldFailure;
  if (value.$schema !== SKILL_TOC_SCHEMA_URI) {
    return failure4(
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
    return failure4("too-large", "$", `TOC exceeds ${MAX_TOC_BYTES} bytes`);
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return failure4("invalid-utf8", "$", "TOC must be valid UTF-8");
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return failure4("invalid-json", "$", "TOC must be valid JSON");
  }
  return parseRoot(value);
}

// src/action-loop/io/discover-skill-toc.ts
var MAX_TOC_DISCOVERY_JSON_FILES = 32;
var MAX_TOC_DISCOVERY_BYTES = 256 * 1024;
var TOC_SCHEMA_FAMILY_PREFIX = "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v";
var TOC_SCHEMA_FAMILY_SUFFIX = ".schema.json";
function failure5(code, path, message, details = {}) {
  return Object.freeze({
    status: "failed",
    error: Object.freeze({ code, path, message, ...details })
  });
}
function nodeErrorCode4(error) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return void 0;
  }
  return typeof error.code === "string" ? error.code : void 0;
}
function sameFileState3(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}
async function closeQuietly3(handle) {
  if (handle === void 0) return;
  try {
    await handle.close();
  } catch {
  }
}
async function resolveSkillRoot2(skillRootPath) {
  if (!isAbsolute3(skillRootPath)) {
    return {
      ok: false,
      error: {
        code: "invalid-root",
        path: "skillRootPath",
        message: "Skill root must be an absolute path"
      }
    };
  }
  try {
    const physical = await realpath3(resolve3(skillRootPath));
    const rootStat = await stat3(physical);
    if (!rootStat.isDirectory()) {
      return {
        ok: false,
        error: {
          code: "invalid-root",
          path: "skillRootPath",
          message: "Skill root must resolve to a directory"
        }
      };
    }
    return { ok: true, value: Object.freeze({ physical }) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "invalid-root",
        path: "skillRootPath",
        message: `Skill root cannot be resolved (${nodeErrorCode4(error) ?? "unknown"})`
      }
    };
  }
}
function schemaUriFrom(bytes) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return void 0;
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    return void 0;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return void 0;
  }
  const schema = value.$schema;
  return typeof schema === "string" ? schema : void 0;
}
function isKnownTocSchemaFamily(schemaUri) {
  return schemaUri.startsWith(TOC_SCHEMA_FAMILY_PREFIX) && schemaUri.endsWith(TOC_SCHEMA_FAMILY_SUFFIX);
}
async function acquireJsonFile(root, name, remainingBytes) {
  const locator = join(root.physical, name);
  let handle;
  try {
    handle = await open3(locator, constants3.O_RDONLY | constants3.O_NOFOLLOW);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      return {
        ok: false,
        error: {
          code: "descriptor-not-regular",
          path: name,
          message: "Direct-child JSON descriptor candidate must be regular"
        }
      };
    }
    if (before.size > BigInt(MAX_TOC_BYTES)) {
      return {
        ok: false,
        error: {
          code: "descriptor-too-large",
          path: name,
          message: `JSON descriptor candidate exceeds ${MAX_TOC_BYTES} bytes`
        }
      };
    }
    if (before.size > BigInt(remainingBytes)) {
      return {
        ok: false,
        error: {
          code: "discovery-too-large",
          path: name,
          message: `Direct-child JSON discovery exceeds ${MAX_TOC_DISCOVERY_BYTES} bytes`
        }
      };
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (!sameFileState3(before, after) || BigInt(bytes.byteLength) !== before.size) {
      return {
        ok: false,
        error: {
          code: "descriptor-changed",
          path: name,
          message: "JSON descriptor candidate changed during discovery"
        }
      };
    }
    return {
      ok: true,
      value: {
        name,
        locator,
        byteLength: bytes.byteLength,
        bytes,
        schemaUri: schemaUriFrom(bytes)
      }
    };
  } catch (error) {
    const code = nodeErrorCode4(error);
    return {
      ok: false,
      error: {
        code: code === "ELOOP" ? "descriptor-not-regular" : "descriptor-unreadable",
        path: name,
        message: `JSON descriptor candidate cannot be read (${code ?? "unknown"})`
      }
    };
  } finally {
    await closeQuietly3(handle);
  }
}
function sortNames(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function chooseDescriptor(files) {
  const unsupported = files.filter(
    (file) => file.schemaUri !== void 0 && file.schemaUri !== SKILL_TOC_SCHEMA_URI && isKnownTocSchemaFamily(file.schemaUri)
  );
  if (unsupported.length > 0) {
    const first = unsupported[0];
    if (first === void 0)
      throw new Error("Unsupported descriptor invariant");
    return failure5(
      "unsupported-version",
      first.name,
      `Unsupported Skill TOC schema ${first.schemaUri}`,
      {
        descriptorNames: Object.freeze(unsupported.map(({ name }) => name)),
        schemaUri: first.schemaUri
      }
    );
  }
  const supported = files.filter(
    (file) => file.schemaUri === SKILL_TOC_SCHEMA_URI
  );
  if (supported.length === 0) {
    return Object.freeze({ status: "unstructured" });
  }
  if (supported.length > 1) {
    return failure5(
      "ambiguous-descriptor",
      "skillRootPath",
      "Skill root contains multiple canonical TOC descriptors",
      {
        descriptorNames: Object.freeze(supported.map(({ name }) => name))
      }
    );
  }
  const candidate = supported[0];
  if (candidate === void 0)
    throw new Error("Descriptor selection invariant");
  const parsed = parseTocBytes(candidate.bytes);
  if (!parsed.ok) {
    return failure5(
      "invalid-descriptor",
      candidate.name,
      `Recognized TOC descriptor is invalid: ${parsed.error.message}`,
      { parseError: Object.freeze({ ...parsed.error }) }
    );
  }
  return Object.freeze({
    status: "structured",
    descriptor: Object.freeze({
      name: candidate.name,
      locator: candidate.locator,
      byteLength: candidate.byteLength,
      toc: parsed.value
    })
  });
}
async function discoverTocDescriptor(skillRootPath) {
  const root = await resolveSkillRoot2(skillRootPath);
  if (!root.ok) {
    return Object.freeze({
      status: "failed",
      error: Object.freeze(root.error)
    });
  }
  let entries;
  try {
    entries = await readdir(root.value.physical, { withFileTypes: true });
  } catch (error) {
    return failure5(
      "root-unreadable",
      "skillRootPath",
      `Skill root cannot be listed (${nodeErrorCode4(error) ?? "unknown"})`
    );
  }
  const names = entries.flatMap(
    (entry) => entry.isFile() && entry.name.endsWith(".json") ? [entry.name] : []
  ).sort(sortNames);
  if (names.length > MAX_TOC_DISCOVERY_JSON_FILES) {
    return failure5(
      "too-many-json-files",
      "skillRootPath",
      `Skill root has more than ${MAX_TOC_DISCOVERY_JSON_FILES} direct-child JSON files`
    );
  }
  const files = [];
  let totalBytes = 0;
  for (const name of names) {
    const acquired = await acquireJsonFile(
      root.value,
      name,
      MAX_TOC_DISCOVERY_BYTES - totalBytes
    );
    if (!acquired.ok) {
      return Object.freeze({
        status: "failed",
        error: Object.freeze(acquired.error)
      });
    }
    totalBytes += acquired.value.byteLength;
    files.push(acquired.value);
  }
  return chooseDescriptor(files);
}

// src/action-loop/pi/discover-admitted-skill-toc.ts
async function discoverAdaptedSkillToc(candidate) {
  if (!candidate.supportsStructuredToc) {
    return Object.freeze({
      status: "unstructured",
      reason: "unsupported-skill-material",
      candidate
    });
  }
  const discovered = await discoverTocDescriptor(candidate.skillRootPath);
  if (discovered.status === "structured") {
    return Object.freeze({
      status: "structured",
      candidate,
      descriptor: discovered.descriptor
    });
  }
  if (discovered.status === "failed") {
    return Object.freeze({
      status: "failed",
      candidate,
      error: discovered.error
    });
  }
  return Object.freeze({
    status: "unstructured",
    reason: "descriptor-absent",
    candidate
  });
}

// src/action-loop/pi/catalog-pi-loaded-skills.ts
async function catalogBeforeAgentStartSkills(event) {
  const adapted = await adaptPiSkillCatalog(
    event.systemPromptOptions.skills ?? []
  );
  if (!adapted.ok) {
    return Object.freeze({
      status: "rejected",
      error: adapted.error
    });
  }
  const entries = [];
  for (const candidate of adapted.inventory) {
    entries.push(await discoverAdaptedSkillToc(candidate));
  }
  return Object.freeze({
    status: "catalogued",
    entries: Object.freeze(entries),
    excluded: adapted.excluded
  });
}

// src/action-loop/sdk/capability-inventory-controller.ts
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

// src/action-loop/sdk/capability-inventory-controller.ts
var applicabilityStatuses = [
  "applicable",
  "not-applicable",
  "needs-context"
];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApplicabilityStatus(value) {
  return applicabilityStatuses.some((status) => status === value);
}
function rejected(code, message) {
  return { status: "rejected", code, message };
}
function canonicalInventory(capabilities) {
  const seenNames = /* @__PURE__ */ new Set();
  const seenRevisions = /* @__PURE__ */ new Set();
  const canonical = [];
  for (const capability of capabilities) {
    const name = capability.name.trim();
    const revision = capability.entry.capability.capabilityRevisionId;
    if (!name || name.length > 128) {
      return {
        ok: false,
        message: "Capability names must be bounded and nonblank."
      };
    }
    if (seenNames.has(name) || seenRevisions.has(revision)) {
      return {
        ok: false,
        message: `Capability inventory contains a duplicate name or revision: ${name}`
      };
    }
    seenNames.add(name);
    seenRevisions.add(revision);
    canonical.push({ name, entry: capability.entry });
  }
  canonical.sort((left, right) => left.name.localeCompare(right.name));
  return { ok: true, value: Object.freeze(canonical) };
}
function inventoryParameters(capabilities) {
  const fields = {};
  for (const [index, { name, entry }] of capabilities.entries()) {
    const conditions = entry.routing === "structured" ? `when: ${entry.capability.toc.when.join(" | ")}; unless: ${entry.capability.toc.unless.join(" | ") || "none"}` : "unstructured Capability without declared conditions";
    fields[`status_${index}`] = StringEnum(applicabilityStatuses, {
      description: `${name} \u2014 ${conditions}`
    });
    fields[`basis_${index}`] = Type.String({
      minLength: 1,
      maxLength: 2048,
      description: `Why ${name} has this status for the current Contribution Need.`
    });
    fields[`missing_context_${index}`] = Type.Optional(
      Type.String({ maxLength: 2048 })
    );
    if (entry.routing !== "structured") continue;
    for (const [
      conditionIndex,
      condition
    ] of entry.capability.toc.when.entries()) {
      fields[`when_${index}_${conditionIndex}`] = Type.Boolean({
        description: `${name} when condition: ${condition}`
      });
    }
    for (const [
      conditionIndex,
      condition
    ] of entry.capability.toc.unless.entries()) {
      fields[`unless_${index}_${conditionIndex}`] = Type.Boolean({
        description: `${name} unless condition: ${condition}`
      });
    }
  }
  return Type.Object(fields, { additionalProperties: false });
}
function selectedConditions(input) {
  const selected = [];
  for (const [conditionIndex, condition] of input.conditions.entries()) {
    const field = `${input.prefix}_${input.capabilityIndex}_${conditionIndex}`;
    const value = input.raw[field];
    if (typeof value !== "boolean") {
      return { ok: false, message: `${field} must be boolean.` };
    }
    if (value) selected.push(condition);
  }
  return { ok: true, value: selected };
}
function inventoryTool(input) {
  return {
    name: "submit_capability_inventory",
    label: "Submit Capability inventory",
    description: "Disposition every admitted Capability for one Contribution Need. The controller owns all names, conditions, identities, and complete accounting.",
    parameters: inventoryParameters(input.capabilities),
    execute: async (raw) => {
      if (!isRecord(raw)) {
        return rejected(
          "invalid-arguments",
          "Capability inventory arguments must be an object."
        );
      }
      const dispositions = [];
      for (const [index, { name, entry }] of input.capabilities.entries()) {
        const status = raw[`status_${index}`];
        const basis = raw[`basis_${index}`];
        const missingContext = raw[`missing_context_${index}`];
        if (!isApplicabilityStatus(status) || typeof basis !== "string" || missingContext !== void 0 && typeof missingContext !== "string") {
          return rejected(
            "invalid-capability-disposition",
            `Capability ${name} requires canonical status_${index}, basis_${index}, and optional missing_context_${index}.`
          );
        }
        const matchedWhen = entry.routing === "structured" ? selectedConditions({
          raw,
          prefix: "when",
          capabilityIndex: index,
          conditions: entry.capability.toc.when
        }) : { ok: true, value: [] };
        if (!matchedWhen.ok) {
          return rejected("invalid-when-accounting", matchedWhen.message);
        }
        const matchedUnless = entry.routing === "structured" ? selectedConditions({
          raw,
          prefix: "unless",
          capabilityIndex: index,
          conditions: entry.capability.toc.unless
        }) : { ok: true, value: [] };
        if (!matchedUnless.ok) {
          return rejected("invalid-unless-accounting", matchedUnless.message);
        }
        const accepted = acceptCapabilityApplicability(
          {
            workCaseId: input.workCaseId,
            judgmentId: input.judgmentId,
            contributionNeedId: input.contributionNeedId,
            capability: entry.capability
          },
          {
            workCaseId: input.workCaseId,
            judgmentId: input.judgmentId,
            contributionNeedId: input.contributionNeedId,
            capabilityRevisionId: entry.capability.capabilityRevisionId,
            status,
            matchedWhen: matchedWhen.value,
            matchedUnless: matchedUnless.value,
            basis: [basis],
            missingContext: status === "needs-context" && missingContext?.trim() ? [missingContext.trim()] : []
          }
        );
        if (accepted.status === "invalid") {
          return rejected(
            accepted.error.code,
            `${name}: ${accepted.error.message}`
          );
        }
        dispositions.push({
          name,
          assessment: accepted.assessment,
          ...accepted.status === "assigned" ? { assignment: accepted.assignment } : {}
        });
      }
      return {
        status: "accepted",
        value: { dispositions: Object.freeze(dispositions) },
        message: "Complete Capability inventory accepted.",
        resultStatus: "assessed"
      };
    }
  };
}
function inventoryPrompt(input) {
  return [
    `Delegated request: ${input.request}`,
    `Contribution Need: ${input.contributionNeed}`,
    "Disposition every admitted Capability against this Need:",
    ...input.capabilities.map(
      ({ name, entry }, index) => entry.routing === "structured" ? `[${index}] ${name}; when: ${entry.capability.toc.when.join(" | ")}; unless: ${entry.capability.toc.unless.join(" | ") || "none"}` : `[${index}] ${name}; unstructured Capability`
    ),
    "Use needs-context rather than guessing. Adjacent subject matter is not applicability."
  ].join("\n");
}
async function assessCapabilityInventoryWithSdk(input) {
  const inventory = canonicalInventory(input.capabilities);
  if (!inventory.ok) {
    return { status: "invalid-inventory", message: inventory.message };
  }
  if (inventory.value.length === 0) {
    return {
      status: "assessed",
      dispositions: Object.freeze([]),
      assignments: Object.freeze([])
    };
  }
  const decision = await input.runner.run({
    systemPrompt: [
      "Make one complete comparative Capability applicability proposal.",
      "Call the supplied tool exactly once and account for every Capability.",
      "The SDK controller owns inventory, exact conditions, identities, validation, retries, and atomic admission."
    ].join("\n"),
    prompt: inventoryPrompt({
      request: input.request,
      contributionNeed: input.contributionNeed,
      capabilities: inventory.value
    }),
    tool: inventoryTool({
      workCaseId: input.workCaseId,
      judgmentId: input.judgmentId,
      contributionNeedId: input.contributionNeedId,
      capabilities: inventory.value
    })
  });
  if (decision.status === "accepted") {
    return {
      status: "assessed",
      dispositions: decision.value.dispositions,
      assignments: Object.freeze(
        decision.value.dispositions.flatMap(
          ({ assignment }) => assignment === void 0 ? [] : [assignment]
        )
      ),
      decision: decision.metrics
    };
  }
  if (decision.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      reason: decision.reason,
      decision: decision.metrics
    };
  }
  return {
    status: "runtime-failure",
    message: decision.message,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/capability-routing-controller.ts
import { StringEnum as StringEnum2 } from "@earendil-works/pi-ai";
import { Type as Type2 } from "typebox";

// src/action-loop/routing/bind-reference-selection.ts
var REFERENCE_SELECTION_VERSION = "developer-reference-selection/v1";
function failure6(code, path, message) {
  return { ok: false, error: { code, path, message } };
}
function checkAssignment(assignment, capability) {
  if (assignment.capabilityId !== capability.capabilityId) {
    return failure6(
      "assignment-capability-mismatch",
      "assignment.capabilityId",
      "Assignment belongs to another Capability"
    );
  }
  if (assignment.capabilityRevisionId !== capability.capabilityRevisionId) {
    return failure6(
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
    return failure6(
      "declaration-mismatch",
      "selection.dispositions",
      "Selection must disposition the current TOC Reference inventory"
    );
  }
  for (let index = 0; index < declared.length; index += 1) {
    if (dispositions[index]?.path !== declared[index]?.path) {
      return failure6(
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
    return failure6(
      "selection-invariant-failed",
      "selection.selectedPaths",
      "Selected paths must be derived from ordered dispositions"
    );
  }
  if (selection.status === "ready" && derived.unresolved.length > 0) {
    return failure6(
      "selection-invariant-failed",
      "selection.status",
      "Ready selection cannot contain needs-context dispositions"
    );
  }
  if (selection.status === "needs-context" && derived.unresolved.length === 0) {
    return failure6(
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
  const assignmentFailure2 = checkAssignment(assignment, capability);
  if (assignmentFailure2 !== void 0) return assignmentFailure2;
  if (selection.status === "invalid") {
    return failure6(
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
var applicabilityParameters = Type2.Object(
  {
    status: StringEnum2([
      "applicable",
      "not-applicable",
      "needs-context"
    ]),
    matches_when: Type2.Boolean(),
    matches_unless: Type2.Boolean(),
    basis: Type2.String({ minLength: 1, maxLength: 2048 }),
    missing_context: Type2.Optional(Type2.String({ maxLength: 2048 }))
  },
  { additionalProperties: false }
);
var referenceStatuses = ["selected", "not-needed", "needs-context"];
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApplicabilityStatus2(value) {
  return value === "applicable" || value === "not-applicable" || value === "needs-context";
}
function isReferenceStatus(value) {
  return value === "selected" || value === "not-needed" || value === "needs-context";
}
function rejected2(code, message) {
  return { status: "rejected", code, message };
}
function applicabilityTool(target, toc) {
  return {
    name: "submit_capability_applicability",
    label: "Submit capability applicability",
    description: "Submit one semantic applicability decision; the SDK controller supplies exact canonical conditions and identities.",
    parameters: applicabilityParameters,
    execute: async (raw) => {
      if (!isRecord2(raw)) {
        return rejected2(
          "invalid-arguments",
          "Applicability arguments must be an object."
        );
      }
      if (!isApplicabilityStatus2(raw.status) || typeof raw.matches_when !== "boolean" || typeof raw.matches_unless !== "boolean" || typeof raw.basis !== "string" || raw.missing_context !== void 0 && typeof raw.missing_context !== "string") {
        return rejected2(
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
        return rejected2(result.error.code, result.error.message);
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
    fields[`status_${index}`] = StringEnum2(referenceStatuses, {
      description: `${reference.path} \u2014 ${reference.when.join(" | ")}`
    });
    fields[`basis_${index}`] = Type2.String({
      minLength: 1,
      maxLength: 2048,
      description: `Why ${reference.path} is selected, not needed, or needs context relative to every other declared Reference.`
    });
  }
  return Type2.Object(fields, { additionalProperties: false });
}
function referenceTool(toc) {
  return {
    name: "submit_reference_dispositions",
    label: "Submit comparative Reference dispositions",
    description: "Disposition every declared Reference in one comparative proposal; the SDK controller maps flat fields to canonical paths.",
    parameters: referenceParameters(toc),
    execute: async (raw) => {
      if (!isRecord2(raw)) {
        return rejected2(
          "invalid-arguments",
          "Reference arguments must be an object."
        );
      }
      const dispositions = [];
      for (const [index, reference] of toc.references.entries()) {
        const status = raw[`status_${index}`];
        const basis = raw[`basis_${index}`];
        if (!isReferenceStatus(status) || typeof basis !== "string") {
          return rejected2(
            "invalid-reference-disposition",
            `Reference disposition ${index} requires canonical status_${index} and non-empty basis_${index}.`
          );
        }
        dispositions.push({ path: reference.path, status, basis: [basis] });
      }
      const selected = selectDeclaredReferences(toc.references, dispositions);
      if (selected.status === "invalid") {
        return rejected2(
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
async function selectStructuredReferencesWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Make one comparative local Reference routing proposal.",
      "Call the supplied decision tool exactly once and disposition every declared Reference.",
      "Choose the smallest set whose declared conditions materially apply; adjacent subject matter alone is not enough.",
      "The SDK controller owns exact paths, complete inventory, validation, retry limits, and canonical binding."
    ].join("\n"),
    prompt: routingPrompt(input.request, input.toc),
    tool: referenceTool(input.toc)
  });
  if (decision.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      reason: decision.reason,
      decision: decision.metrics
    };
  }
  if (decision.status === "runtime-failure") {
    return {
      status: "runtime-failure",
      message: decision.message,
      decision: decision.metrics
    };
  }
  const selection = selectDeclaredReferences(
    input.toc.references,
    decision.value.dispositions
  );
  if (selection.status === "invalid") {
    return {
      status: "invariant-failure",
      code: "accepted-selection-became-invalid",
      message: "An accepted Reference proposal did not reproduce its canonical selection.",
      decision: decision.metrics
    };
  }
  const bound = bindReferenceSelection(
    input.assignment,
    input.capability,
    selection
  );
  if (!bound.ok) {
    return {
      status: "invariant-failure",
      code: bound.error.code,
      message: bound.error.message,
      decision: decision.metrics
    };
  }
  return {
    status: "selected",
    selection: bound.value,
    decision: decision.metrics
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
  const references = await selectStructuredReferencesWithSdk({
    request: input.request,
    assignment: applicability.value.result.assignment,
    capability: input.target.capability,
    toc: input.toc,
    runner: input.runner
  });
  decisions.push({ stage: "references", metrics: references.decision });
  if (references.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      stage: "references",
      reason: references.reason,
      decisions: Object.freeze(decisions)
    };
  }
  if (references.status === "runtime-failure") {
    return {
      status: "runtime-failure",
      stage: "references",
      message: references.message,
      decisions: Object.freeze(decisions)
    };
  }
  if (references.status === "invariant-failure") {
    return {
      status: "invariant-failure",
      stage: "references",
      code: references.code,
      message: references.message,
      decisions: Object.freeze(decisions)
    };
  }
  return {
    status: "routed",
    applicability: applicability.value.result,
    selection: references.selection,
    decisions: Object.freeze(decisions)
  };
}

// src/action-loop/sdk/context-sealing-controller.ts
function assignmentFailure(input) {
  if (input.assignment.capabilityId !== input.entry.capability.capabilityId || input.assignment.capabilityRevisionId !== input.entry.capability.capabilityRevisionId) {
    return {
      status: "invariant-failure",
      stage: "assignment",
      code: "assignment-capability-mismatch",
      message: "Assignment does not belong to the supplied Capability revision.",
      decisions: Object.freeze([])
    };
  }
  return void 0;
}
async function sealCapabilityContextWithSdk(input) {
  const mismatch = assignmentFailure(input);
  if (mismatch !== void 0) return mismatch;
  if (input.entry.routing === "unstructured") {
    const sealed2 = await sealUnstructuredSkillContext({
      skillFilePath: input.entry.candidate.skillFilePath,
      capability: input.entry.capability,
      assignment: input.assignment
    });
    if (sealed2.ok) {
      return {
        status: "sealed",
        context: sealed2.value,
        decisions: Object.freeze([])
      };
    }
    return {
      status: "seal-failure",
      code: sealed2.error.code,
      message: sealed2.error.message,
      decisions: Object.freeze([])
    };
  }
  const routed = await selectStructuredReferencesWithSdk({
    request: input.request,
    assignment: input.assignment,
    capability: input.entry.capability,
    toc: input.entry.capability.toc,
    runner: input.runner
  });
  const decisions = Object.freeze([
    { stage: "references", metrics: routed.decision }
  ]);
  if (routed.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      stage: "references",
      reason: routed.reason,
      decisions
    };
  }
  if (routed.status === "runtime-failure") {
    return {
      status: "runtime-failure",
      stage: "references",
      message: routed.message,
      decisions
    };
  }
  if (routed.status === "invariant-failure") {
    return {
      status: "invariant-failure",
      stage: "references",
      code: routed.code,
      message: routed.message,
      decisions
    };
  }
  if (routed.selection.status === "needs-context") {
    return {
      status: "needs-context",
      selection: routed.selection,
      decisions
    };
  }
  const sealed = await sealSkillContext({
    skillRootPath: input.entry.candidate.skillRootPath,
    capability: input.entry.capability,
    assignment: input.assignment,
    selection: routed.selection
  });
  if (!sealed.ok) {
    return {
      status: "seal-failure",
      code: sealed.error.code,
      message: sealed.error.message,
      decisions
    };
  }
  return {
    status: "sealed",
    context: sealed.value,
    selection: routed.selection,
    decisions
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
    timeBudgetStops: counters.timeBudgetStops,
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
    if (event.type !== "tool_execution_end" || event.toolName !== input.toolName) {
      return;
    }
    if (!event.isError) {
      if (input.accepted()) void input.session.abort();
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
  let timeout;
  let timedOut = false;
  let runtimeError;
  try {
    session = await createDecisionSession(input.options, input.request, tool);
    unsubscribe = subscribeToAttempt({
      session,
      toolName: input.request.tool.name,
      maximumErrors: input.maximumErrors,
      counters: input.counters,
      observation,
      accepted: () => acceptedProposal !== void 0
    });
    timeout = setTimeout(() => {
      timedOut = true;
      input.counters.timeBudgetStops += 1;
      input.counters.errorMessages.push(
        `runtime: decision time budget ${input.maximumRunMs}ms`
      );
      void session?.abort();
    }, input.maximumRunMs);
    await session.prompt(input.request.prompt);
    input.counters.nonRuntimeRuns += 1;
  } catch (error) {
    if (acceptedProposal !== void 0 || timedOut || observation.toolErrors >= input.maximumErrors) {
      input.counters.nonRuntimeRuns += 1;
    } else {
      input.counters.runtimeFailures += 1;
      runtimeError = compactError(error);
      input.counters.errorMessages.push(`runtime: ${runtimeError}`);
    }
  } finally {
    if (timeout !== void 0) clearTimeout(timeout);
    unsubscribe?.();
    session?.dispose();
  }
  if (acceptedProposal !== void 0) {
    return { status: "accepted", value: acceptedProposal.value };
  }
  if (timedOut) return { status: "timed-out" };
  return runtimeError === void 0 ? { status: "not-accepted" } : { status: "runtime-failure", message: runtimeError };
}
async function runBoundedDecision(options, request, maximumRuns, maximumErrors, maximumRunMs) {
  const counters = {
    runs: 0,
    toolCalls: 0,
    toolErrors: 0,
    runtimeFailures: 0,
    timeBudgetStops: 0,
    nonRuntimeRuns: 0,
    errorMessages: []
  };
  let lastRuntimeError;
  let lastAttemptTimedOut = false;
  for (let run = 1; run <= maximumRuns; run += 1) {
    counters.runs = run;
    const attempt = await runDecisionAttempt({
      options,
      request,
      maximumErrors,
      maximumRunMs,
      counters
    });
    if (attempt.status === "accepted") {
      return {
        status: "accepted",
        value: attempt.value,
        metrics: currentMetrics(counters)
      };
    }
    lastAttemptTimedOut = attempt.status === "timed-out";
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
    reason: lastAttemptTimedOut ? "decision-time-budget" : "decision-run-budget",
    metrics: currentMetrics(counters)
  };
}
function createPiSdkDecisionRunner(options) {
  const maximumRuns = positiveInteger(options.maxRuns, "maxRuns");
  const maximumErrors = positiveInteger(
    options.maxToolErrorsPerRun,
    "maxToolErrorsPerRun"
  );
  const maximumRunMs = positiveInteger(
    options.maxRunMs ?? 12e4,
    "maxRunMs"
  );
  return Object.freeze({
    run: (request) => runBoundedDecision(
      options,
      request,
      maximumRuns,
      maximumErrors,
      maximumRunMs
    )
  });
}

// src/action-loop/sdk/judgment-controller.ts
import { StringEnum as StringEnum3 } from "@earendil-works/pi-ai";
import { Type as Type3 } from "typebox";

// src/action-loop/judgment/open-judgment.ts
var OPEN_JUDGMENT_VERSION = "developer-open-judgment/v1";
var CATEGORIES = /* @__PURE__ */ new Set([
  "Contextual Adequacy",
  "Proportionate Intervention",
  "Consequence Integrity",
  "Claim Assurance"
]);
var PROVENANCE_KINDS = /* @__PURE__ */ new Set(["model", "human", "tool", "external"]);
var MAX_TEXT_LENGTH = 4096;
var MAX_REQUIREMENTS = 32;
var MAX_NEEDS_PER_REQUIREMENT = 32;
var MAX_BASIS_ITEMS = 16;
function invalid2(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId2(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim() && value.length <= MAX_TEXT_LENGTH && !value.includes("\0");
}
function canonicalText2(value, path) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: {
        code: "invalid-text",
        path,
        message: "Expected a bounded nonblank string"
      }
    };
  }
  return { ok: true, value: text };
}
function canonicalStrings(values, path, maximumItems, allowEmpty = false) {
  if (!Array.isArray(values) || values.length > maximumItems || !allowEmpty && values.length === 0) {
    const code = path === "proposal.basis" ? "invalid-basis" : "invalid-contribution-needs";
    return {
      ok: false,
      error: {
        code,
        path,
        message: "Expected a bounded list of nonblank unique values"
      }
    };
  }
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const text = canonicalText2(values[index], `${path}[${index}]`);
    if (!text.ok) return text;
    if (seen.has(text.value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Value duplicates an earlier normalized value"
        }
      };
    }
    seen.add(text.value);
    normalized.push(text.value);
  }
  normalized.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalRequirements(proposals) {
  if (!Array.isArray(proposals) || proposals.length === 0 || proposals.length > MAX_REQUIREMENTS) {
    return {
      ok: false,
      error: {
        code: "invalid-requirements",
        path: "proposal.requirements",
        message: "Expected at least one bounded Closure Requirement"
      }
    };
  }
  const requirements = [];
  const statements = /* @__PURE__ */ new Set();
  for (let index = 0; index < proposals.length; index += 1) {
    const proposal = proposals[index];
    if (proposal === void 0 || typeof proposal !== "object") {
      return {
        ok: false,
        error: {
          code: "invalid-requirements",
          path: `proposal.requirements[${index}]`,
          message: "Expected a Closure Requirement proposal"
        }
      };
    }
    const statement = canonicalText2(
      proposal.statement,
      `proposal.requirements[${index}].statement`
    );
    if (!statement.ok) return statement;
    if (statements.has(statement.value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `proposal.requirements[${index}].statement`,
          message: "Closure Requirement duplicates an earlier statement"
        }
      };
    }
    const needs = canonicalStrings(
      proposal.contributionNeeds,
      `proposal.requirements[${index}].contributionNeeds`,
      MAX_NEEDS_PER_REQUIREMENT
    );
    if (!needs.ok) return needs;
    statements.add(statement.value);
    requirements.push(
      Object.freeze({
        statement: statement.value,
        contributionNeeds: needs.value
      })
    );
  }
  requirements.sort(
    (left, right) => left.statement.localeCompare(right.statement)
  );
  return { ok: true, value: Object.freeze(requirements) };
}
function openJudgment(proposal) {
  if (!validId2(proposal.workCaseId) || !validId2(proposal.contextRevisionId)) {
    return invalid2(
      "invalid-id",
      "proposal",
      "Expected canonical Work Case and Context revision IDs"
    );
  }
  if (!CATEGORIES.has(proposal.category)) {
    return invalid2(
      "unsupported-category",
      "proposal.category",
      "Unsupported Judgment Category"
    );
  }
  const subject = canonicalText2(proposal.subject, "proposal.subject");
  if (!subject.ok) return { status: "invalid", error: subject.error };
  const question = canonicalText2(proposal.question, "proposal.question");
  if (!question.ok) return { status: "invalid", error: question.error };
  const canonical = canonicalRequirements(proposal.requirements);
  if (!canonical.ok) return { status: "invalid", error: canonical.error };
  const basis = canonicalStrings(
    proposal.basis,
    "proposal.basis",
    MAX_BASIS_ITEMS
  );
  if (!basis.ok) return { status: "invalid", error: basis.error };
  if (typeof proposal.provenance !== "object" || proposal.provenance === null || !PROVENANCE_KINDS.has(proposal.provenance.kind) || !validId2(proposal.provenance.source)) {
    return invalid2(
      "invalid-provenance",
      "proposal.provenance",
      "Expected bounded supported proposal provenance"
    );
  }
  const identityParts2 = [
    proposal.workCaseId,
    proposal.category,
    subject.value,
    question.value,
    proposal.contextRevisionId,
    "requirements",
    ...canonical.value.flatMap(({ statement, contributionNeeds: contributionNeeds2 }) => [
      statement,
      "needs",
      String(contributionNeeds2.length),
      ...contributionNeeds2
    ])
  ];
  const judgmentId = hashIdentity(
    "open_judgment",
    OPEN_JUDGMENT_VERSION,
    identityParts2
  );
  const contributionNeeds = [];
  const requirements = canonical.value.map(
    ({ statement, contributionNeeds: needFunctions }) => {
      const requirementId = hashIdentity(
        "closure_requirement",
        OPEN_JUDGMENT_VERSION,
        [judgmentId, statement]
      );
      const contributionNeedIds = needFunctions.map((needFunction) => {
        const contributionNeedId = hashIdentity(
          "contribution_need",
          OPEN_JUDGMENT_VERSION,
          [requirementId, needFunction]
        );
        contributionNeeds.push(
          Object.freeze({
            contributionNeedId,
            requirementId,
            function: needFunction
          })
        );
        return contributionNeedId;
      });
      contributionNeedIds.sort((left, right) => left.localeCompare(right));
      return Object.freeze({
        requirementId,
        statement,
        contributionNeedIds: Object.freeze(contributionNeedIds)
      });
    }
  );
  contributionNeeds.sort(
    (left, right) => left.contributionNeedId.localeCompare(right.contributionNeedId)
  );
  return {
    status: "opened",
    value: Object.freeze({
      workCaseId: proposal.workCaseId,
      judgmentId,
      category: proposal.category,
      subject: subject.value,
      question: question.value,
      contextRevisionId: proposal.contextRevisionId,
      requirements: Object.freeze(requirements),
      contributionNeeds: Object.freeze(contributionNeeds),
      basis: basis.value,
      provenance: Object.freeze({
        kind: proposal.provenance.kind,
        source: proposal.provenance.source
      }),
      status: "open"
    })
  };
}

// src/action-loop/work/work-case.ts
var OUTCOME_VERSION = "developer-outcome/v1";
var WORK_CASE_VERSION = "developer-work-case/v1";
var WORK_CASE_REVISION_VERSION = "developer-work-case-revision/v1";
var PROVENANCE_KINDS2 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid3(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText3(value, code, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      error: { code, path, message: "Expected a nonblank string" }
    };
  }
  return { ok: true, value: value.trim() };
}
function canonicalList(values, contract) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      error: {
        code: contract.invalidCode,
        path: contract.path,
        message: "Expected a list"
      }
    };
  }
  if (contract.emptyCode !== void 0 && values.length === 0) {
    return {
      ok: false,
      error: {
        code: contract.emptyCode,
        path: contract.path,
        message: "Expected at least one acceptance condition"
      }
    };
  }
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length === 0) {
      return {
        ok: false,
        error: {
          code: contract.invalidCode,
          path: `${contract.path}[${index}]`,
          message: "Expected a nonblank value"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${contract.path}[${index}]`,
          message: "Value duplicates an earlier normalized value"
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalProvenance(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS2.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Work Case provenance kind"
      }
    };
  }
  const source = canonicalText3(
    provenance.source,
    "invalid-provenance",
    "proposal.provenance.source"
  );
  if (!source.ok) return source;
  return {
    ok: true,
    value: Object.freeze({ kind: provenance.kind, source: source.value })
  };
}
function sortedIds(ids) {
  return [...ids].sort((left, right) => left.localeCompare(right));
}
function deriveWorkCaseRevisionId(state) {
  const assessmentIds = state.currentEffectAssessments.map(
    (assessment) => "effectSettlementId" in assessment ? assessment.effectSettlementId : assessment.effectAssessmentId
  );
  return hashIdentity("work_case_revision", WORK_CASE_REVISION_VERSION, [
    state.workCaseId,
    "open-judgments",
    String(state.openJudgments.length),
    ...sortedIds(state.openJudgments.map(({ judgmentId }) => judgmentId)),
    "conclusions",
    String(state.conclusions.length),
    ...sortedIds(state.conclusions.map(({ conclusionId }) => conclusionId)),
    "action-candidates",
    String(state.actionCandidates.length),
    ...sortedIds(
      state.actionCandidates.map(({ actionCandidateId }) => actionCandidateId)
    ),
    "action-clearances",
    String(state.actionClearances.length),
    ...sortedIds(
      state.actionClearances.map(({ actionClearanceId }) => actionClearanceId)
    ),
    "effects",
    String(state.effects.length),
    ...sortedIds(state.effects.map(({ effectId }) => effectId)),
    "current-effect-assessments",
    String(assessmentIds.length),
    ...sortedIds(assessmentIds),
    "effect-remediations",
    String(state.effectRemediations.length),
    ...sortedIds(
      state.effectRemediations.map(
        ({ effectRemediationId }) => effectRemediationId
      )
    ),
    "continuity",
    String(state.continuityIds.length),
    ...state.continuityIds
  ]);
}
function firstDuplicateId(ids) {
  const seen = /* @__PURE__ */ new Set();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return void 0;
}
function sameStrings2(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function duplicateInventoryIssue(workCase) {
  const collections = [
    [
      "openJudgments",
      workCase.openJudgments.map(({ judgmentId }) => judgmentId)
    ],
    [
      "conclusions",
      workCase.conclusions.map(({ conclusionId }) => conclusionId)
    ],
    [
      "actionCandidates",
      workCase.actionCandidates.map(
        ({ actionCandidateId }) => actionCandidateId
      )
    ],
    [
      "actionClearances",
      workCase.actionClearances.map(
        ({ actionClearanceId }) => actionClearanceId
      )
    ],
    ["effects", workCase.effects.map(({ effectId }) => effectId)],
    [
      "currentEffectAssessments",
      workCase.currentEffectAssessments.map(({ effectId }) => effectId)
    ],
    [
      "effectRemediations",
      workCase.effectRemediations.map(
        ({ effectRemediationId }) => effectRemediationId
      )
    ],
    [
      "remediatedAdverseEffects",
      workCase.effectRemediations.map(({ adverseEffectId }) => adverseEffectId)
    ],
    ["continuityIds", workCase.continuityIds]
  ];
  for (const [path, ids] of collections) {
    const duplicateId = firstDuplicateId(ids);
    if (duplicateId !== void 0) {
      return {
        code: "duplicate-record",
        path: `workCase.${path}`,
        message: `Duplicate canonical record: ${duplicateId}`
      };
    }
  }
  return void 0;
}
function judgmentInventoryIssue(workCase) {
  const mismatched = workCase.openJudgments.find(
    ({ workCaseId }) => workCaseId !== workCase.workCaseId
  );
  return mismatched === void 0 ? void 0 : {
    code: "identity-mismatch",
    path: "workCase.openJudgments",
    message: `Judgment belongs to another Work Case: ${mismatched.judgmentId}`
  };
}
function conclusionInventoryIssue(workCase) {
  const mismatched = workCase.conclusions.find(
    ({ workCaseId }) => workCaseId !== workCase.workCaseId
  );
  return mismatched === void 0 ? void 0 : {
    code: "identity-mismatch",
    path: "workCase.conclusions",
    message: `Conclusion belongs to another Work Case: ${mismatched.conclusionId}`
  };
}
function candidateInventoryIssue(workCase, conclusions) {
  const invalid5 = workCase.actionCandidates.find(
    (candidate) => candidate.workCaseId !== workCase.workCaseId || candidate.requiredConclusionIds.some((id) => !conclusions.has(id))
  );
  return invalid5 === void 0 ? void 0 : {
    code: "missing-dependency",
    path: "workCase.actionCandidates",
    message: `Action Candidate has a missing Work Case dependency: ${invalid5.actionCandidateId}`
  };
}
function clearanceInventoryIssue(workCase, conclusions, candidates) {
  for (const clearance of workCase.actionClearances) {
    const candidate = candidates.get(clearance.actionCandidateId);
    if (clearance.workCaseId !== workCase.workCaseId || candidate === void 0 || clearance.conclusionIds.some((id) => !conclusions.has(id)) || candidate.controlledAction.kind !== clearance.controlledAction.kind || candidate.controlledAction.fingerprint !== clearance.controlledAction.fingerprint || !sameStrings2(candidate.intendedEffects, clearance.intendedEffects)) {
      return {
        code: "missing-dependency",
        path: "workCase.actionClearances",
        message: `Action Clearance has a missing or changed dependency: ${clearance.actionClearanceId}`
      };
    }
  }
  return void 0;
}
function effectInventoryIssue(workCase, clearances) {
  for (const effect of workCase.effects) {
    const clearance = clearances.get(effect.actionClearanceId);
    if (effect.workCaseId !== workCase.workCaseId || clearance === void 0 || clearance.actionCandidateId !== effect.actionCandidateId || clearance.controlledAction.kind !== effect.controlledAction.kind || clearance.controlledAction.fingerprint !== effect.controlledAction.fingerprint || !sameStrings2(clearance.intendedEffects, effect.intendedEffects)) {
      return {
        code: "missing-dependency",
        path: "workCase.effects",
        message: `Effect has a missing or changed dependency: ${effect.effectId}`
      };
    }
  }
  return void 0;
}
function assessmentInventoryIssue(workCase, effects) {
  for (const assessment of workCase.currentEffectAssessments) {
    const effect = effects.get(assessment.effectId);
    if (assessment.workCaseId !== workCase.workCaseId || effect === void 0 || effect.actionClearanceId !== assessment.actionClearanceId || effect.occurrenceId !== assessment.occurrenceId) {
      return {
        code: "missing-dependency",
        path: "workCase.currentEffectAssessments",
        message: `Effect assessment has a missing or changed Effect: ${assessment.effectId}`
      };
    }
  }
  return void 0;
}
function remediationInventoryIssue(workCase, assessments) {
  for (const remediation of workCase.effectRemediations) {
    const adverse = assessments.get(remediation.adverseEffectId);
    const resolving = assessments.get(remediation.remediationEffectId);
    if (remediation.workCaseId !== workCase.workCaseId || adverse === void 0 || resolving === void 0 || !("effectSettlementId" in adverse) || !("effectSettlementId" in resolving) || adverse.effectSettlementId !== remediation.adverseEffectSettlementId || resolving.effectSettlementId !== remediation.remediationEffectSettlementId || adverse.outcome !== "failed" && adverse.outcome !== "partially-applied" || resolving.outcome !== "observed-success" || adverse.effectId === resolving.effectId) {
      return {
        code: "missing-dependency",
        path: "workCase.effectRemediations",
        message: `Effect remediation has a missing, changed, or ineligible assessment: ${remediation.effectRemediationId}`
      };
    }
  }
  return void 0;
}
function workCaseInventoryIssue(workCase) {
  const duplicateIssue = duplicateInventoryIssue(workCase);
  if (duplicateIssue !== void 0) return duplicateIssue;
  const judgmentIssue = judgmentInventoryIssue(workCase);
  if (judgmentIssue !== void 0) return judgmentIssue;
  const conclusionIssue = conclusionInventoryIssue(workCase);
  if (conclusionIssue !== void 0) return conclusionIssue;
  const conclusions = new Set(
    workCase.conclusions.map(({ conclusionId }) => conclusionId)
  );
  const candidateIssue = candidateInventoryIssue(workCase, conclusions);
  if (candidateIssue !== void 0) return candidateIssue;
  const candidates = new Map(
    workCase.actionCandidates.map((candidate) => [
      candidate.actionCandidateId,
      candidate
    ])
  );
  const clearanceIssue = clearanceInventoryIssue(
    workCase,
    conclusions,
    candidates
  );
  if (clearanceIssue !== void 0) return clearanceIssue;
  const clearances = new Map(
    workCase.actionClearances.map((clearance) => [
      clearance.actionClearanceId,
      clearance
    ])
  );
  const effectIssue = effectInventoryIssue(workCase, clearances);
  if (effectIssue !== void 0) return effectIssue;
  const effects = new Map(
    workCase.effects.map((effect) => [effect.effectId, effect])
  );
  const assessmentIssue = assessmentInventoryIssue(workCase, effects);
  if (assessmentIssue !== void 0) return assessmentIssue;
  const assessments = new Map(
    workCase.currentEffectAssessments.map((assessment) => [
      assessment.effectId,
      assessment
    ])
  );
  return remediationInventoryIssue(workCase, assessments);
}
function openWorkCase(proposal) {
  if (typeof proposal.outcome !== "object" || proposal.outcome === null) {
    return invalid3("empty-outcome", "proposal.outcome", "Expected an Outcome");
  }
  const statement = canonicalText3(
    proposal.outcome.statement,
    "empty-outcome",
    "proposal.outcome.statement"
  );
  if (!statement.ok) return { status: "invalid", error: statement.error };
  const acceptanceConditions = canonicalList(
    proposal.outcome.acceptanceConditions,
    {
      path: "proposal.outcome.acceptanceConditions",
      emptyCode: "missing-acceptance-condition",
      invalidCode: "invalid-acceptance-condition"
    }
  );
  if (!acceptanceConditions.ok) {
    return { status: "invalid", error: acceptanceConditions.error };
  }
  const constraints = canonicalList(proposal.outcome.constraints, {
    path: "proposal.outcome.constraints",
    invalidCode: "invalid-constraint"
  });
  if (!constraints.ok) return { status: "invalid", error: constraints.error };
  const provenance = canonicalProvenance(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const outcomeId = hashIdentity("outcome", OUTCOME_VERSION, [
    statement.value,
    "acceptance-conditions",
    String(acceptanceConditions.value.length),
    ...acceptanceConditions.value,
    "constraints",
    String(constraints.value.length),
    ...constraints.value
  ]);
  const outcome = Object.freeze({
    outcomeId,
    statement: statement.value,
    acceptanceConditions: acceptanceConditions.value,
    constraints: constraints.value
  });
  const workCaseId = hashIdentity("work_case", WORK_CASE_VERSION, [outcomeId]);
  const revisionId = deriveWorkCaseRevisionId({
    workCaseId,
    openJudgments: [],
    conclusions: [],
    actionCandidates: [],
    actionClearances: [],
    effects: [],
    currentEffectAssessments: [],
    effectRemediations: [],
    continuityIds: []
  });
  return {
    status: "opened",
    value: Object.freeze({
      workCaseId,
      revisionId,
      outcome,
      status: "active",
      openJudgments: Object.freeze([]),
      conclusions: Object.freeze([]),
      actionCandidates: Object.freeze([]),
      actionClearances: Object.freeze([]),
      effects: Object.freeze([]),
      currentEffectAssessments: Object.freeze([]),
      effectRemediations: Object.freeze([]),
      continuityIds: Object.freeze([]),
      provenance: provenance.value
    })
  };
}

// src/action-loop/work/record-work-case-judgment.ts
function invalid4(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function recordWorkCaseJudgment(workCase, judgment) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return invalid4(
      "stale-work-case",
      "workCase.revisionId",
      "Work Case revision does not match its closure inventory"
    );
  }
  if (workCaseInventoryIssue(workCase) !== void 0) {
    return invalid4(
      "invalid-work-case-inventory",
      "workCase",
      "Work Case closure inventory is relationally incoherent"
    );
  }
  if (judgment.workCaseId !== workCase.workCaseId) {
    return invalid4(
      "identity-mismatch",
      "judgment.workCaseId",
      "Judgment belongs to another Work Case"
    );
  }
  if (workCase.conclusions.some(
    ({ judgmentId }) => judgmentId === judgment.judgmentId
  )) {
    return invalid4(
      "judgment-already-concluded",
      "judgment.judgmentId",
      "A Conclusion already closes this Judgment"
    );
  }
  if (workCase.openJudgments.some(
    ({ judgmentId }) => judgmentId === judgment.judgmentId
  )) {
    return { status: "unchanged", value: workCase };
  }
  const openJudgments = Object.freeze(
    [...workCase.openJudgments, judgment].sort(
      (left, right) => left.judgmentId.localeCompare(right.judgmentId)
    )
  );
  const nextState = { ...workCase, openJudgments };
  return {
    status: "recorded",
    value: Object.freeze({
      ...nextState,
      revisionId: deriveWorkCaseRevisionId(nextState)
    })
  };
}

// src/action-loop/sdk/proposal-json.ts
var MAX_SDK_PROPOSAL_JSON_CHARS = 32768;
function decodeSdkProposalJson(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SDK_PROPOSAL_JSON_CHARS) {
    return {
      ok: false,
      message: `${label} must be non-empty JSON text within ${MAX_SDK_PROPOSAL_JSON_CHARS} characters.`
    };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return {
      ok: false,
      message: `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function decodeSdkStringList(input) {
  const decoded = decodeSdkProposalJson(input.value, input.label);
  if (!decoded.ok) return decoded;
  if (!Array.isArray(decoded.value) || decoded.value.length > input.maximumItems || !input.allowEmpty && decoded.value.length === 0 || decoded.value.some((item) => typeof item !== "string")) {
    return {
      ok: false,
      message: `${input.label} must encode ${input.allowEmpty ? "zero or more" : "one or more"} strings and at most ${input.maximumItems} items.`
    };
  }
  return { ok: true, value: decoded.value };
}

// src/action-loop/sdk/judgment-controller.ts
var categories = [
  "Contextual Adequacy",
  "Proportionate Intervention",
  "Consequence Integrity",
  "Claim Assurance"
];
var MAX_REQUIREMENTS2 = 8;
var MAX_NEEDS_PER_REQUIREMENT2 = 8;
var MAX_BASIS_ITEMS2 = 16;
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected3(code, message) {
  return { status: "rejected", code, message };
}
function isCategory(value) {
  return categories.some((category) => category === value);
}
function decodeRequirements(value) {
  const decoded = decodeSdkProposalJson(value, "requirements_json");
  if (!decoded.ok || !Array.isArray(decoded.value) || decoded.value.length === 0 || decoded.value.length > MAX_REQUIREMENTS2) {
    return {
      ok: false,
      message: decoded.ok ? `requirements_json must encode 1-${MAX_REQUIREMENTS2} Requirement objects.` : decoded.message
    };
  }
  const requirements = [];
  for (const item of decoded.value) {
    if (!isRecord3(item)) {
      return {
        ok: false,
        message: "Every Requirement must be an object."
      };
    }
    const keys = Object.keys(item).sort(
      (left, right) => left.localeCompare(right)
    );
    if (keys.length !== 2 || keys[0] !== "contribution_needs" || keys[1] !== "statement" || typeof item.statement !== "string" || !Array.isArray(item.contribution_needs) || item.contribution_needs.length === 0 || item.contribution_needs.length > MAX_NEEDS_PER_REQUIREMENT2 || item.contribution_needs.some((need) => typeof need !== "string")) {
      return {
        ok: false,
        message: "Every Requirement must contain only statement and 1-8 string contribution_needs."
      };
    }
    requirements.push({
      statement: item.statement,
      contributionNeeds: item.contribution_needs
    });
  }
  return { ok: true, value: requirements };
}
async function openJudgmentWithSdk(input) {
  const existing = input.workCase.openJudgments[0];
  if (existing !== void 0) {
    return { status: "active-judgment-exists", judgment: existing };
  }
  const decision = await input.runner.run({
    systemPrompt: [
      "Propose one Category-scoped Judgment for the current unresolved Warrant Gap.",
      "Call the supplied tool exactly once.",
      "Requirements state closure obligations. Contribution Needs state missing input functions, never Skill names.",
      "The SDK controller owns Work Case identity, Context revision, provenance, validation, retries, and recording.",
      "requirements_json and basis_json must be JSON text without Markdown fences."
    ].join("\n"),
    prompt: [
      `Delegated request: ${input.request}`,
      `Current Outcome: ${input.workCase.outcome.statement}`,
      "Open only one independently closable Judgment needed to advance this Outcome."
    ].join("\n"),
    tool: {
      name: "submit_judgment",
      label: "Submit Judgment",
      description: "Submit one Judgment. requirements_json is an array of {statement, contribution_needs}; basis_json is a string array.",
      parameters: Type3.Object(
        {
          category: StringEnum3(categories),
          subject: Type3.String({ minLength: 1, maxLength: 4096 }),
          question: Type3.String({ minLength: 1, maxLength: 4096 }),
          requirements_json: Type3.String({
            minLength: 2,
            maxLength: 32768
          }),
          basis_json: Type3.String({ minLength: 2, maxLength: 32768 })
        },
        { additionalProperties: false }
      ),
      execute: async (raw) => {
        if (!isRecord3(raw) || !isCategory(raw.category) || typeof raw.subject !== "string" || typeof raw.question !== "string") {
          return rejected3(
            "invalid-arguments",
            "Judgment requires category, subject, question, requirements_json, and basis_json."
          );
        }
        const requirements = decodeRequirements(raw.requirements_json);
        if (!requirements.ok) {
          return rejected3("invalid-requirements", requirements.message);
        }
        const basis = decodeSdkStringList({
          value: raw.basis_json,
          label: "basis_json",
          allowEmpty: false,
          maximumItems: MAX_BASIS_ITEMS2
        });
        if (!basis.ok) return rejected3("invalid-basis", basis.message);
        const proposal = {
          workCaseId: input.workCase.workCaseId,
          contextRevisionId: input.contextRevisionId,
          category: raw.category,
          subject: raw.subject,
          question: raw.question,
          requirements: requirements.value,
          basis: basis.value,
          provenance: { kind: "model", source: "sdk:judgment-opening" }
        };
        const opened = openJudgment(proposal);
        if (opened.status === "invalid") {
          return rejected3(opened.error.code, opened.error.message);
        }
        const recorded = recordWorkCaseJudgment(input.workCase, opened.value);
        if (recorded.status === "invalid") {
          return rejected3(recorded.error.code, recorded.error.message);
        }
        return {
          status: "accepted",
          value: { workCase: recorded.value, judgment: opened.value },
          message: `Judgment accepted as ${recorded.status}.`,
          resultStatus: recorded.status
        };
      }
    }
  });
  if (decision.status === "accepted") {
    return {
      status: decision.value.workCase.revisionId === input.workCase.revisionId ? "unchanged" : "opened",
      workCase: decision.value.workCase,
      judgment: decision.value.judgment,
      decision: decision.metrics
    };
  }
  if (decision.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      reason: decision.reason,
      decision: decision.metrics
    };
  }
  return {
    status: "runtime-failure",
    message: decision.message,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/work-case-controller.ts
import { Type as Type4 } from "typebox";
var MAX_OUTCOME_ITEMS = 32;
var MAX_BASIS_ITEMS3 = 16;
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected4(code, message) {
  return { status: "rejected", code, message };
}
async function openWorkCaseWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Propose one bounded Outcome for the delegated request.",
      "Call the supplied tool exactly once.",
      "The SDK controller owns provenance, validation, identity, retries, and canonical opening.",
      "JSON text fields must contain JSON arrays of strings without Markdown fences."
    ].join("\n"),
    prompt: [
      `Delegated request: ${input.request}`,
      "State the desired observable Outcome, acceptance conditions, current constraints, and explicit opening basis."
    ].join("\n"),
    tool: {
      name: "submit_work_case_outcome",
      label: "Submit Work Case Outcome",
      description: "Submit one proposal. acceptance_conditions_json, constraints_json, and basis_json are JSON-encoded string arrays.",
      parameters: Type4.Object(
        {
          statement: Type4.String({ minLength: 1, maxLength: 4096 }),
          acceptance_conditions_json: Type4.String({
            minLength: 2,
            maxLength: 32768
          }),
          constraints_json: Type4.String({
            minLength: 2,
            maxLength: 32768
          }),
          basis_json: Type4.String({ minLength: 2, maxLength: 32768 })
        },
        { additionalProperties: false }
      ),
      execute: async (raw) => {
        if (!isRecord4(raw) || typeof raw.statement !== "string") {
          return rejected4(
            "invalid-arguments",
            "Work Case proposal requires a statement and three JSON text fields."
          );
        }
        const acceptanceConditions = decodeSdkStringList({
          value: raw.acceptance_conditions_json,
          label: "acceptance_conditions_json",
          allowEmpty: false,
          maximumItems: MAX_OUTCOME_ITEMS
        });
        if (!acceptanceConditions.ok) {
          return rejected4(
            "invalid-acceptance-conditions",
            acceptanceConditions.message
          );
        }
        const constraints = decodeSdkStringList({
          value: raw.constraints_json,
          label: "constraints_json",
          allowEmpty: true,
          maximumItems: MAX_OUTCOME_ITEMS
        });
        if (!constraints.ok) {
          return rejected4("invalid-constraints", constraints.message);
        }
        const basis = decodeSdkStringList({
          value: raw.basis_json,
          label: "basis_json",
          allowEmpty: false,
          maximumItems: MAX_BASIS_ITEMS3
        });
        if (!basis.ok) return rejected4("invalid-basis", basis.message);
        const opened = openWorkCase({
          outcome: {
            statement: raw.statement,
            acceptanceConditions: acceptanceConditions.value,
            constraints: constraints.value
          },
          provenance: { kind: "model", source: "sdk:work-case-opening" }
        });
        if (opened.status === "invalid") {
          return rejected4(opened.error.code, opened.error.message);
        }
        return {
          status: "accepted",
          value: { workCase: opened.value, basis: basis.value },
          message: "Canonical Work Case Outcome accepted.",
          resultStatus: "opened"
        };
      }
    }
  });
  if (decision.status === "accepted") {
    return {
      status: "opened",
      workCase: decision.value.workCase,
      basis: decision.value.basis,
      decision: decision.metrics
    };
  }
  if (decision.status === "bounded-stop") {
    return {
      status: "bounded-stop",
      reason: decision.reason,
      decision: decision.metrics
    };
  }
  return {
    status: "runtime-failure",
    message: decision.message,
    decision: decision.metrics
  };
}
export {
  MAX_SDK_PROPOSAL_JSON_CHARS,
  SKILL_TOC_SCHEMA_URI,
  assessCapabilityInventoryWithSdk,
  bindCapability,
  bindPiCapabilityInventory,
  catalogBeforeAgentStartSkills,
  createPiSdkDecisionRunner,
  decodeSdkProposalJson,
  decodeSdkStringList,
  openJudgmentWithSdk,
  openWorkCaseWithSdk,
  parseTocBytes,
  routeStructuredCapabilityWithSdk,
  sealCapabilityContextWithSdk,
  selectStructuredReferencesWithSdk
};
