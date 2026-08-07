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

// src/action-loop/effect/accept-effect-remediation.ts
var EFFECT_REMEDIATION_VERSION = "developer-effect-remediation/v1";
var MAX_BASIS_ITEMS = 16;
var MAX_TEXT_LENGTH = 4096;
var PROVENANCE_KINDS = /* @__PURE__ */ new Set(["model", "human", "tool", "external"]);
function invalid(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalBasis(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_BASIS_ITEMS) {
    return {
      ok: false,
      error: {
        code: "invalid-basis",
        path: "proposal.basis",
        message: `Expected between 1 and ${MAX_BASIS_ITEMS} basis statements`
      }
    };
  }
  const basis = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const value = typeof values[index] === "string" ? values[index].trim() : "";
    if (value.length === 0 || value.length > MAX_TEXT_LENGTH) {
      return {
        ok: false,
        error: {
          code: "invalid-basis",
          path: `proposal.basis[${index}]`,
          message: "Expected a bounded nonblank basis statement"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-basis",
          path: `proposal.basis[${index}]`,
          message: "Basis statement duplicates an earlier normalized value"
        }
      };
    }
    seen.add(value);
    basis.push(value);
  }
  basis.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(basis) };
}
function canonicalProvenance(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Effect remediation provenance kind"
      }
    };
  }
  const source = typeof provenance.source === "string" ? provenance.source.trim() : "";
  if (source.length === 0 || source.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.source",
        message: "Expected bounded nonblank provenance source"
      }
    };
  }
  return { ok: true, value: Object.freeze({ kind: provenance.kind, source }) };
}
function acceptEffectRemediation(adverse, remediation, proposal) {
  if (proposal.workCaseId !== adverse.workCaseId || proposal.workCaseId !== remediation.workCaseId || proposal.adverseEffectId !== adverse.effectId || proposal.adverseEffectSettlementId !== adverse.effectSettlementId || proposal.remediationEffectId !== remediation.effectId || proposal.remediationEffectSettlementId !== remediation.effectSettlementId) {
    return invalid(
      "identity-mismatch",
      "proposal",
      "Effect remediation does not bind the supplied settlements"
    );
  }
  if (adverse.outcome !== "failed" && adverse.outcome !== "partially-applied") {
    return invalid(
      "not-adverse",
      "adverse.outcome",
      "Only a failed or partially-applied Effect requires remediation"
    );
  }
  if (remediation.outcome !== "observed-success") {
    return invalid(
      "remediation-not-successful",
      "remediation.outcome",
      "Remediation requires an observed-success settlement"
    );
  }
  if (adverse.effectId === remediation.effectId) {
    return invalid(
      "same-effect",
      "proposal.remediationEffectId",
      "An adverse Effect cannot remediate itself"
    );
  }
  const basis = canonicalBasis(proposal.basis);
  if (!basis.ok) return { status: "invalid", error: basis.error };
  const provenance = canonicalProvenance(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  return {
    status: "accepted",
    value: Object.freeze({
      effectRemediationId: hashIdentity(
        "effect_remediation",
        EFFECT_REMEDIATION_VERSION,
        [
          proposal.workCaseId,
          proposal.adverseEffectId,
          proposal.adverseEffectSettlementId,
          proposal.remediationEffectId,
          proposal.remediationEffectSettlementId,
          "basis",
          String(basis.value.length),
          ...basis.value
        ]
      ),
      workCaseId: proposal.workCaseId,
      adverseEffectId: proposal.adverseEffectId,
      adverseEffectSettlementId: proposal.adverseEffectSettlementId,
      remediationEffectId: proposal.remediationEffectId,
      remediationEffectSettlementId: proposal.remediationEffectSettlementId,
      basis: basis.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/effect/begin-effect.ts
var EFFECT_VERSION = "developer-effect/v1";
function invalid2(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText2(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.includes("\0")) return void 0;
  return normalized;
}
function beginEffect(clearance, occurrence) {
  if (occurrence.actionClearanceId !== clearance.actionClearanceId) {
    return invalid2(
      "identity-mismatch",
      "occurrence.actionClearanceId",
      `Expected ${clearance.actionClearanceId}, received ${occurrence.actionClearanceId}`
    );
  }
  const occurrenceId = canonicalText2(occurrence.occurrenceId);
  if (occurrenceId === void 0 || occurrenceId !== occurrence.occurrenceId) {
    return invalid2(
      "invalid-occurrence-id",
      "occurrence.occurrenceId",
      "Expected a canonical host occurrence ID"
    );
  }
  if (typeof occurrence.controlledAction !== "object" || occurrence.controlledAction === null || occurrence.controlledAction.kind !== clearance.controlledAction.kind || occurrence.controlledAction.fingerprint !== clearance.controlledAction.fingerprint) {
    return invalid2(
      "controlled-action-mismatch",
      "occurrence.controlledAction",
      "Host occurrence does not match the cleared controlled Action"
    );
  }
  const source = canonicalText2(occurrence.source);
  if (source === void 0) {
    return invalid2(
      "invalid-source",
      "occurrence.source",
      "Host occurrence requires a nonblank source"
    );
  }
  const effectId = hashIdentity("effect", EFFECT_VERSION, [
    clearance.actionClearanceId,
    occurrenceId,
    clearance.controlledAction.kind,
    clearance.controlledAction.fingerprint
  ]);
  return {
    status: "begun",
    value: Object.freeze({
      effectId,
      workCaseId: clearance.workCaseId,
      actionCandidateId: clearance.actionCandidateId,
      actionClearanceId: clearance.actionClearanceId,
      occurrenceId,
      controlledAction: Object.freeze({ ...clearance.controlledAction }),
      intendedEffects: Object.freeze([...clearance.intendedEffects]),
      occurrenceSource: source,
      status: "pending"
    })
  };
}

// src/action-loop/effect/effect-observation.ts
var EFFECT_OBSERVATION_VERSION = "developer-effect-observation/v1";
var EVIDENCE_KINDS = /* @__PURE__ */ new Set([
  "tool-result",
  "artifact-state",
  "verifier-result",
  "process-state",
  "external-state"
]);
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
function canonicalLimitations(values) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      error: {
        code: "invalid-limitation",
        path: "proposal.limitations",
        message: "Expected a limitation list"
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
          code: "invalid-limitation",
          path: `proposal.limitations[${index}]`,
          message: "Expected a nonblank limitation"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `proposal.limitations[${index}]`,
          message: "Limitation duplicates an earlier normalized value"
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalProvenance2(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS2.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Effect Observation provenance kind"
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
function acceptEffectObservation(effect, proposal) {
  for (const [path, actual, expected] of [
    ["proposal.workCaseId", proposal.workCaseId, effect.workCaseId],
    ["proposal.effectId", proposal.effectId, effect.effectId],
    ["proposal.occurrenceId", proposal.occurrenceId, effect.occurrenceId]
  ]) {
    if (actual !== expected) {
      return invalid3(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  if (typeof proposal.evidence !== "object" || proposal.evidence === null || !EVIDENCE_KINDS.has(proposal.evidence.kind)) {
    return invalid3(
      "unsupported-evidence-kind",
      "proposal.evidence.kind",
      "Unsupported Effect evidence kind"
    );
  }
  const locator = canonicalText3(
    proposal.evidence.locator,
    "invalid-evidence-locator",
    "proposal.evidence.locator"
  );
  if (!locator.ok) return { status: "invalid", error: locator.error };
  if (!/^[a-f0-9]{64}$/.test(proposal.evidence.fingerprint)) {
    return invalid3(
      "invalid-evidence-fingerprint",
      "proposal.evidence.fingerprint",
      "Expected a lowercase SHA-256 fingerprint"
    );
  }
  const statement = canonicalText3(
    proposal.statement,
    "empty-statement",
    "proposal.statement"
  );
  if (!statement.ok) return { status: "invalid", error: statement.error };
  const limitations = canonicalLimitations(proposal.limitations);
  if (!limitations.ok) {
    return { status: "invalid", error: limitations.error };
  }
  const provenance = canonicalProvenance2(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const evidence = Object.freeze({
    kind: proposal.evidence.kind,
    locator: locator.value,
    fingerprint: proposal.evidence.fingerprint
  });
  const effectObservationId = hashIdentity(
    "effect_observation",
    EFFECT_OBSERVATION_VERSION,
    [
      effect.effectId,
      effect.occurrenceId,
      "evidence",
      evidence.kind,
      evidence.locator,
      evidence.fingerprint,
      "statement",
      statement.value,
      "limitations",
      String(limitations.value.length),
      ...limitations.value
    ]
  );
  return {
    status: "accepted",
    value: Object.freeze({
      effectObservationId,
      workCaseId: effect.workCaseId,
      effectId: effect.effectId,
      occurrenceId: effect.occurrenceId,
      evidence,
      statement: statement.value,
      limitations: limitations.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/work/work-case.ts
var OUTCOME_VERSION = "developer-outcome/v1";
var WORK_CASE_VERSION = "developer-work-case/v1";
var WORK_CASE_REVISION_VERSION = "developer-work-case-revision/v1";
var PROVENANCE_KINDS3 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid4(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText4(value, code, path) {
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
function canonicalProvenance3(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS3.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Work Case provenance kind"
      }
    };
  }
  const source = canonicalText4(
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
function sameStrings(left, right) {
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
  const invalid23 = workCase.actionCandidates.find(
    (candidate) => candidate.workCaseId !== workCase.workCaseId || candidate.requiredConclusionIds.some((id) => !conclusions.has(id))
  );
  return invalid23 === void 0 ? void 0 : {
    code: "missing-dependency",
    path: "workCase.actionCandidates",
    message: `Action Candidate has a missing Work Case dependency: ${invalid23.actionCandidateId}`
  };
}
function clearanceInventoryIssue(workCase, conclusions, candidates) {
  for (const clearance of workCase.actionClearances) {
    const candidate = candidates.get(clearance.actionCandidateId);
    if (clearance.workCaseId !== workCase.workCaseId || candidate === void 0 || clearance.conclusionIds.some((id) => !conclusions.has(id)) || candidate.controlledAction.kind !== clearance.controlledAction.kind || candidate.controlledAction.fingerprint !== clearance.controlledAction.fingerprint || !sameStrings(candidate.intendedEffects, clearance.intendedEffects)) {
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
    if (effect.workCaseId !== workCase.workCaseId || clearance === void 0 || clearance.actionCandidateId !== effect.actionCandidateId || clearance.controlledAction.kind !== effect.controlledAction.kind || clearance.controlledAction.fingerprint !== effect.controlledAction.fingerprint || !sameStrings(clearance.intendedEffects, effect.intendedEffects)) {
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
    return invalid4("empty-outcome", "proposal.outcome", "Expected an Outcome");
  }
  const statement = canonicalText4(
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
  const provenance = canonicalProvenance3(proposal.provenance);
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

// src/action-loop/work/record-work-case-effect-assessment.ts
function effectAssessmentId(assessment) {
  return "effectSettlementId" in assessment ? assessment.effectSettlementId : assessment.effectAssessmentId;
}

// src/action-loop/work/prepare-closure-target.ts
var CLOSURE_TARGET_VERSION = "developer-closure-target/v1";
function sorted(ids) {
  return Object.freeze(
    [...ids].sort((left, right) => left.localeCompare(right))
  );
}
function closureObligations(workCase) {
  const obligations = [];
  for (const [kind, statements] of [
    ["acceptance-condition", workCase.outcome.acceptanceConditions],
    ["constraint", workCase.outcome.constraints]
  ]) {
    for (const statement of statements) {
      obligations.push(
        Object.freeze({
          closureObligationId: hashIdentity(
            "closure_obligation",
            CLOSURE_TARGET_VERSION,
            [workCase.outcome.outcomeId, kind, statement]
          ),
          kind,
          statement
        })
      );
    }
  }
  obligations.sort(
    (left, right) => left.closureObligationId.localeCompare(right.closureObligationId)
  );
  return Object.freeze(obligations);
}
function effectBlockers(workCase) {
  const blockers = [];
  const assessments = new Map(
    workCase.currentEffectAssessments.map((assessment) => [
      assessment.effectId,
      assessment
    ])
  );
  const remediatedEffectIds = new Set(
    workCase.effectRemediations.map(({ adverseEffectId }) => adverseEffectId)
  );
  for (const effect of workCase.effects) {
    const assessment = assessments.get(effect.effectId);
    if (assessment === void 0) {
      blockers.push(
        Object.freeze({
          code: "missing-effect-assessment",
          subjectId: effect.effectId,
          message: "Occurred Effect has no current assessment"
        })
      );
      continue;
    }
    if (assessment.outcome === "pending" || assessment.outcome === "unknown") {
      blockers.push(
        Object.freeze({
          code: "unsettled-effect",
          subjectId: effect.effectId,
          message: `Effect remains ${assessment.outcome}`
        })
      );
      continue;
    }
    if ((assessment.outcome === "failed" || assessment.outcome === "partially-applied") && !remediatedEffectIds.has(effect.effectId)) {
      blockers.push(
        Object.freeze({
          code: "adverse-effect",
          subjectId: effect.effectId,
          message: `Effect outcome requires resolution: ${assessment.outcome}`
        })
      );
    }
  }
  return Object.freeze(blockers);
}
function prepareClosureTarget(workCase) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return {
      status: "invalid",
      error: {
        code: "stale-work-case",
        path: "workCase.revisionId",
        message: "Work Case revision does not match its closure inventory"
      }
    };
  }
  const inventoryIssue = workCaseInventoryIssue(workCase);
  if (inventoryIssue !== void 0) {
    return {
      status: "invalid",
      error: {
        code: "invalid-work-case-inventory",
        path: inventoryIssue.path,
        message: inventoryIssue.message
      }
    };
  }
  const blockers = [
    ...workCase.openJudgments.map(
      (judgment) => Object.freeze({
        code: "open-judgment",
        subjectId: judgment.judgmentId,
        message: `Judgment remains open: ${judgment.question}`
      })
    ),
    ...effectBlockers(workCase)
  ];
  if (!workCase.conclusions.some(({ category }) => category === "Claim Assurance")) {
    blockers.push(
      Object.freeze({
        code: "missing-claim-assurance",
        subjectId: workCase.outcome.outcomeId,
        message: "Outcome closure requires a Claim Assurance Conclusion"
      })
    );
  }
  if (blockers.length > 0) {
    return {
      status: "not-ready",
      blockers: Object.freeze(blockers)
    };
  }
  const obligations = closureObligations(workCase);
  const conclusionIds = sorted(
    workCase.conclusions.map(({ conclusionId }) => conclusionId)
  );
  const actionCandidateIds = sorted(
    workCase.actionCandidates.map(({ actionCandidateId }) => actionCandidateId)
  );
  const actionClearanceIds = sorted(
    workCase.actionClearances.map(({ actionClearanceId }) => actionClearanceId)
  );
  const effectIds = sorted(workCase.effects.map(({ effectId }) => effectId));
  const effectAssessmentIds = sorted(
    workCase.currentEffectAssessments.map(effectAssessmentId)
  );
  const effectRemediationIds = sorted(
    workCase.effectRemediations.map(
      ({ effectRemediationId }) => effectRemediationId
    )
  );
  const identityParts4 = [
    workCase.workCaseId,
    workCase.revisionId,
    workCase.outcome.outcomeId,
    "obligations",
    ...obligations.map(({ closureObligationId }) => closureObligationId),
    "conclusions",
    ...conclusionIds,
    "action-candidates",
    ...actionCandidateIds,
    "action-clearances",
    ...actionClearanceIds,
    "effects",
    ...effectIds,
    "effect-assessments",
    ...effectAssessmentIds,
    "effect-remediations",
    ...effectRemediationIds
  ];
  return {
    status: "ready",
    value: Object.freeze({
      closureTargetId: hashIdentity(
        "closure_target",
        CLOSURE_TARGET_VERSION,
        identityParts4
      ),
      workCaseId: workCase.workCaseId,
      workCaseRevisionId: workCase.revisionId,
      outcomeId: workCase.outcome.outcomeId,
      obligations,
      conclusionIds,
      actionCandidateIds,
      actionClearanceIds,
      effectIds,
      effectAssessmentIds,
      effectRemediationIds
    })
  };
}

// src/action-loop/work/block-work-case.ts
var WORK_CASE_BLOCK_VERSION = "developer-work-case-block/v1";
function invalid5(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText5(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis2(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const normalized = [];
  for (const value of values) {
    const text = canonicalText5(value);
    if (text === void 0) return void 0;
    normalized.push(text);
  }
  if (new Set(normalized).size !== normalized.length) return void 0;
  return Object.freeze(
    normalized.sort((left, right) => left.localeCompare(right))
  );
}
function blockerKey(code, subjectId) {
  return `${code}\0${subjectId}`;
}
function canonicalBlockerDispositions(blockers, proposals) {
  if (!Array.isArray(proposals)) {
    return {
      ok: false,
      result: invalid5(
        "blocker-accounting",
        "proposal.blockerDispositions",
        "Expected complete blocker accounting"
      )
    };
  }
  const expected = new Set(
    blockers.map((blocker) => blockerKey(blocker.code, blocker.subjectId))
  );
  const accounted = /* @__PURE__ */ new Map();
  for (let index = 0; index < proposals.length; index += 1) {
    const disposition = proposals[index];
    if (disposition === void 0) {
      return {
        ok: false,
        result: invalid5(
          "blocker-accounting",
          `proposal.blockerDispositions[${index}]`,
          "Expected blocker disposition"
        )
      };
    }
    const key = blockerKey(disposition.code, disposition.subjectId);
    const basis = canonicalBasis2(disposition.basis);
    if (!expected.has(key) || accounted.has(key) || basis === void 0) {
      return {
        ok: false,
        result: invalid5(
          "blocker-accounting",
          `proposal.blockerDispositions[${index}]`,
          "Blocker must be current, unique, and explicitly supported"
        )
      };
    }
    accounted.set(
      key,
      Object.freeze({
        code: disposition.code,
        subjectId: disposition.subjectId,
        basis
      })
    );
  }
  if (accounted.size !== expected.size) {
    return {
      ok: false,
      result: invalid5(
        "blocker-accounting",
        "proposal.blockerDispositions",
        "Every current closure blocker requires one disposition"
      )
    };
  }
  const ordered = [];
  for (const blocker of blockers) {
    const disposition = accounted.get(
      blockerKey(blocker.code, blocker.subjectId)
    );
    if (disposition === void 0) {
      return {
        ok: false,
        result: invalid5(
          "blocker-accounting",
          "proposal.blockerDispositions",
          `Missing current blocker: ${blocker.subjectId}`
        )
      };
    }
    ordered.push(disposition);
  }
  return { ok: true, value: Object.freeze(ordered) };
}
function blockWorkCase(workCase, proposal) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return invalid5(
      "stale-work-case",
      "workCase.revisionId",
      "Work Case revision does not match its closure inventory"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid5("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid5(
      "identity-mismatch",
      "proposal",
      "Block proposal does not bind the current Work Case revision"
    );
  }
  const assurance = workCase.conclusions.find(
    ({ conclusionId }) => conclusionId === proposal.claimAssuranceConclusionId
  );
  if (assurance === void 0 || assurance.category !== "Claim Assurance") {
    return invalid5(
      "claim-assurance-required",
      "proposal.claimAssuranceConclusionId",
      "Blocking requires a current Claim Assurance Conclusion"
    );
  }
  const closure = prepareClosureTarget(workCase);
  if (closure.status === "invalid") {
    return invalid5(
      "invalid-work-case-inventory",
      closure.error.path,
      closure.error.message
    );
  }
  if (closure.status === "ready") {
    return invalid5(
      "closure-still-ready",
      "workCase",
      "A closure-ready Work Case cannot be declared blocked"
    );
  }
  const blockerDispositions = canonicalBlockerDispositions(
    closure.blockers,
    proposal.blockerDispositions
  );
  if (!blockerDispositions.ok) return blockerDispositions.result;
  const reason = canonicalText5(proposal.reason);
  if (reason === void 0) {
    return invalid5(
      "invalid-block-reason",
      "proposal.reason",
      "Blocking requires an explicit bounded reason"
    );
  }
  const workCaseBlockId = hashIdentity(
    "work_case_block",
    WORK_CASE_BLOCK_VERSION,
    [
      workCase.workCaseId,
      workCase.revisionId,
      assurance.conclusionId,
      reason,
      ...blockerDispositions.value.flatMap((disposition) => [
        disposition.code,
        disposition.subjectId,
        ...disposition.basis
      ])
    ]
  );
  return {
    status: "blocked",
    value: Object.freeze({
      ...workCase,
      status: "blocked",
      priorRevisionId: workCase.revisionId,
      revisionId: hashIdentity(
        "work_case_block_revision",
        WORK_CASE_BLOCK_VERSION,
        [workCase.revisionId, workCaseBlockId]
      ),
      block: Object.freeze({
        workCaseBlockId,
        claimAssuranceConclusionId: assurance.conclusionId,
        reason,
        blockerDispositions: blockerDispositions.value
      })
    })
  };
}

// src/action-loop/work/pause-work-case.ts
var WORK_CASE_PAUSE_VERSION = "developer-work-case-pause/v1";
function invalid6(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText6(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis3(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const strings = [];
  for (const value of values) {
    const normalized = canonicalText6(value);
    if (normalized === void 0) return void 0;
    strings.push(normalized);
  }
  if (new Set(strings).size !== strings.length) return void 0;
  return Object.freeze(
    strings.sort((left, right) => left.localeCompare(right))
  );
}
function pauseWorkCase(workCase, proposal) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return invalid6(
      "stale-work-case",
      "workCase.revisionId",
      "Work Case revision does not match its closure inventory"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid6("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid6(
      "identity-mismatch",
      "proposal",
      "Pause proposal does not bind the current Work Case revision"
    );
  }
  if (proposal.decision?.kind !== "human") {
    return invalid6(
      "human-decision-required",
      "proposal.decision.kind",
      "Pausing a Work Case requires an explicit human decision"
    );
  }
  const reason = canonicalText6(proposal.reason);
  const decisionId = canonicalText6(proposal.decision.decisionId);
  const source = canonicalText6(proposal.decision.source);
  const basis = canonicalBasis3(proposal.decision.basis);
  if (reason === void 0 || decisionId === void 0 || source === void 0 || basis === void 0) {
    return invalid6(
      "invalid-pause-decision",
      "proposal",
      "Pause reason and human decision evidence must be explicit"
    );
  }
  const decision = Object.freeze({
    kind: "human",
    decisionId,
    source,
    basis
  });
  const workCasePauseId = hashIdentity(
    "work_case_pause",
    WORK_CASE_PAUSE_VERSION,
    [
      workCase.workCaseId,
      workCase.revisionId,
      reason,
      decisionId,
      source,
      ...basis
    ]
  );
  const pause = Object.freeze({ workCasePauseId, reason, decision });
  return {
    status: "paused",
    value: Object.freeze({
      ...workCase,
      status: "paused",
      priorRevisionId: workCase.revisionId,
      revisionId: hashIdentity(
        "work_case_pause_revision",
        WORK_CASE_PAUSE_VERSION,
        [workCase.revisionId, workCasePauseId]
      ),
      pause
    })
  };
}

// src/action-loop/work/resume-blocked-work-case.ts
var WORK_CASE_UNBLOCK_VERSION = "developer-work-case-unblock/v1";
function invalid7(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText7(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis4(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const normalized = [];
  for (const value of values) {
    const text = canonicalText7(value);
    if (text === void 0) return void 0;
    normalized.push(text);
  }
  if (new Set(normalized).size !== normalized.length) return void 0;
  return Object.freeze(
    normalized.sort((left, right) => left.localeCompare(right))
  );
}
function resumeBlockedWorkCase(workCase, proposal) {
  const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
  const expectedBlockedRevisionId = hashIdentity(
    "work_case_block_revision",
    WORK_CASE_BLOCK_VERSION,
    [workCase.priorRevisionId, workCase.block.workCaseBlockId]
  );
  if (workCase.priorRevisionId !== inventoryRevisionId || workCase.revisionId !== expectedBlockedRevisionId) {
    return invalid7(
      "stale-blocked-work-case",
      "workCase.revisionId",
      "Blocked Work Case does not preserve its prior inventory revision"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid7("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid7(
      "identity-mismatch",
      "proposal",
      "Unblock proposal does not bind the blocked Work Case revision"
    );
  }
  if (proposal.observation?.kind !== "human" && proposal.observation?.kind !== "tool" && proposal.observation?.kind !== "external") {
    return invalid7(
      "observation-required",
      "proposal.observation.kind",
      "Unblocking requires a human, tool, or external Observation"
    );
  }
  const continuation = canonicalText7(proposal.continuation);
  const observationId = canonicalText7(proposal.observation.observationId);
  const source = canonicalText7(proposal.observation.source);
  const statement = canonicalText7(proposal.observation.statement);
  const basis = canonicalBasis4(proposal.observation.basis);
  if (continuation === void 0 || observationId === void 0 || source === void 0 || statement === void 0 || basis === void 0) {
    return invalid7(
      "invalid-unblock-basis",
      "proposal",
      "Observed change and concrete continuation must be explicit"
    );
  }
  const workCaseUnblockId = hashIdentity(
    "work_case_unblock",
    WORK_CASE_UNBLOCK_VERSION,
    [
      workCase.workCaseId,
      workCase.revisionId,
      continuation,
      proposal.observation.kind,
      observationId,
      source,
      statement,
      ...basis
    ]
  );
  const continuityIds = Object.freeze([
    ...workCase.continuityIds,
    workCase.block.workCaseBlockId,
    workCaseUnblockId
  ]);
  const {
    block: _block,
    priorRevisionId: _priorRevisionId,
    revisionId: _revisionId,
    status: _status,
    ...preserved
  } = workCase;
  const nextState = { ...preserved, continuityIds };
  return {
    status: "active",
    value: Object.freeze({
      ...nextState,
      status: "active",
      revisionId: deriveWorkCaseRevisionId(nextState)
    })
  };
}

// src/action-loop/work/resume-paused-work-case.ts
var WORK_CASE_RESUME_VERSION = "developer-work-case-resume/v1";
function invalid8(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText8(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis5(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const normalized = [];
  for (const value of values) {
    const text = canonicalText8(value);
    if (text === void 0) return void 0;
    normalized.push(text);
  }
  if (new Set(normalized).size !== normalized.length) return void 0;
  return Object.freeze(
    normalized.sort((left, right) => left.localeCompare(right))
  );
}
function resumePausedWorkCase(workCase, proposal) {
  const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
  const expectedPausedRevisionId = hashIdentity(
    "work_case_pause_revision",
    WORK_CASE_PAUSE_VERSION,
    [workCase.priorRevisionId, workCase.pause.workCasePauseId]
  );
  if (workCase.priorRevisionId !== inventoryRevisionId || workCase.revisionId !== expectedPausedRevisionId) {
    return invalid8(
      "stale-paused-work-case",
      "workCase.revisionId",
      "Paused Work Case does not preserve its prior inventory revision"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid8("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid8(
      "identity-mismatch",
      "proposal",
      "Resume proposal does not bind the paused Work Case revision"
    );
  }
  if (proposal.decision?.kind !== "human") {
    return invalid8(
      "human-decision-required",
      "proposal.decision.kind",
      "Resuming a paused Work Case requires an explicit human decision"
    );
  }
  const decisionId = canonicalText8(proposal.decision.decisionId);
  const source = canonicalText8(proposal.decision.source);
  const basis = canonicalBasis5(proposal.decision.basis);
  if (decisionId === void 0 || source === void 0 || basis === void 0) {
    return invalid8(
      "invalid-resume-decision",
      "proposal.decision",
      "Human resume decision evidence must be explicit"
    );
  }
  const workCaseResumeId = hashIdentity(
    "work_case_resume",
    WORK_CASE_RESUME_VERSION,
    [workCase.workCaseId, workCase.revisionId, decisionId, source, ...basis]
  );
  const continuityIds = Object.freeze([
    ...workCase.continuityIds,
    workCase.pause.workCasePauseId,
    workCaseResumeId
  ]);
  const {
    pause: _pause,
    priorRevisionId: _priorRevisionId,
    revisionId: _revisionId,
    status: _status,
    ...preserved
  } = workCase;
  const nextState = { ...preserved, continuityIds };
  return {
    status: "active",
    value: Object.freeze({
      ...nextState,
      status: "active",
      revisionId: deriveWorkCaseRevisionId(nextState)
    })
  };
}

// src/action-loop/work/wait-work-case.ts
var WORK_CASE_WAIT_VERSION = "developer-work-case-wait/v1";
function invalid9(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText9(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis6(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const normalized = [];
  for (const value of values) {
    const text = canonicalText9(value);
    if (text === void 0) return void 0;
    normalized.push(text);
  }
  if (new Set(normalized).size !== normalized.length) return void 0;
  return Object.freeze(
    normalized.sort((left, right) => left.localeCompare(right))
  );
}
function waitWorkCase(workCase, proposal) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return invalid9(
      "stale-work-case",
      "workCase.revisionId",
      "Work Case revision does not match its closure inventory"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid9("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid9(
      "identity-mismatch",
      "proposal",
      "Wait proposal does not bind the current Work Case revision"
    );
  }
  if (proposal.observation?.kind !== "human" && proposal.observation?.kind !== "tool" && proposal.observation?.kind !== "external") {
    return invalid9(
      "observation-required",
      "proposal.observation.kind",
      "Waiting requires a human, tool, or external Observation"
    );
  }
  const externalCondition = canonicalText9(proposal.externalCondition);
  const resumePredicate = canonicalText9(proposal.resumePredicate);
  const observationId = canonicalText9(proposal.observation.observationId);
  const source = canonicalText9(proposal.observation.source);
  const basis = canonicalBasis6(proposal.observation.basis);
  if (externalCondition === void 0 || resumePredicate === void 0 || observationId === void 0 || source === void 0 || basis === void 0) {
    return invalid9(
      "invalid-wait-condition",
      "proposal",
      "External condition, resume predicate, and Observation must be explicit"
    );
  }
  const observation = Object.freeze({
    kind: proposal.observation.kind,
    observationId,
    source,
    basis
  });
  const workCaseWaitId = hashIdentity(
    "work_case_wait",
    WORK_CASE_WAIT_VERSION,
    [
      workCase.workCaseId,
      workCase.revisionId,
      externalCondition,
      resumePredicate,
      observation.kind,
      observationId,
      source,
      ...basis
    ]
  );
  return {
    status: "waiting",
    value: Object.freeze({
      ...workCase,
      status: "waiting",
      priorRevisionId: workCase.revisionId,
      revisionId: hashIdentity(
        "work_case_wait_revision",
        WORK_CASE_WAIT_VERSION,
        [workCase.revisionId, workCaseWaitId]
      ),
      wait: Object.freeze({
        workCaseWaitId,
        externalCondition,
        resumePredicate,
        observation
      })
    })
  };
}

// src/action-loop/work/resume-waiting-work-case.ts
var WORK_CASE_WAIT_RESUME_VERSION = "developer-work-case-wait-resume/v1";
function invalid10(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText10(value) {
  if (typeof value !== "string") return void 0;
  const normalized = value.trim();
  return normalized.length === 0 ? void 0 : normalized;
}
function canonicalBasis7(values) {
  if (!Array.isArray(values) || values.length === 0) return void 0;
  const normalized = [];
  for (const value of values) {
    const text = canonicalText10(value);
    if (text === void 0) return void 0;
    normalized.push(text);
  }
  if (new Set(normalized).size !== normalized.length) return void 0;
  return Object.freeze(
    normalized.sort((left, right) => left.localeCompare(right))
  );
}
function canonicalAssessment(proposal, expectedPredicate) {
  if (canonicalText10(proposal.resumePredicate) !== expectedPredicate) {
    return {
      ok: false,
      result: invalid10(
        "identity-mismatch",
        "proposal.assessment.resumePredicate",
        "Resume assessment does not bind the waiting predicate"
      )
    };
  }
  if (proposal.status !== "satisfied" && proposal.status !== "not-satisfied" && proposal.status !== "unknown") {
    return {
      ok: false,
      result: invalid10(
        "invalid-resume-assessment",
        "proposal.assessment.status",
        "Unsupported resume predicate assessment status"
      )
    };
  }
  if (proposal.observationKind !== "human" && proposal.observationKind !== "tool" && proposal.observationKind !== "external") {
    return {
      ok: false,
      result: invalid10(
        "observation-required",
        "proposal.assessment.observationKind",
        "Resume assessment requires a human, tool, or external Observation"
      )
    };
  }
  const observationId = canonicalText10(proposal.observationId);
  const source = canonicalText10(proposal.source);
  const basis = canonicalBasis7(proposal.basis);
  if (observationId === void 0 || source === void 0 || basis === void 0) {
    return {
      ok: false,
      result: invalid10(
        "invalid-resume-assessment",
        "proposal.assessment",
        "Resume assessment evidence must be explicit"
      )
    };
  }
  return {
    ok: true,
    value: {
      status: proposal.status,
      observationKind: proposal.observationKind,
      observationId,
      source,
      basis
    }
  };
}
function resumeWaitingWorkCase(workCase, proposal) {
  const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
  const expectedWaitingRevisionId = hashIdentity(
    "work_case_wait_revision",
    WORK_CASE_WAIT_VERSION,
    [workCase.priorRevisionId, workCase.wait.workCaseWaitId]
  );
  if (workCase.priorRevisionId !== inventoryRevisionId || workCase.revisionId !== expectedWaitingRevisionId) {
    return invalid10(
      "stale-waiting-work-case",
      "workCase.revisionId",
      "Waiting Work Case does not preserve its prior inventory revision"
    );
  }
  const issue = workCaseInventoryIssue(workCase);
  if (issue !== void 0) {
    return invalid10("invalid-work-case-inventory", issue.path, issue.message);
  }
  if (proposal.workCaseId !== workCase.workCaseId || proposal.expectedRevisionId !== workCase.revisionId) {
    return invalid10(
      "identity-mismatch",
      "proposal",
      "Resume assessment does not bind the waiting Work Case revision"
    );
  }
  const assessment = canonicalAssessment(
    proposal.assessment,
    workCase.wait.resumePredicate
  );
  if (!assessment.ok) return assessment.result;
  if (assessment.value.status !== "satisfied") {
    return { status: "waiting", value: workCase };
  }
  const workCaseWaitResumeId = hashIdentity(
    "work_case_wait_resume",
    WORK_CASE_WAIT_RESUME_VERSION,
    [
      workCase.workCaseId,
      workCase.revisionId,
      workCase.wait.resumePredicate,
      assessment.value.observationKind,
      assessment.value.observationId,
      assessment.value.source,
      ...assessment.value.basis
    ]
  );
  const continuityIds = Object.freeze([
    ...workCase.continuityIds,
    workCase.wait.workCaseWaitId,
    workCaseWaitResumeId
  ]);
  const {
    wait: _wait,
    priorRevisionId: _priorRevisionId,
    revisionId: _revisionId,
    status: _status,
    ...preserved
  } = workCase;
  const nextState = { ...preserved, continuityIds };
  return {
    status: "active",
    value: Object.freeze({
      ...nextState,
      status: "active",
      revisionId: deriveWorkCaseRevisionId(nextState)
    })
  };
}

// src/action-loop/sdk/action-controller.ts
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

// src/action-loop/action/accept-action-candidate.ts
var ACTION_CANDIDATE_VERSION = "developer-action-candidate/v1";
var PROVENANCE_KINDS4 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid11(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim() && !value.includes("\0");
}
function canonicalText11(value, code, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      error: { code, path, message: "Expected a nonblank string" }
    };
  }
  return { ok: true, value: value.trim() };
}
function canonicalList2(values, contract) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      ok: false,
      error: {
        code: contract.missingCode,
        path: contract.path,
        message: "Expected at least one value"
      }
    };
  }
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!contract.validate(value)) {
      return {
        ok: false,
        error: {
          code: contract.invalidCode,
          path: `${contract.path}[${index}]`,
          message: "Expected a canonical nonblank value"
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
function canonicalProvenance4(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS4.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Action Candidate provenance kind"
      }
    };
  }
  const source = canonicalText11(
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
function acceptActionCandidate(proposal) {
  if (!validId(proposal.workCaseId)) {
    return invalid11(
      "invalid-id",
      "proposal.workCaseId",
      "Expected a canonical Work Case ID"
    );
  }
  if (typeof proposal.controlledAction !== "object" || proposal.controlledAction === null) {
    return invalid11(
      "invalid-controlled-action",
      "proposal.controlledAction",
      "Expected an exact controlled Action identity"
    );
  }
  const actionKind = canonicalText11(
    proposal.controlledAction.kind,
    "invalid-controlled-action",
    "proposal.controlledAction.kind"
  );
  if (!actionKind.ok) return { status: "invalid", error: actionKind.error };
  if (!/^[a-f0-9]{64}$/.test(proposal.controlledAction.fingerprint)) {
    return invalid11(
      "invalid-fingerprint",
      "proposal.controlledAction.fingerprint",
      "Expected a lowercase SHA-256 fingerprint"
    );
  }
  const summary = canonicalText11(
    proposal.summary,
    "empty-summary",
    "proposal.summary"
  );
  if (!summary.ok) return { status: "invalid", error: summary.error };
  const effects = canonicalList2(proposal.intendedEffects, {
    path: "proposal.intendedEffects",
    missingCode: "missing-intended-effect",
    invalidCode: "invalid-intended-effect",
    validate: (value) => value.length > 0
  });
  if (!effects.ok) return { status: "invalid", error: effects.error };
  const conclusions = canonicalList2(proposal.requiredConclusionIds, {
    path: "proposal.requiredConclusionIds",
    missingCode: "missing-conclusion",
    invalidCode: "invalid-conclusion",
    validate: validId
  });
  if (!conclusions.ok) return { status: "invalid", error: conclusions.error };
  const provenance = canonicalProvenance4(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const controlledAction = Object.freeze({
    kind: actionKind.value,
    fingerprint: proposal.controlledAction.fingerprint
  });
  const actionCandidateId = hashIdentity(
    "action_candidate",
    ACTION_CANDIDATE_VERSION,
    [
      proposal.workCaseId,
      "controlled-action",
      controlledAction.kind,
      controlledAction.fingerprint,
      "summary",
      summary.value,
      "intended-effects",
      String(effects.value.length),
      ...effects.value,
      "required-conclusions",
      String(conclusions.value.length),
      ...conclusions.value
    ]
  );
  return {
    status: "accepted",
    value: Object.freeze({
      actionCandidateId,
      workCaseId: proposal.workCaseId,
      controlledAction,
      summary: summary.value,
      intendedEffects: effects.value,
      requiredConclusionIds: conclusions.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/action/action-clearance.ts
var ACTION_CLEARANCE_VERSION = "developer-action-clearance/v1";
var PERMISSION_STATUSES = /* @__PURE__ */ new Set([
  "granted",
  "denied",
  "unknown"
]);
var PROVENANCE_KINDS5 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid12(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId2(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim() && !value.includes("\0");
}
function canonicalText12(value, code, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      error: { code, path, message: "Expected a nonblank string" }
    };
  }
  return { ok: true, value: value.trim() };
}
function canonicalBasis8(values, path, emptyCode, invalidCode) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      ok: false,
      error: { code: emptyCode, path, message: "Expected explicit basis" }
    };
  }
  const canonical = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length === 0) {
      return {
        ok: false,
        error: {
          code: invalidCode,
          path: `${path}[${index}]`,
          message: "Expected a nonblank basis item"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: invalidCode,
          path: `${path}[${index}]`,
          message: "Basis item duplicates an earlier normalized item"
        }
      };
    }
    seen.add(value);
    canonical.push(value);
  }
  canonical.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(canonical) };
}
function canonicalProvenance5(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS5.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported clearance proposal provenance kind"
      }
    };
  }
  const source = canonicalText12(
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
function conclusionInventory(candidate, conclusions) {
  const inventory = /* @__PURE__ */ new Map();
  for (let index = 0; index < conclusions.length; index += 1) {
    const conclusion = conclusions[index];
    if (conclusion === void 0 || !validId2(conclusion.conclusionId)) {
      return {
        ok: false,
        error: {
          code: "invalid-conclusion",
          path: `conclusions[${index}].conclusionId`,
          message: "Expected a canonical Conclusion ID"
        }
      };
    }
    if (conclusion.workCaseId !== candidate.workCaseId) {
      return {
        ok: false,
        error: {
          code: "cross-work-case-conclusion",
          path: `conclusions[${index}].workCaseId`,
          message: "Conclusion belongs to another Work Case"
        }
      };
    }
    if (inventory.has(conclusion.conclusionId)) {
      return {
        ok: false,
        error: {
          code: "duplicate-conclusion",
          path: `conclusions[${index}].conclusionId`,
          message: "Conclusion appears more than once"
        }
      };
    }
    inventory.set(conclusion.conclusionId, conclusion);
  }
  return { ok: true, value: inventory };
}
function canonicalProposalConclusionIds(candidate, values) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      error: {
        code: "invalid-conclusion",
        path: "proposal.conclusionIds",
        message: "Expected Conclusion IDs"
      }
    };
  }
  const declared = new Set(candidate.requiredConclusionIds);
  const proposed = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== "string" || !validId2(value)) {
      return {
        ok: false,
        error: {
          code: "invalid-conclusion",
          path: `proposal.conclusionIds[${index}]`,
          message: "Expected a canonical Conclusion ID"
        }
      };
    }
    if (!declared.has(value)) {
      return {
        ok: false,
        error: {
          code: "unexpected-conclusion",
          path: `proposal.conclusionIds[${index}]`,
          message: "Conclusion is not required by the Action Candidate"
        }
      };
    }
    if (proposed.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-conclusion",
          path: `proposal.conclusionIds[${index}]`,
          message: "Conclusion appears more than once"
        }
      };
    }
    proposed.add(value);
  }
  for (const required of candidate.requiredConclusionIds) {
    if (!proposed.has(required)) {
      return {
        ok: false,
        error: {
          code: "invalid-conclusion",
          path: "proposal.conclusionIds",
          message: `Required Conclusion is not accounted: ${required}`
        }
      };
    }
  }
  return {
    ok: true,
    value: Object.freeze([...candidate.requiredConclusionIds])
  };
}
function canonicalPermission(candidate, permission) {
  if (permission.actionCandidateId !== candidate.actionCandidateId) {
    return {
      ok: false,
      error: {
        code: "identity-mismatch",
        path: "permission.actionCandidateId",
        message: `Expected ${candidate.actionCandidateId}, received ${permission.actionCandidateId}`
      }
    };
  }
  if (!PERMISSION_STATUSES.has(permission.status)) {
    return {
      ok: false,
      error: {
        code: "unsupported-permission-status",
        path: "permission.status",
        message: `Unsupported permission status ${permission.status}`
      }
    };
  }
  const source = canonicalText12(
    permission.source,
    "invalid-permission-source",
    "permission.source"
  );
  if (!source.ok) return source;
  const basis = canonicalBasis8(
    permission.basis,
    "permission.basis",
    "empty-permission-basis",
    "invalid-permission-basis"
  );
  if (!basis.ok) return basis;
  return {
    ok: true,
    value: Object.freeze({
      actionCandidateId: permission.actionCandidateId,
      status: permission.status,
      source: source.value,
      basis: basis.value
    })
  };
}
function acceptActionClearance(candidate, conclusions, permission, proposal) {
  if (proposal.workCaseId !== candidate.workCaseId) {
    return invalid12(
      "identity-mismatch",
      "proposal.workCaseId",
      `Expected ${candidate.workCaseId}, received ${proposal.workCaseId}`
    );
  }
  if (proposal.actionCandidateId !== candidate.actionCandidateId) {
    return invalid12(
      "identity-mismatch",
      "proposal.actionCandidateId",
      `Expected ${candidate.actionCandidateId}, received ${proposal.actionCandidateId}`
    );
  }
  const inventory = conclusionInventory(candidate, conclusions);
  if (!inventory.ok) return { status: "invalid", error: inventory.error };
  const conclusionIds = canonicalProposalConclusionIds(
    candidate,
    proposal.conclusionIds
  );
  if (!conclusionIds.ok) {
    return { status: "invalid", error: conclusionIds.error };
  }
  const warrantBasis = canonicalBasis8(
    proposal.warrantBasis,
    "proposal.warrantBasis",
    "empty-warrant-basis",
    "invalid-warrant-basis"
  );
  if (!warrantBasis.ok) {
    return { status: "invalid", error: warrantBasis.error };
  }
  const currentPermission = canonicalPermission(candidate, permission);
  if (!currentPermission.ok) {
    return { status: "invalid", error: currentPermission.error };
  }
  const provenance = canonicalProvenance5(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const missingConclusionIds = Object.freeze(
    candidate.requiredConclusionIds.filter((id) => !inventory.value.has(id))
  );
  const assessment = Object.freeze({
    workCaseId: candidate.workCaseId,
    actionCandidateId: candidate.actionCandidateId,
    conclusionIds: conclusionIds.value,
    missingConclusionIds,
    warrantSatisfied: missingConclusionIds.length === 0,
    warrantBasis: warrantBasis.value,
    permission: currentPermission.value,
    provenance: provenance.value
  });
  const blockers = missingConclusionIds.map(
    (conclusionId) => ({ code: "missing-conclusion", conclusionId })
  );
  if (currentPermission.value.status === "denied") {
    blockers.push({ code: "permission-denied" });
  } else if (currentPermission.value.status === "unknown") {
    blockers.push({ code: "permission-unknown" });
  }
  if (blockers.length > 0) {
    return {
      status: "not-cleared",
      assessment,
      blockers: Object.freeze(blockers)
    };
  }
  const grantedPermission = Object.freeze({
    ...currentPermission.value,
    status: "granted"
  });
  const actionClearanceId = hashIdentity(
    "action_clearance",
    ACTION_CLEARANCE_VERSION,
    [
      candidate.actionCandidateId,
      "conclusions",
      String(conclusionIds.value.length),
      ...conclusionIds.value,
      "warrant-basis",
      String(warrantBasis.value.length),
      ...warrantBasis.value,
      "permission-source",
      grantedPermission.source,
      "permission-basis",
      String(grantedPermission.basis.length),
      ...grantedPermission.basis
    ]
  );
  return {
    status: "cleared",
    value: Object.freeze({
      actionClearanceId,
      workCaseId: candidate.workCaseId,
      actionCandidateId: candidate.actionCandidateId,
      controlledAction: Object.freeze({ ...candidate.controlledAction }),
      intendedEffects: Object.freeze([...candidate.intendedEffects]),
      conclusionIds: conclusionIds.value,
      warrantBasis: warrantBasis.value,
      permission: grantedPermission,
      provenance: provenance.value
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

// src/action-loop/sdk/action-controller.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected(code, message) {
  return { status: "rejected", code, message };
}
function actionParameters(input) {
  const fields = {
    tool_name: StringEnum(
      input.actions.map((action) => action.name),
      {
        description: input.actions.map((action) => `${action.name}: ${action.description}`).join(" | ")
      }
    ),
    tool_input_json: Type.String({
      minLength: 2,
      maxLength: 32768,
      description: "Exact JSON object to pass to the selected controlled host tool."
    }),
    summary: Type.String({ minLength: 1, maxLength: 2048 }),
    intended_effects_json: Type.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of one or more intended Effect strings."
    })
  };
  for (const [index, conclusion] of input.conclusions.entries()) {
    fields[`requires_conclusion_${index}`] = Type.Boolean({
      description: `${conclusion.category}: ${conclusion.answer}`
    });
  }
  return Type.Object(fields, { additionalProperties: false });
}
function selectedConclusionIds(raw, conclusions) {
  return Object.freeze(
    conclusions.flatMap(
      (conclusion, index) => raw[`requires_conclusion_${index}`] === true ? [conclusion.conclusionId] : []
    )
  );
}
function actionTool(input) {
  const actionsByName = new Map(
    input.actions.map((action) => [action.name, action])
  );
  return {
    name: "submit_action_candidate",
    label: "Submit one exact controlled Action Candidate",
    description: "Propose exact host tool input and intended Effects without granting permission or executing the Action.",
    parameters: actionParameters(input),
    execute: async (raw) => {
      if (!isRecord(raw)) {
        return rejected(
          "invalid-arguments",
          "Action Candidate arguments must be an object."
        );
      }
      if (typeof raw.tool_name !== "string") {
        return rejected(
          "invalid-tool-name",
          "tool_name must identify one available controlled Action."
        );
      }
      const adapter = actionsByName.get(raw.tool_name);
      if (adapter === void 0) {
        return rejected(
          "unavailable-tool",
          `Controlled Action ${raw.tool_name} is unavailable.`
        );
      }
      const decodedInput = decodeSdkProposalJson(
        raw.tool_input_json,
        "tool_input_json"
      );
      if (!decodedInput.ok || !isRecord(decodedInput.value)) {
        return rejected(
          "invalid-tool-input",
          decodedInput.ok ? "tool_input_json must encode one JSON object." : decodedInput.message
        );
      }
      if (typeof raw.summary !== "string") {
        return rejected("invalid-summary", "summary must be non-empty text.");
      }
      const intendedEffects = decodeSdkStringList({
        value: raw.intended_effects_json,
        label: "intended_effects_json",
        allowEmpty: false,
        maximumItems: 32
      });
      if (!intendedEffects.ok) {
        return rejected("invalid-intended-effects", intendedEffects.message);
      }
      const conclusionIds = selectedConclusionIds(raw, input.conclusions);
      if (conclusionIds.length === 0) {
        return rejected(
          "missing-required-conclusion",
          "Action Candidate must identify at least one current required Conclusion."
        );
      }
      const bound = adapter.bind(decodedInput.value);
      if (bound.status === "invalid") {
        return rejected("invalid-controlled-action", bound.message);
      }
      const accepted = acceptActionCandidate({
        workCaseId: input.workCaseId,
        controlledAction: bound.value.controlledAction,
        summary: raw.summary,
        intendedEffects: intendedEffects.value,
        requiredConclusionIds: conclusionIds,
        provenance: { kind: "model", source: "pi:sdk-action-loop" }
      });
      if (accepted.status === "invalid") {
        return rejected(accepted.error.code, accepted.error.message);
      }
      return {
        status: "accepted",
        value: {
          toolName: adapter.name,
          toolInput: Object.freeze({ ...decodedInput.value }),
          canonicalInput: bound.value.canonicalInput,
          candidate: accepted.value
        },
        message: "Exact controlled Action Candidate accepted without permission.",
        resultStatus: "candidate"
      };
    }
  };
}
function actionPrompt(input) {
  const conclusions = input.conclusions.map(
    (conclusion, index) => `Conclusion ${index} (${conclusion.category}): ${conclusion.answer}`
  ).join("\n");
  return [
    `Delegated request:
${input.request}`,
    `Current Conclusions:
${conclusions}`,
    "Propose one exact controlled Action only when it advances the delegated Outcome. This proposal grants no permission and executes nothing."
  ].join("\n\n");
}
async function proposeActionWithSdk(input) {
  if (input.actions.length === 0) {
    return {
      status: "invariant-failure",
      code: "empty-controlled-action-inventory",
      message: "At least one controlled host Action adapter is required."
    };
  }
  if (input.conclusions.length === 0) {
    return {
      status: "invariant-failure",
      code: "empty-conclusion-inventory",
      message: "An Action Candidate requires at least one current Conclusion."
    };
  }
  const actionNames = new Set(input.actions.map((action) => action.name));
  if (actionNames.size !== input.actions.length) {
    return {
      status: "invariant-failure",
      code: "duplicate-controlled-action",
      message: "Controlled Action adapter names must be unique."
    };
  }
  const decision = await input.runner.run({
    systemPrompt: [
      "Propose one exact controlled host Action Candidate.",
      "Call the supplied decision tool exactly once.",
      "Select current required Conclusions and state intended Effects.",
      "Do not claim permission, execution, Effect success, or Work Case completion.",
      "The SDK controller owns exact input binding, canonical identity, retries, and stop decisions."
    ].join("\n"),
    prompt: actionPrompt(input),
    tool: actionTool(input)
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
  return {
    status: "accepted",
    ...decision.value,
    decision: decision.metrics
  };
}
function clearActionWithHostPermission(input) {
  const accepted = acceptActionClearance(
    input.candidate,
    input.conclusions,
    input.permission,
    {
      workCaseId: input.candidate.workCaseId,
      actionCandidateId: input.candidate.actionCandidateId,
      conclusionIds: input.candidate.requiredConclusionIds,
      warrantBasis: [
        "Every Conclusion required by the Action Candidate is present in the current canonical inventory."
      ],
      provenance: { kind: "external", source: input.permission.source }
    }
  );
  if (accepted.status === "invalid") {
    return {
      status: "invariant-failure",
      code: accepted.error.code,
      message: accepted.error.message
    };
  }
  if (accepted.status === "not-cleared") {
    return {
      status: "not-cleared",
      assessment: accepted.assessment,
      blockers: accepted.blockers
    };
  }
  return { status: "cleared", clearance: accepted.value };
}

// src/action-loop/sdk/capability-inventory-controller.ts
import { StringEnum as StringEnum2 } from "@earendil-works/pi-ai";
import { Type as Type2 } from "typebox";

// src/action-loop/routing/accept-applicability.ts
var CAPABILITY_ASSIGNMENT_VERSION = "developer-capability-assignment/v1";
var APPLICABILITY_STATUSES = /* @__PURE__ */ new Set([
  "applicable",
  "not-applicable",
  "needs-context"
]);
function invalid13(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId3(id) {
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
    if (!validId3(id)) {
      return invalid13(
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
      return invalid13(
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
    return invalid13(
      "unsupported-status",
      "proposal.status",
      `Unsupported applicability status ${proposal.status}`
    );
  }
  if (proposal.status !== "needs-context" && missingContext.length > 0) {
    return invalid13(
      "unexpected-missing-context",
      "proposal.missingContext",
      "Only needs-context may carry missing context"
    );
  }
  if (proposal.status === "applicable") {
    if (requiresWhenMatch && matchedWhen.length === 0) {
      return invalid13(
        "applicable-without-when",
        "proposal.matchedWhen",
        "Structured applicability requires at least one declared when match"
      );
    }
    if (matchedUnless.length > 0) {
      return invalid13(
        "excluded-by-unless",
        "proposal.matchedUnless",
        "A matched unless condition overrides applicability"
      );
    }
    return void 0;
  }
  if (proposal.status === "not-applicable") {
    if (matchedWhen.length > 0 && matchedUnless.length === 0) {
      return invalid13(
        "not-applicable-with-positive-match",
        "proposal.status",
        "A positive when match requires an excluding unless match"
      );
    }
    return void 0;
  }
  if (matchedUnless.length > 0) {
    return invalid13(
      "decisive-unless-cannot-wait",
      "proposal.matchedUnless",
      "A matched unless condition is already not-applicable"
    );
  }
  if (missingContext.length === 0) {
    return invalid13(
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
    return invalid13(
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
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApplicabilityStatus(value) {
  return applicabilityStatuses.some((status) => status === value);
}
function rejected2(code, message) {
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
    fields[`status_${index}`] = StringEnum2(applicabilityStatuses, {
      description: `${name} \u2014 ${conditions}`
    });
    fields[`basis_${index}`] = Type2.String({
      minLength: 1,
      maxLength: 2048,
      description: `Why ${name} has this status for the current Contribution Need.`
    });
    fields[`missing_context_${index}`] = Type2.Optional(
      Type2.String({ maxLength: 2048 })
    );
    if (entry.routing !== "structured") continue;
    for (const [
      conditionIndex,
      condition
    ] of entry.capability.toc.when.entries()) {
      fields[`when_${index}_${conditionIndex}`] = Type2.Boolean({
        description: `${name} when condition: ${condition}`
      });
    }
    for (const [
      conditionIndex,
      condition
    ] of entry.capability.toc.unless.entries()) {
      fields[`unless_${index}_${conditionIndex}`] = Type2.Boolean({
        description: `${name} unless condition: ${condition}`
      });
    }
  }
  return Type2.Object(fields, { additionalProperties: false });
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
      if (!isRecord2(raw)) {
        return rejected2(
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
          return rejected2(
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
          return rejected2("invalid-when-accounting", matchedWhen.message);
        }
        const matchedUnless = entry.routing === "structured" ? selectedConditions({
          raw,
          prefix: "unless",
          capabilityIndex: index,
          conditions: entry.capability.toc.unless
        }) : { ok: true, value: [] };
        if (!matchedUnless.ok) {
          return rejected2("invalid-unless-accounting", matchedUnless.message);
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
          return rejected2(
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
import { StringEnum as StringEnum3 } from "@earendil-works/pi-ai";
import { Type as Type3 } from "typebox";

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
function sameStrings2(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function checkSelectionState(selection, derived) {
  if (!sameStrings2(selection.selectedPaths, derived.selectedPaths)) {
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
var applicabilityParameters = Type3.Object(
  {
    status: StringEnum3([
      "applicable",
      "not-applicable",
      "needs-context"
    ]),
    matches_when: Type3.Boolean(),
    matches_unless: Type3.Boolean(),
    basis: Type3.String({ minLength: 1, maxLength: 2048 }),
    missing_context: Type3.Optional(Type3.String({ maxLength: 2048 }))
  },
  { additionalProperties: false }
);
var referenceStatuses = ["selected", "not-needed", "needs-context"];
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApplicabilityStatus2(value) {
  return value === "applicable" || value === "not-applicable" || value === "needs-context";
}
function isReferenceStatus(value) {
  return value === "selected" || value === "not-needed" || value === "needs-context";
}
function rejected3(code, message) {
  return { status: "rejected", code, message };
}
function applicabilityTool(target, toc) {
  return {
    name: "submit_capability_applicability",
    label: "Submit capability applicability",
    description: "Submit one semantic applicability decision; the SDK controller supplies exact canonical conditions and identities.",
    parameters: applicabilityParameters,
    execute: async (raw) => {
      if (!isRecord3(raw)) {
        return rejected3(
          "invalid-arguments",
          "Applicability arguments must be an object."
        );
      }
      if (!isApplicabilityStatus2(raw.status) || typeof raw.matches_when !== "boolean" || typeof raw.matches_unless !== "boolean" || typeof raw.basis !== "string" || raw.missing_context !== void 0 && typeof raw.missing_context !== "string") {
        return rejected3(
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
        return rejected3(result.error.code, result.error.message);
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
    fields[`status_${index}`] = StringEnum3(referenceStatuses, {
      description: `${reference.path} \u2014 ${reference.when.join(" | ")}`
    });
    fields[`basis_${index}`] = Type3.String({
      minLength: 1,
      maxLength: 2048,
      description: `Why ${reference.path} is selected, not needed, or needs context relative to every other declared Reference.`
    });
  }
  return Type3.Object(fields, { additionalProperties: false });
}
function referenceTool(toc) {
  return {
    name: "submit_reference_dispositions",
    label: "Submit comparative Reference dispositions",
    description: "Disposition every declared Reference in one comparative proposal; the SDK controller maps flat fields to canonical paths.",
    parameters: referenceParameters(toc),
    execute: async (raw) => {
      if (!isRecord3(raw)) {
        return rejected3(
          "invalid-arguments",
          "Reference arguments must be an object."
        );
      }
      const dispositions = [];
      for (const [index, reference] of toc.references.entries()) {
        const status = raw[`status_${index}`];
        const basis = raw[`basis_${index}`];
        if (!isReferenceStatus(status) || typeof basis !== "string") {
          return rejected3(
            "invalid-reference-disposition",
            `Reference disposition ${index} requires canonical status_${index} and non-empty basis_${index}.`
          );
        }
        dispositions.push({ path: reference.path, status, basis: [basis] });
      }
      const selected = selectDeclaredReferences(toc.references, dispositions);
      if (selected.status === "invalid") {
        return rejected3(
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

// src/action-loop/sdk/completion-controller.ts
import { StringEnum as StringEnum4 } from "@earendil-works/pi-ai";
import { Type as Type4 } from "typebox";

// src/action-loop/work/accept-closure-claim.ts
var CLOSURE_CLAIM_VERSION = "developer-closure-claim/v1";
var PROVENANCE_KINDS6 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function canonicalStrings(values, path, allowed) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      error: {
        code: allowed === void 0 ? "empty-basis" : "undeclared-evidence",
        path,
        message: "Expected a list"
      }
    };
  }
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length === 0 || seen.has(value)) {
      return {
        ok: false,
        error: {
          code: allowed === void 0 ? "empty-basis" : "undeclared-evidence",
          path: `${path}[${index}]`,
          message: "Expected a unique nonblank value"
        }
      };
    }
    if (allowed !== void 0 && !allowed.has(value)) {
      return {
        ok: false,
        error: {
          code: "undeclared-evidence",
          path: `${path}[${index}]`,
          message: `Evidence is not present in the Closure Target: ${value}`
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalBasis9(values, path) {
  const result = canonicalStrings(values, path);
  if (!result.ok) return result;
  if (result.value.length === 0) {
    return {
      ok: false,
      error: { code: "empty-basis", path, message: "Expected explicit basis" }
    };
  }
  return result;
}
function canonicalDisposition(proposal, index, context) {
  const path = `proposal.obligationDispositions[${index}]`;
  if (proposal === void 0 || !context.obligationIds.has(proposal.closureObligationId) || context.accountedIds.has(proposal.closureObligationId)) {
    return {
      ok: false,
      error: {
        code: "obligation-accounting",
        path: `${path}.closureObligationId`,
        message: "Obligation must be declared and accounted exactly once"
      }
    };
  }
  const conclusionIds = canonicalStrings(
    proposal.conclusionIds,
    `${path}.conclusionIds`,
    context.conclusionIds
  );
  if (!conclusionIds.ok) return conclusionIds;
  const effectAssessmentIds = canonicalStrings(
    proposal.effectAssessmentIds,
    `${path}.effectAssessmentIds`,
    context.effectAssessmentIds
  );
  if (!effectAssessmentIds.ok) return effectAssessmentIds;
  const effectRemediationIds = canonicalStrings(
    proposal.effectRemediationIds,
    `${path}.effectRemediationIds`,
    context.effectRemediationIds
  );
  if (!effectRemediationIds.ok) return effectRemediationIds;
  if (conclusionIds.value.length + effectAssessmentIds.value.length + effectRemediationIds.value.length === 0) {
    return {
      ok: false,
      error: {
        code: "evidence-required",
        path,
        message: "Satisfied obligation requires current target evidence"
      }
    };
  }
  const basis = canonicalBasis9(proposal.basis, `${path}.basis`);
  if (!basis.ok) return basis;
  return {
    ok: true,
    value: Object.freeze({
      closureObligationId: proposal.closureObligationId,
      status: "satisfied",
      conclusionIds: conclusionIds.value,
      effectAssessmentIds: effectAssessmentIds.value,
      effectRemediationIds: effectRemediationIds.value,
      basis: basis.value
    })
  };
}
function canonicalDispositionAccounting(target, proposals) {
  if (!Array.isArray(proposals)) {
    return {
      ok: false,
      error: {
        code: "obligation-accounting",
        path: "proposal.obligationDispositions",
        message: "Expected complete Closure obligation accounting"
      }
    };
  }
  const byId = /* @__PURE__ */ new Map();
  const citedConclusionIds = /* @__PURE__ */ new Set();
  const citedEffectAssessmentIds = /* @__PURE__ */ new Set();
  const citedEffectRemediationIds = /* @__PURE__ */ new Set();
  for (let index = 0; index < proposals.length; index += 1) {
    const disposition = canonicalDisposition(proposals[index], index, {
      obligationIds: new Set(
        target.obligations.map(
          ({ closureObligationId }) => closureObligationId
        )
      ),
      accountedIds: new Set(byId.keys()),
      conclusionIds: new Set(target.conclusionIds),
      effectAssessmentIds: new Set(target.effectAssessmentIds),
      effectRemediationIds: new Set(target.effectRemediationIds)
    });
    if (!disposition.ok) return disposition;
    byId.set(disposition.value.closureObligationId, disposition.value);
    for (const id of disposition.value.conclusionIds)
      citedConclusionIds.add(id);
    for (const id of disposition.value.effectAssessmentIds) {
      citedEffectAssessmentIds.add(id);
    }
    for (const id of disposition.value.effectRemediationIds) {
      citedEffectRemediationIds.add(id);
    }
  }
  if (byId.size !== target.obligations.length) {
    return {
      ok: false,
      error: {
        code: "obligation-accounting",
        path: "proposal.obligationDispositions",
        message: "Every Closure obligation requires one disposition"
      }
    };
  }
  const dispositions = [];
  for (const obligation of target.obligations) {
    const disposition = byId.get(obligation.closureObligationId);
    if (disposition === void 0) {
      return {
        ok: false,
        error: {
          code: "obligation-accounting",
          path: "proposal.obligationDispositions",
          message: `Missing obligation: ${obligation.closureObligationId}`
        }
      };
    }
    dispositions.push(disposition);
  }
  return {
    ok: true,
    value: {
      dispositions: Object.freeze(dispositions),
      citedConclusionIds,
      citedEffectAssessmentIds,
      citedEffectRemediationIds
    }
  };
}
function allEvidenceApplied(target, accounting) {
  return target.conclusionIds.every((id) => accounting.citedConclusionIds.has(id)) && target.effectAssessmentIds.every(
    (id) => accounting.citedEffectAssessmentIds.has(id)
  ) && target.effectRemediationIds.every(
    (id) => accounting.citedEffectRemediationIds.has(id)
  );
}
function canonicalProvenance6(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS6.has(provenance.kind) || typeof provenance.source !== "string" || provenance.source.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance",
        message: "Expected explicit Closure Claim provenance"
      }
    };
  }
  return {
    ok: true,
    value: Object.freeze({
      kind: provenance.kind,
      source: provenance.source.trim()
    })
  };
}
function claimIdentityParts(target, mode, dispositions, basis) {
  const parts = [target.closureTargetId, mode];
  for (const disposition of dispositions) {
    parts.push(
      disposition.closureObligationId,
      "conclusions",
      ...disposition.conclusionIds,
      "effect-assessments",
      ...disposition.effectAssessmentIds,
      "effect-remediations",
      ...disposition.effectRemediationIds,
      "basis",
      ...disposition.basis
    );
  }
  parts.push("claim-basis", ...basis);
  return parts;
}
function acceptClosureClaim(target, proposal) {
  if (proposal.workCaseId !== target.workCaseId || proposal.closureTargetId !== target.closureTargetId) {
    return {
      status: "invalid",
      error: {
        code: "identity-mismatch",
        path: "proposal",
        message: "Closure Claim does not bind the sealed Closure Target"
      }
    };
  }
  if (proposal.mode !== "completed" && proposal.mode !== "no-change") {
    return {
      status: "invalid",
      error: {
        code: "unsupported-mode",
        path: "proposal.mode",
        message: "Unsupported Closure Claim mode"
      }
    };
  }
  const accounting = canonicalDispositionAccounting(
    target,
    proposal.obligationDispositions
  );
  if (!accounting.ok) return { status: "invalid", error: accounting.error };
  if (!allEvidenceApplied(target, accounting.value)) {
    return {
      status: "invalid",
      error: {
        code: "evidence-accounting",
        path: "proposal.obligationDispositions",
        message: "Every current Conclusion and Effect assessment must be applied"
      }
    };
  }
  const basis = canonicalBasis9(proposal.basis, "proposal.basis");
  if (!basis.ok) return { status: "invalid", error: basis.error };
  const provenance = canonicalProvenance6(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  return {
    status: "accepted",
    value: Object.freeze({
      closureClaimId: hashIdentity(
        "closure_claim",
        CLOSURE_CLAIM_VERSION,
        claimIdentityParts(
          target,
          proposal.mode,
          accounting.value.dispositions,
          basis.value
        )
      ),
      workCaseId: target.workCaseId,
      workCaseRevisionId: target.workCaseRevisionId,
      closureTargetId: target.closureTargetId,
      mode: proposal.mode,
      obligationDispositions: accounting.value.dispositions,
      basis: basis.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/work/complete-work-case.ts
var WORK_CASE_COMPLETION_VERSION = "developer-work-case-completion/v1";
function refused(code, message) {
  return { status: "refused", refusal: { code, message } };
}
function completeWorkCase(workCase, target, claim) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return refused(
      "stale-work-case",
      "Work Case revision does not match its closure inventory"
    );
  }
  const currentTarget = prepareClosureTarget(workCase);
  if (currentTarget.status !== "ready") {
    return refused(
      "closure-not-ready",
      "Current Work Case cannot produce a complete Closure Target"
    );
  }
  if (target.workCaseId !== workCase.workCaseId || target.workCaseRevisionId !== workCase.revisionId || target.closureTargetId !== currentTarget.value.closureTargetId) {
    return refused(
      "stale-closure-target",
      "Closure Target does not represent the complete current Work Case"
    );
  }
  if (claim.workCaseId !== workCase.workCaseId || claim.workCaseRevisionId !== workCase.revisionId || claim.closureTargetId !== target.closureTargetId) {
    return refused(
      "identity-mismatch",
      "Closure Claim does not bind the current Closure Target"
    );
  }
  const priorRevisionId = workCase.revisionId;
  const revisionId = hashIdentity(
    "work_case_completion",
    WORK_CASE_COMPLETION_VERSION,
    [workCase.workCaseId, priorRevisionId, claim.closureClaimId]
  );
  return {
    status: "completed",
    value: Object.freeze({
      ...workCase,
      status: "complete",
      revisionId,
      priorRevisionId,
      closureTarget: target,
      closureClaim: claim
    })
  };
}

// src/action-loop/sdk/completion-controller.ts
var completionModes = ["completed", "no-change"];
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected4(code, message) {
  return { status: "rejected", code, message };
}
function completionParameters(target) {
  const fields = {
    mode: StringEnum4(completionModes),
    basis_json: Type4.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of one or more whole-Work-Case closure basis strings."
    })
  };
  for (const [index, obligation] of target.obligations.entries()) {
    fields[`obligation_${index}_conclusion_indices_json`] = Type4.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of current Conclusion indices applied here."
    });
    fields[`obligation_${index}_effect_indices_json`] = Type4.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of current Effect assessment indices applied here."
    });
    fields[`obligation_${index}_remediation_indices_json`] = Type4.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of current Effect remediation indices applied here."
    });
    fields[`obligation_${index}_basis`] = Type4.String({
      minLength: 1,
      maxLength: 2048,
      description: `${obligation.kind}: ${obligation.statement}`
    });
  }
  return Type4.Object(fields, { additionalProperties: false });
}
function decodeIndexList(input) {
  const decoded = decodeSdkProposalJson(input.value, input.label);
  if (!decoded.ok) return decoded;
  if (!Array.isArray(decoded.value) || decoded.value.length > input.inventory.length || decoded.value.some(
    (index) => typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= input.inventory.length
  )) {
    return {
      ok: false,
      message: `${input.label} must encode only current inventory indices.`
    };
  }
  const indices = decoded.value;
  if (new Set(indices).size !== indices.length) {
    return {
      ok: false,
      message: `${input.label} cannot contain duplicate indices.`
    };
  }
  return {
    ok: true,
    value: Object.freeze(indices.map((index) => input.inventory[index] ?? ""))
  };
}
function decodeObligationDisposition(input) {
  const obligation = input.target.obligations[input.index];
  if (obligation === void 0) {
    return {
      ok: false,
      message: `Closure Obligation ${input.index} is unavailable.`
    };
  }
  const prefix = `obligation_${input.index}`;
  const conclusionIds = decodeIndexList({
    value: input.raw[`${prefix}_conclusion_indices_json`],
    label: `${prefix}_conclusion_indices_json`,
    inventory: input.target.conclusionIds
  });
  if (!conclusionIds.ok) return conclusionIds;
  const effectAssessmentIds = decodeIndexList({
    value: input.raw[`${prefix}_effect_indices_json`],
    label: `${prefix}_effect_indices_json`,
    inventory: input.target.effectAssessmentIds
  });
  if (!effectAssessmentIds.ok) return effectAssessmentIds;
  const effectRemediationIds = decodeIndexList({
    value: input.raw[`${prefix}_remediation_indices_json`],
    label: `${prefix}_remediation_indices_json`,
    inventory: input.target.effectRemediationIds
  });
  if (!effectRemediationIds.ok) return effectRemediationIds;
  const basis = input.raw[`${prefix}_basis`];
  if (typeof basis !== "string") {
    return {
      ok: false,
      message: `${prefix}_basis must be non-empty text.`
    };
  }
  return {
    ok: true,
    value: {
      closureObligationId: obligation.closureObligationId,
      conclusionIds: conclusionIds.value,
      effectAssessmentIds: effectAssessmentIds.value,
      effectRemediationIds: effectRemediationIds.value,
      basis: [basis]
    }
  };
}
function decodeObligationDispositions(input) {
  const dispositions = [];
  for (const index of input.target.obligations.keys()) {
    const disposition = decodeObligationDisposition({ ...input, index });
    if (!disposition.ok) return disposition;
    dispositions.push(disposition.value);
  }
  return { ok: true, value: Object.freeze(dispositions) };
}
function completionTool(input) {
  return {
    name: "submit_work_case_completion",
    label: "Submit complete current Work Case closure accounting",
    description: "Apply all current Conclusions, Effect assessments, and remediations to every closure obligation before atomic revalidation.",
    parameters: completionParameters(input.target),
    execute: async (raw) => {
      if (!isRecord4(raw)) {
        return rejected4(
          "invalid-arguments",
          "Completion arguments must be an object."
        );
      }
      if (raw.mode !== "completed" && raw.mode !== "no-change") {
        return rejected4(
          "invalid-completion-mode",
          "mode must be completed or no-change."
        );
      }
      const dispositions = decodeObligationDispositions({
        raw,
        target: input.target
      });
      if (!dispositions.ok) {
        return rejected4("invalid-obligation-accounting", dispositions.message);
      }
      const basis = decodeSdkStringList({
        value: raw.basis_json,
        label: "basis_json",
        allowEmpty: false,
        maximumItems: 32
      });
      if (!basis.ok) return rejected4("invalid-basis", basis.message);
      const claim = acceptClosureClaim(input.target, {
        workCaseId: input.workCase.workCaseId,
        closureTargetId: input.target.closureTargetId,
        mode: raw.mode,
        obligationDispositions: dispositions.value,
        basis: basis.value,
        provenance: { kind: "model", source: "pi:sdk-action-loop" }
      });
      if (claim.status === "invalid") {
        return rejected4(claim.error.code, claim.error.message);
      }
      const completed = completeWorkCase(
        input.workCase,
        input.target,
        claim.value
      );
      if (completed.status === "refused") {
        return rejected4(completed.refusal.code, completed.refusal.message);
      }
      return {
        status: "accepted",
        value: { claim: claim.value, completed: completed.value },
        message: `Work Case completion accepted as ${claim.value.mode}.`,
        resultStatus: claim.value.mode
      };
    }
  };
}
function completionPrompt(input) {
  const obligations = input.target.obligations.map(
    (obligation, index) => `Obligation ${index} (${obligation.kind}): ${obligation.statement}`
  ).join("\n");
  const conclusions = input.workCase.conclusions.map(
    (conclusion, index) => `Conclusion ${index} (${conclusion.category}): ${conclusion.answer}`
  ).join("\n");
  const effects = input.workCase.currentEffectAssessments.map(
    (assessment, index) => `Effect assessment ${index}: ${assessment.outcome} \u2014 ${assessment.basis.join(" | ")}`
  ).join("\n");
  const remediations = input.workCase.effectRemediations.map(
    (remediation, index) => `Effect remediation ${index}: ${remediation.basis.join(" | ")}`
  ).join("\n");
  return [
    `Delegated request:
${input.request}`,
    `Outcome:
${input.workCase.outcome.statement}`,
    `Current closure obligations:
${obligations}`,
    `Current Conclusions:
${conclusions || "none"}`,
    `Current Effect assessments:
${effects || "none"}`,
    `Current Effect remediations:
${remediations || "none"}`,
    "Map every current evidence item to one or more obligations where it materially applies. The SDK will reject omitted, stale, duplicate, or caller-selected subsets and revalidate the complete current revision."
  ].join("\n\n");
}
async function completeWorkCaseWithSdk(input) {
  const prepared = prepareClosureTarget(input.workCase);
  if (prepared.status === "invalid") {
    return {
      status: "invariant-failure",
      code: prepared.error.code,
      message: prepared.error.message
    };
  }
  if (prepared.status === "not-ready") {
    return { status: "not-ready", blockers: prepared.blockers };
  }
  const decision = await input.runner.run({
    systemPrompt: [
      "Account for one complete current Work Case closure target.",
      "Call the supplied decision tool exactly once and disposition every closure obligation.",
      "Apply every current Conclusion, Effect assessment, and remediation without inventing identities.",
      "The SDK controller owns the complete inventory, canonical admission, current-revision revalidation, retries, and stop decisions."
    ].join("\n"),
    prompt: completionPrompt({ ...input, target: prepared.value }),
    tool: completionTool({
      workCase: input.workCase,
      target: prepared.value
    })
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
  const revalidated = completeWorkCase(
    input.workCase,
    prepared.value,
    decision.value.claim
  );
  if (revalidated.status === "refused" || revalidated.value.revisionId !== decision.value.completed.revisionId) {
    return {
      status: "invariant-failure",
      code: revalidated.status === "refused" ? revalidated.refusal.code : "completion-identity-drift",
      message: revalidated.status === "refused" ? revalidated.refusal.message : "Accepted Work Case completion did not reproduce its identity.",
      decision: decision.metrics
    };
  }
  return {
    status: "completed",
    target: prepared.value,
    claim: decision.value.claim,
    workCase: revalidated.value,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/context-progress.ts
function invalid14(code, message) {
  return { status: "invalid", code, message };
}
function indexAssignments(input) {
  const assignments = /* @__PURE__ */ new Map();
  for (const assignment of input.assignments) {
    if (assignment.workCaseId !== input.workCaseId || assignment.judgmentId !== input.judgmentId || assignment.contributionNeedId !== input.contributionNeedId) {
      return {
        ok: false,
        error: invalid14(
          "assignment-mismatch",
          `Assignment ${assignment.assignmentId} does not belong to the requested Work Case, Judgment, and Contribution Need.`
        )
      };
    }
    if (assignments.has(assignment.assignmentId)) {
      return {
        ok: false,
        error: invalid14(
          "duplicate-assignment",
          `Assignment ${assignment.assignmentId} occurs more than once.`
        )
      };
    }
    assignments.set(assignment.assignmentId, assignment);
  }
  return { ok: true, value: assignments };
}
function indexSelections(selections, assignments) {
  const indexed = /* @__PURE__ */ new Map();
  for (const selection of selections) {
    const assignment = assignments.get(selection.assignmentId);
    if (assignment === void 0 || selection.capabilityRevisionId !== assignment.capabilityRevisionId) {
      return {
        ok: false,
        error: invalid14(
          "selection-mismatch",
          `Reference Selection ${selection.selectionId} has no exact current Assignment.`
        )
      };
    }
    if (indexed.has(selection.assignmentId)) {
      return {
        ok: false,
        error: invalid14(
          "duplicate-selection",
          `Assignment ${selection.assignmentId} has more than one Reference Selection.`
        )
      };
    }
    indexed.set(selection.assignmentId, selection);
  }
  return { ok: true, value: indexed };
}
function matchingContext(input, context, assignment) {
  return assignment !== void 0 && context.workCaseId === input.workCaseId && context.judgmentId === input.judgmentId && context.contributionNeedId === input.contributionNeedId && context.capabilityRevisionId === assignment.capabilityRevisionId;
}
function matchingContextMode(context, selection) {
  if ("routing" in context) return selection === void 0;
  return selection !== void 0 && selection.status === "ready" && selection.selectionId === context.selectionId;
}
function indexContexts(input, assignments, selections) {
  const indexed = /* @__PURE__ */ new Map();
  for (const context of input.contexts) {
    if (!matchingContext(input, context, assignments.get(context.assignmentId))) {
      return {
        ok: false,
        error: invalid14(
          "context-mismatch",
          `Sealed Context ${context.sealedContextId} has no exact current Assignment.`
        )
      };
    }
    if (indexed.has(context.assignmentId)) {
      return {
        ok: false,
        error: invalid14(
          "duplicate-context",
          `Assignment ${context.assignmentId} has more than one sealed Context.`
        )
      };
    }
    if (!matchingContextMode(context, selections.get(context.assignmentId))) {
      return {
        ok: false,
        error: invalid14(
          "inconsistent-context",
          `Sealed Context ${context.sealedContextId} does not match its routing mode and Reference Selection.`
        )
      };
    }
    indexed.set(context.assignmentId, context);
  }
  return { ok: true, value: indexed };
}
function validateSelections(selections, contexts) {
  for (const selection of selections) {
    const hasContext = contexts.has(selection.assignmentId);
    if (selection.status === "ready" && !hasContext) {
      return invalid14(
        "inconsistent-context",
        `Ready Reference Selection ${selection.selectionId} has no sealed Context.`
      );
    }
    if (selection.status === "needs-context" && hasContext) {
      return invalid14(
        "inconsistent-context",
        `Unresolved Reference Selection ${selection.selectionId} cannot have a sealed Context.`
      );
    }
  }
  return void 0;
}
function inspectCapabilityContextProgress(input) {
  const assignments = indexAssignments(input);
  if (!assignments.ok) return assignments.error;
  const selections = indexSelections(input.selections, assignments.value);
  if (!selections.ok) return selections.error;
  const contexts = indexContexts(input, assignments.value, selections.value);
  if (!contexts.ok) return contexts.error;
  const inconsistency = validateSelections(input.selections, contexts.value);
  if (inconsistency !== void 0) return inconsistency;
  const completedAssignmentIds = Object.freeze(
    [...contexts.value.keys()].sort((left, right) => left.localeCompare(right))
  );
  const unresolvedSelections = Object.freeze(
    input.selections.filter((selection) => selection.status === "needs-context").sort(
      (left, right) => left.assignmentId.localeCompare(right.assignmentId)
    )
  );
  const unresolvedAssignmentIds = new Set(
    unresolvedSelections.map((selection) => selection.assignmentId)
  );
  const pendingAssignments = Object.freeze(
    input.assignments.filter(
      (assignment) => !contexts.value.has(assignment.assignmentId) && !unresolvedAssignmentIds.has(assignment.assignmentId)
    ).sort(
      (left, right) => left.assignmentId.localeCompare(right.assignmentId)
    )
  );
  if (pendingAssignments.length > 0) {
    return {
      status: "pending",
      pendingAssignments,
      unresolvedSelections,
      completedAssignmentIds
    };
  }
  if (unresolvedSelections.length > 0) {
    return {
      status: "needs-context",
      pendingAssignments: Object.freeze([]),
      unresolvedSelections,
      completedAssignmentIds
    };
  }
  return {
    status: "complete",
    pendingAssignments: Object.freeze([]),
    unresolvedSelections: Object.freeze([]),
    completedAssignmentIds
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

// src/action-loop/sdk/conclusion-controller.ts
import { StringEnum as StringEnum5 } from "@earendil-works/pi-ai";
import { Type as Type5 } from "typebox";

// src/action-loop/judgment/close-judgment.ts
var JUDGMENT_CONCLUSION_VERSION = "developer-judgment-conclusion/v1";
var JUDGMENT_REFUSAL_VERSION = "developer-judgment-refusal/v1";
var JUDGMENT_CATEGORIES = /* @__PURE__ */ new Set([
  "Contextual Adequacy",
  "Proportionate Intervention",
  "Consequence Integrity",
  "Claim Assurance"
]);
var REQUIREMENT_STATUSES = /* @__PURE__ */ new Set([
  "satisfied",
  "not-satisfied",
  "needs-context"
]);
var CLOSURE_OUTCOMES = /* @__PURE__ */ new Set(["conclude", "refuse"]);
var PROVENANCE_KINDS7 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid15(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId4(id) {
  return id.length > 0 && id === id.trim() && !id.includes("\0");
}
function canonicalText13(value, code, path) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.includes("\0")) {
    return {
      ok: false,
      error: { code, path, message: "Expected a nonblank canonical value" }
    };
  }
  return { ok: true, value: normalized };
}
function canonicalList3(values, path, invalidCode) {
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const item = canonicalText13(
      values[index] ?? "",
      invalidCode,
      `${path}[${index}]`
    );
    if (!item.ok) return item;
    if (seen.has(item.value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Value duplicates an earlier normalized value"
        }
      };
    }
    seen.add(item.value);
    normalized.push(item.value);
  }
  return { ok: true, value: Object.freeze(normalized) };
}
function buildRequirementInventory(contract) {
  for (const [path, id] of [
    ["contract.workCaseId", contract.workCaseId],
    ["contract.judgmentId", contract.judgmentId],
    ["contract.contextRevisionId", contract.contextRevisionId]
  ]) {
    if (!validId4(id)) {
      return {
        ok: false,
        error: {
          code: "invalid-contract",
          path,
          message: "Expected a canonical contract ID"
        }
      };
    }
  }
  if (!JUDGMENT_CATEGORIES.has(contract.category)) {
    return {
      ok: false,
      error: {
        code: "unsupported-category",
        path: "contract.category",
        message: `Unsupported Judgment Category ${contract.category}`
      }
    };
  }
  const subject = canonicalText13(
    contract.subject,
    "invalid-contract",
    "contract.subject"
  );
  if (!subject.ok) return subject;
  if (contract.requirements.length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-contract",
        path: "contract.requirements",
        message: "Judgment closure requires at least one Closure Requirement"
      }
    };
  }
  const ordered = [];
  const byId = /* @__PURE__ */ new Map();
  const mappedNeedIds = /* @__PURE__ */ new Set();
  for (const [index, requirement] of contract.requirements.entries()) {
    if (!validId4(requirement.requirementId) || byId.has(requirement.requirementId)) {
      return {
        ok: false,
        error: {
          code: "invalid-contract",
          path: `contract.requirements[${index}].requirementId`,
          message: "Closure Requirement ID must be canonical and unique"
        }
      };
    }
    const statement = canonicalText13(
      requirement.statement,
      "invalid-contract",
      `contract.requirements[${index}].statement`
    );
    if (!statement.ok) return statement;
    const needIds = [];
    const localNeeds = /* @__PURE__ */ new Set();
    for (const [
      needIndex,
      needId
    ] of requirement.contributionNeedIds.entries()) {
      if (!validId4(needId) || localNeeds.has(needId)) {
        return {
          ok: false,
          error: {
            code: "invalid-contract",
            path: `contract.requirements[${index}].contributionNeedIds[${needIndex}]`,
            message: "Contribution Need ID must be canonical and unique per Requirement"
          }
        };
      }
      localNeeds.add(needId);
      mappedNeedIds.add(needId);
      needIds.push(needId);
    }
    const canonical = Object.freeze({
      requirementId: requirement.requirementId,
      statement: statement.value,
      contributionNeedIds: Object.freeze(needIds)
    });
    ordered.push(canonical);
    byId.set(canonical.requirementId, canonical);
  }
  return {
    ok: true,
    value: {
      ordered: Object.freeze(ordered),
      byId,
      mappedNeedIds
    }
  };
}
function checkProposalIdentity(contract, proposal) {
  for (const [path, actual, expected] of [
    ["proposal.workCaseId", proposal.workCaseId, contract.workCaseId],
    ["proposal.judgmentId", proposal.judgmentId, contract.judgmentId],
    ["proposal.category", proposal.category, contract.category],
    [
      "proposal.contextRevisionId",
      proposal.contextRevisionId,
      contract.contextRevisionId
    ]
  ]) {
    if (actual !== expected) {
      return invalid15(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
function buildCoverageInventory(contract, requirements, coverages) {
  const byId = /* @__PURE__ */ new Map();
  const byNeedId = /* @__PURE__ */ new Map();
  for (const [index, coverage] of coverages.entries()) {
    for (const [path, actual, expected] of [
      [
        `coverages[${index}].workCaseId`,
        coverage.workCaseId,
        contract.workCaseId
      ],
      [
        `coverages[${index}].judgmentId`,
        coverage.judgmentId,
        contract.judgmentId
      ]
    ]) {
      if (actual !== expected) {
        return {
          ok: false,
          error: {
            code: "identity-mismatch",
            path,
            message: `Expected ${expected}, received ${actual}`
          }
        };
      }
    }
    if (byId.has(coverage.coverageId) || byNeedId.has(coverage.contributionNeedId)) {
      return {
        ok: false,
        error: {
          code: "duplicate-coverage",
          path: `coverages[${index}]`,
          message: "Current Coverage inventory contains a duplicate ID or Need"
        }
      };
    }
    if (!requirements.mappedNeedIds.has(coverage.contributionNeedId)) {
      return {
        ok: false,
        error: {
          code: "unmapped-coverage",
          path: `coverages[${index}].contributionNeedId`,
          message: "Coverage does not belong to a current Closure Requirement"
        }
      };
    }
    byId.set(coverage.coverageId, coverage);
    byNeedId.set(coverage.contributionNeedId, coverage);
  }
  return { ok: true, value: { byId, byNeedId } };
}
function expectedCoverageIds(requirement, coverages) {
  return Object.freeze(
    requirement.contributionNeedIds.flatMap((needId) => {
      const coverage = coverages.byNeedId.get(needId);
      return coverage === void 0 ? [] : [coverage.coverageId];
    })
  );
}
function canonicalCoverageCitations(requirement, coverages, coverageIds, path) {
  const expected = expectedCoverageIds(requirement, coverages);
  const seen = /* @__PURE__ */ new Set();
  for (const coverageId of coverageIds) {
    const coverage = coverages.byId.get(coverageId);
    if (coverage === void 0 || seen.has(coverageId) || !requirement.contributionNeedIds.includes(coverage.contributionNeedId)) {
      return {
        ok: false,
        error: {
          code: "coverage-citation",
          path,
          message: "Coverage citation must be current, unique, and Requirement-bounded"
        }
      };
    }
    seen.add(coverageId);
  }
  if (coverageIds.length !== expected.length || expected.some((coverageId) => !seen.has(coverageId))) {
    return {
      ok: false,
      error: {
        code: "coverage-citation",
        path,
        message: "Requirement must cite every current mapped Coverage exactly once"
      }
    };
  }
  return { ok: true, value: expected };
}
function canonicalRequirementDisposition(requirement, coverages, proposal, index) {
  if (!REQUIREMENT_STATUSES.has(proposal.status)) {
    return {
      ok: false,
      error: {
        code: "unsupported-requirement-status",
        path: `proposal.requirementDispositions[${index}].status`,
        message: `Unsupported Requirement status ${proposal.status}`
      }
    };
  }
  const coverageIds = canonicalCoverageCitations(
    requirement,
    coverages,
    proposal.coverageIds,
    `proposal.requirementDispositions[${index}].coverageIds`
  );
  if (!coverageIds.ok) return coverageIds;
  const basisPath = `proposal.requirementDispositions[${index}].basis`;
  const basis = canonicalList3(proposal.basis, basisPath, "empty-basis");
  if (!basis.ok) return basis;
  if (basis.value.length === 0) {
    return {
      ok: false,
      error: {
        code: "empty-basis",
        path: basisPath,
        message: "Requirement disposition requires explicit basis"
      }
    };
  }
  return {
    ok: true,
    value: Object.freeze({
      requirementId: proposal.requirementId,
      status: proposal.status,
      coverageIds: coverageIds.value,
      basis: basis.value
    })
  };
}
function canonicalRequirementDispositions(requirements, coverages, proposals) {
  const byId = /* @__PURE__ */ new Map();
  for (const [index, proposal] of proposals.entries()) {
    const requirement = requirements.byId.get(proposal.requirementId);
    if (requirement === void 0 || byId.has(proposal.requirementId)) {
      return {
        ok: false,
        error: {
          code: "requirement-accounting",
          path: `proposal.requirementDispositions[${index}].requirementId`,
          message: "Requirement must be current and dispositioned exactly once"
        }
      };
    }
    const disposition = canonicalRequirementDisposition(
      requirement,
      coverages,
      proposal,
      index
    );
    if (!disposition.ok) return disposition;
    byId.set(proposal.requirementId, disposition.value);
  }
  if (byId.size !== requirements.ordered.length) {
    return {
      ok: false,
      error: {
        code: "requirement-accounting",
        path: "proposal.requirementDispositions",
        message: "Every current Closure Requirement requires one disposition"
      }
    };
  }
  const ordered = [];
  for (const requirement of requirements.ordered) {
    const disposition = byId.get(requirement.requirementId);
    if (disposition === void 0) {
      return {
        ok: false,
        error: {
          code: "requirement-accounting",
          path: "proposal.requirementDispositions",
          message: `Requirement has no disposition: ${requirement.requirementId}`
        }
      };
    }
    ordered.push(disposition);
  }
  return { ok: true, value: Object.freeze(ordered) };
}
function canonicalProvenance7(proposal) {
  if (!PROVENANCE_KINDS7.has(proposal.kind)) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.kind",
        message: `Unsupported provenance kind ${proposal.kind}`
      }
    };
  }
  const source = canonicalText13(
    proposal.source,
    "invalid-provenance",
    "proposal.provenance.source"
  );
  if (!source.ok) return source;
  return {
    ok: true,
    value: Object.freeze({ kind: proposal.kind, source: source.value })
  };
}
function structuralBlockers(requirements, coverages, dispositions) {
  const dispositionById = new Map(
    dispositions.map((disposition) => [disposition.requirementId, disposition])
  );
  const blockers = [];
  for (const requirement of requirements.ordered) {
    const disposition = dispositionById.get(requirement.requirementId);
    if (disposition === void 0) continue;
    if (disposition.status !== "satisfied") {
      blockers.push(
        Object.freeze({
          code: "requirement-unmet",
          requirementId: requirement.requirementId,
          requirementStatus: disposition.status
        })
      );
    }
    for (const contributionNeedId of requirement.contributionNeedIds) {
      const coverage = coverages.byNeedId.get(contributionNeedId);
      if (coverage === void 0) {
        blockers.push(
          Object.freeze({
            code: "coverage-missing",
            requirementId: requirement.requirementId,
            contributionNeedId
          })
        );
      } else if (coverage.status !== "covered") {
        blockers.push(
          Object.freeze({
            code: "coverage-not-covered",
            requirementId: requirement.requirementId,
            contributionNeedId,
            coverageId: coverage.coverageId,
            coverageStatus: coverage.status
          })
        );
      }
    }
  }
  return Object.freeze(blockers);
}
function uniqueCoverageIds(dispositions) {
  const ids = [];
  const seen = /* @__PURE__ */ new Set();
  for (const disposition of dispositions) {
    for (const coverageId of disposition.coverageIds) {
      if (!seen.has(coverageId)) {
        seen.add(coverageId);
        ids.push(coverageId);
      }
    }
  }
  return Object.freeze(ids);
}
function contractIdentityParts(contract, requirements) {
  const parts = [
    contract.workCaseId,
    contract.judgmentId,
    contract.category,
    contract.subject.trim(),
    contract.contextRevisionId,
    "requirements",
    String(requirements.length)
  ];
  for (const requirement of requirements) {
    parts.push(
      requirement.requirementId,
      requirement.statement,
      String(requirement.contributionNeedIds.length),
      ...requirement.contributionNeedIds
    );
  }
  return parts;
}
function dispositionIdentityParts(dispositions) {
  const parts = [];
  for (const disposition of dispositions) {
    parts.push(
      disposition.requirementId,
      disposition.status,
      String(disposition.coverageIds.length),
      ...disposition.coverageIds,
      String(disposition.basis.length),
      ...disposition.basis
    );
  }
  return parts;
}
function blockerIdentityParts(blockers) {
  const parts = [];
  for (const blocker of blockers) {
    parts.push(blocker.code);
    if (blocker.code === "requirement-unmet") {
      parts.push(blocker.requirementId, blocker.requirementStatus);
    } else if (blocker.code === "coverage-missing") {
      parts.push(blocker.requirementId, blocker.contributionNeedId);
    } else if (blocker.code === "coverage-not-covered") {
      parts.push(
        blocker.requirementId,
        blocker.contributionNeedId,
        blocker.coverageId,
        blocker.coverageStatus
      );
    } else {
      parts.push(blocker.reason);
    }
  }
  return parts;
}
function validateClosureOutcome(proposal) {
  if (!CLOSURE_OUTCOMES.has(proposal.outcome)) {
    return {
      ok: false,
      error: {
        code: "unsupported-outcome",
        path: "proposal.outcome",
        message: `Unsupported closure outcome ${proposal.outcome}`
      }
    };
  }
  const refusalReasons = canonicalList3(
    proposal.refusalReasons,
    "proposal.refusalReasons",
    "invalid-refusal"
  );
  if (!refusalReasons.ok) return refusalReasons;
  if (proposal.outcome === "conclude") {
    const answer = canonicalText13(
      proposal.answer ?? "",
      "invalid-conclusion-answer",
      "proposal.answer"
    );
    if (!answer.ok) return answer;
    if (refusalReasons.value.length > 0) {
      return {
        ok: false,
        error: {
          code: "invalid-refusal",
          path: "proposal.refusalReasons",
          message: "Conclude outcome cannot also carry refusal reasons"
        }
      };
    }
    return { ok: true, value: { answer: answer.value, refusalReasons: [] } };
  }
  if (proposal.answer !== void 0 || refusalReasons.value.length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-refusal",
        path: "proposal",
        message: "Refuse outcome requires reasons and cannot carry an answer"
      }
    };
  }
  return { ok: true, value: { refusalReasons: refusalReasons.value } };
}
function validateClosureInput(contract, coverages, proposal) {
  const requirements = buildRequirementInventory(contract);
  if (!requirements.ok) return requirements;
  const identityFailure = checkProposalIdentity(contract, proposal);
  if (identityFailure?.status === "invalid") {
    return { ok: false, error: identityFailure.error };
  }
  const outcome = validateClosureOutcome(proposal);
  if (!outcome.ok) return outcome;
  const coverageInventory = buildCoverageInventory(
    contract,
    requirements.value,
    coverages
  );
  if (!coverageInventory.ok) return coverageInventory;
  const dispositions = canonicalRequirementDispositions(
    requirements.value,
    coverageInventory.value,
    proposal.requirementDispositions
  );
  if (!dispositions.ok) return dispositions;
  const basis = canonicalList3(proposal.basis, "proposal.basis", "empty-basis");
  if (!basis.ok) return basis;
  if (basis.value.length === 0) {
    return {
      ok: false,
      error: {
        code: "empty-basis",
        path: "proposal.basis",
        message: "Judgment closure requires explicit basis"
      }
    };
  }
  const provenance = canonicalProvenance7(proposal.provenance);
  if (!provenance.ok) return provenance;
  return {
    ok: true,
    value: {
      requirements: requirements.value,
      coverages: coverageInventory.value,
      dispositions: dispositions.value,
      basis: basis.value,
      provenance: provenance.value,
      answer: outcome.value.answer,
      refusalReasons: outcome.value.refusalReasons
    }
  };
}
function conclusionResult(contract, validated) {
  const coverageIds = uniqueCoverageIds(validated.dispositions);
  const conclusionId = hashIdentity("conclusion", JUDGMENT_CONCLUSION_VERSION, [
    ...contractIdentityParts(contract, validated.requirements.ordered),
    ...dispositionIdentityParts(validated.dispositions),
    validated.answer,
    String(validated.basis.length),
    ...validated.basis
  ]);
  return {
    status: "concluded",
    value: Object.freeze({
      conclusionId,
      workCaseId: contract.workCaseId,
      judgmentId: contract.judgmentId,
      category: contract.category,
      subject: contract.subject.trim(),
      contextRevisionId: contract.contextRevisionId,
      answer: validated.answer,
      requirementDispositions: validated.dispositions,
      coverageIds,
      basis: validated.basis,
      provenance: validated.provenance
    })
  };
}
function refusalResult(contract, proposal, validated, blockers) {
  const coverageIds = uniqueCoverageIds(validated.dispositions);
  const refusalId = hashIdentity("refusal", JUDGMENT_REFUSAL_VERSION, [
    ...contractIdentityParts(contract, validated.requirements.ordered),
    proposal.outcome,
    ...dispositionIdentityParts(validated.dispositions),
    ...blockerIdentityParts(blockers),
    String(validated.basis.length),
    ...validated.basis
  ]);
  return {
    status: "refused",
    value: Object.freeze({
      refusalId,
      workCaseId: contract.workCaseId,
      judgmentId: contract.judgmentId,
      category: contract.category,
      subject: contract.subject.trim(),
      contextRevisionId: contract.contextRevisionId,
      proposedOutcome: proposal.outcome,
      requirementDispositions: validated.dispositions,
      coverageIds,
      blockers,
      basis: validated.basis,
      provenance: validated.provenance
    })
  };
}
function closeJudgment(contract, coverages, proposal) {
  const validated = validateClosureInput(contract, coverages, proposal);
  if (!validated.ok) return { status: "invalid", error: validated.error };
  const structural = structuralBlockers(
    validated.value.requirements,
    validated.value.coverages,
    validated.value.dispositions
  );
  const evaluatorBlockers = validated.value.refusalReasons.map(
    (reason) => Object.freeze({ code: "evaluator-refused", reason })
  );
  const blockers = Object.freeze([...structural, ...evaluatorBlockers]);
  if (proposal.outcome === "conclude" && blockers.length === 0 && validated.value.answer !== void 0) {
    return conclusionResult(contract, {
      ...validated.value,
      answer: validated.value.answer
    });
  }
  return refusalResult(contract, proposal, validated.value, blockers);
}

// src/action-loop/sdk/conclusion-controller.ts
var closureOutcomes = ["conclude", "refuse"];
var requirementStatuses = [
  "satisfied",
  "not-satisfied",
  "needs-context"
];
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected5(code, message) {
  return { status: "rejected", code, message };
}
function conclusionParameters(requirements) {
  const fields = {
    outcome: StringEnum5(closureOutcomes),
    answer: Type5.Optional(Type5.String({ minLength: 1, maxLength: 12e3 })),
    refusal_reasons_json: Type5.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of explicit evaluator refusal reasons. Use [] unless refusing or preserving an additional blocker."
    }),
    basis_json: Type5.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of one or more synthesis basis strings."
    })
  };
  for (const [index, requirement] of requirements.entries()) {
    fields[`requirement_status_${index}`] = StringEnum5(requirementStatuses, {
      description: requirement.statement
    });
    fields[`requirement_basis_${index}`] = Type5.String({
      minLength: 1,
      maxLength: 2048
    });
  }
  return Type5.Object(fields, { additionalProperties: false });
}
function mappedCoverageIds(requirement, coverages) {
  const needIds = new Set(requirement.contributionNeedIds);
  return Object.freeze(
    coverages.flatMap(
      (coverage) => needIds.has(coverage.contributionNeedId) ? [coverage.coverageId] : []
    ).sort((left, right) => left.localeCompare(right))
  );
}
function decodeRequirementDispositions(input) {
  const dispositions = [];
  for (const [index, requirement] of input.requirements.entries()) {
    const status = input.raw[`requirement_status_${index}`];
    const basis = input.raw[`requirement_basis_${index}`];
    if (status !== "satisfied" && status !== "not-satisfied" && status !== "needs-context" || typeof basis !== "string") {
      return {
        ok: false,
        message: `Requirement ${index} requires a canonical status and basis.`
      };
    }
    dispositions.push({
      requirementId: requirement.requirementId,
      status,
      coverageIds: mappedCoverageIds(requirement, input.coverages),
      basis: [basis]
    });
  }
  return { ok: true, value: Object.freeze(dispositions) };
}
function canonicalProposal(input) {
  const outcome = input.raw.outcome;
  if (outcome !== "conclude" && outcome !== "refuse") {
    return {
      ok: false,
      code: "invalid-outcome",
      message: "outcome must be conclude or refuse."
    };
  }
  if (input.raw.answer !== void 0 && typeof input.raw.answer !== "string") {
    return {
      ok: false,
      code: "invalid-answer",
      message: "answer must be text when supplied."
    };
  }
  const refusalReasons = decodeSdkStringList({
    value: input.raw.refusal_reasons_json,
    label: "refusal_reasons_json",
    allowEmpty: true,
    maximumItems: 32
  });
  if (!refusalReasons.ok) {
    return {
      ok: false,
      code: "invalid-refusal-reasons",
      message: refusalReasons.message
    };
  }
  const basis = decodeSdkStringList({
    value: input.raw.basis_json,
    label: "basis_json",
    allowEmpty: false,
    maximumItems: 32
  });
  if (!basis.ok) {
    return { ok: false, code: "invalid-basis", message: basis.message };
  }
  const dispositions = decodeRequirementDispositions({
    raw: input.raw,
    requirements: input.contract.requirements,
    coverages: input.coverages
  });
  if (!dispositions.ok) {
    return {
      ok: false,
      code: "invalid-requirement-dispositions",
      message: dispositions.message
    };
  }
  return {
    ok: true,
    value: {
      workCaseId: input.contract.workCaseId,
      judgmentId: input.contract.judgmentId,
      category: input.contract.category,
      contextRevisionId: input.contract.contextRevisionId,
      outcome,
      ...typeof input.raw.answer === "string" ? { answer: input.raw.answer } : {},
      refusalReasons: refusalReasons.value,
      requirementDispositions: dispositions.value,
      basis: basis.value,
      provenance: { kind: "model", source: "pi:sdk-action-loop" }
    }
  };
}
function conclusionTool(input) {
  return {
    name: "submit_judgment_conclusion",
    label: "Submit one upper Judgment synthesis",
    description: "Synthesize complete current Need Coverage into a Conclusion or explicit bounded refusal.",
    parameters: conclusionParameters(input.contract.requirements),
    execute: async (raw) => {
      if (!isRecord5(raw)) {
        return rejected5(
          "invalid-arguments",
          "Conclusion arguments must be an object."
        );
      }
      const proposal = canonicalProposal({ ...input, raw });
      if (!proposal.ok) return rejected5(proposal.code, proposal.message);
      const closed = closeJudgment(
        input.contract,
        input.coverages,
        proposal.value
      );
      if (closed.status === "invalid") {
        return rejected5(closed.error.code, closed.error.message);
      }
      return {
        status: "accepted",
        value: { proposal: proposal.value, result: closed },
        message: closed.status === "concluded" ? "Judgment Conclusion accepted." : "Judgment closure refusal accepted.",
        resultStatus: closed.status
      };
    }
  };
}
function conclusionPrompt(input) {
  const coverageByNeed = new Map(
    input.coverages.map((coverage) => [coverage.contributionNeedId, coverage])
  );
  const requirements = input.contract.requirements.map((requirement, index) => {
    const coverages = requirement.contributionNeedIds.map((needId) => {
      const coverage = coverageByNeed.get(needId);
      return coverage ? `${needId}: ${coverage.status} \u2014 ${coverage.basis.join(" | ")}` : `${needId}: no current Coverage`;
    });
    return [
      `Requirement ${index}: ${requirement.statement}`,
      ...coverages
    ].join("\n");
  }).join("\n\n");
  return [
    `Delegated request:
${input.request}`,
    `Judgment subject:
${input.contract.subject}`,
    `Category: ${input.contract.category}`,
    `Current Requirements and Need Coverage:
${requirements}`,
    "Conclude only when every Requirement is supported by complete current Coverage. Otherwise return an explicit refusal and preserve blockers."
  ].join("\n\n");
}
async function concludeJudgmentWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Make one upper Judgment synthesis from complete current Need Coverage.",
      "Call the supplied decision tool exactly once and disposition every Closure Requirement.",
      "Do not manufacture Coverage identities, permission, Effect success, or Work Case completion.",
      "The SDK controller owns exact Coverage citations, canonical admission, retries, and stop decisions."
    ].join("\n"),
    prompt: conclusionPrompt(input),
    tool: conclusionTool(input)
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
  const reproduced = closeJudgment(
    input.contract,
    input.coverages,
    decision.value.proposal
  );
  if (reproduced.status === "invalid") {
    return {
      status: "invariant-failure",
      code: reproduced.error.code,
      message: reproduced.error.message,
      decision: decision.metrics
    };
  }
  if (reproduced.status !== decision.value.result.status) {
    return {
      status: "invariant-failure",
      code: "closure-outcome-drift",
      message: "Accepted Judgment closure did not reproduce its outcome.",
      decision: decision.metrics
    };
  }
  if (reproduced.status === "refused") {
    if (decision.value.result.status !== "refused" || reproduced.value.refusalId !== decision.value.result.value.refusalId) {
      return {
        status: "invariant-failure",
        code: "refusal-identity-drift",
        message: "Accepted Judgment refusal did not reproduce its identity.",
        decision: decision.metrics
      };
    }
    return {
      status: "refused",
      refusal: reproduced.value,
      decision: decision.metrics
    };
  }
  if (decision.value.result.status !== "concluded" || reproduced.value.conclusionId !== decision.value.result.value.conclusionId) {
    return {
      status: "invariant-failure",
      code: "conclusion-identity-drift",
      message: "Accepted Judgment Conclusion did not reproduce its identity.",
      decision: decision.metrics
    };
  }
  return {
    status: "concluded",
    conclusion: reproduced.value,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/contribution-controller.ts
import { StringEnum as StringEnum6 } from "@earendil-works/pi-ai";
import { Type as Type6 } from "typebox";

// src/action-loop/contribution/accept-skill-contribution.ts
var SKILL_CONTRIBUTION_VERSION = "developer-skill-contribution/v1";
var LOCAL_STATUSES = /* @__PURE__ */ new Set(["resolved", "partial"]);
var APPLICATION_STATUSES = /* @__PURE__ */ new Set([
  "applied",
  "limited"
]);
var RESIDUAL_NEED_KINDS = /* @__PURE__ */ new Set([
  "residual",
  "emergent"
]);
var PROVENANCE_KINDS8 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid16(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalText14(value, code, path) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return {
      ok: false,
      error: { code, path, message: "Expected a nonblank value" }
    };
  }
  return { ok: true, value: normalized };
}
function canonicalList4(values, path, invalidCode) {
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const item = canonicalText14(
      values[index] ?? "",
      invalidCode,
      `${path}[${index}]`
    );
    if (!item.ok) return item;
    if (seen.has(item.value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Value duplicates an earlier normalized value"
        }
      };
    }
    seen.add(item.value);
    normalized.push(item.value);
  }
  return { ok: true, value: Object.freeze(normalized) };
}
function checkIdentity2(assignment, context, proposal) {
  for (const [path, actual, expected] of [
    ["context.workCaseId", context.workCaseId, assignment.workCaseId],
    ["context.judgmentId", context.judgmentId, assignment.judgmentId],
    [
      "context.contributionNeedId",
      context.contributionNeedId,
      assignment.contributionNeedId
    ],
    ["context.assignmentId", context.assignmentId, assignment.assignmentId],
    ["context.capabilityId", context.capabilityId, assignment.capabilityId],
    [
      "context.capabilityRevisionId",
      context.capabilityRevisionId,
      assignment.capabilityRevisionId
    ],
    ["proposal.workCaseId", proposal.workCaseId, assignment.workCaseId],
    ["proposal.judgmentId", proposal.judgmentId, assignment.judgmentId],
    [
      "proposal.contributionNeedId",
      proposal.contributionNeedId,
      assignment.contributionNeedId
    ],
    ["proposal.assignmentId", proposal.assignmentId, assignment.assignmentId],
    ["proposal.capabilityId", proposal.capabilityId, assignment.capabilityId],
    [
      "proposal.capabilityRevisionId",
      proposal.capabilityRevisionId,
      assignment.capabilityRevisionId
    ],
    [
      "proposal.sealedContextId",
      proposal.sealedContextId,
      context.sealedContextId
    ]
  ]) {
    if (actual !== expected) {
      return invalid16(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
function canonicalApplications(selectedPaths, proposals) {
  const selected = new Set(selectedPaths);
  const byPath = /* @__PURE__ */ new Map();
  for (const [index, proposal] of proposals.entries()) {
    if (!selected.has(proposal.path) || byPath.has(proposal.path)) {
      return {
        ok: false,
        error: {
          code: "reference-accounting",
          path: `proposal.referenceApplications[${index}].path`,
          message: "Reference must be selected and accounted exactly once"
        }
      };
    }
    if (!APPLICATION_STATUSES.has(proposal.status)) {
      return {
        ok: false,
        error: {
          code: "unsupported-application-status",
          path: `proposal.referenceApplications[${index}].status`,
          message: `Unsupported application status ${proposal.status}`
        }
      };
    }
    const application = canonicalText14(
      proposal.application,
      "empty-application",
      `proposal.referenceApplications[${index}].application`
    );
    if (!application.ok) return application;
    byPath.set(
      proposal.path,
      Object.freeze({
        path: proposal.path,
        status: proposal.status,
        application: application.value
      })
    );
  }
  if (byPath.size !== selectedPaths.length) {
    return {
      ok: false,
      error: {
        code: "reference-accounting",
        path: "proposal.referenceApplications",
        message: "Every selected Reference requires one application"
      }
    };
  }
  const ordered = [];
  for (const path of selectedPaths) {
    const application = byPath.get(path);
    if (application === void 0) {
      return {
        ok: false,
        error: {
          code: "reference-accounting",
          path: "proposal.referenceApplications",
          message: `Selected Reference has no application: ${path}`
        }
      };
    }
    ordered.push(application);
  }
  return { ok: true, value: Object.freeze(ordered) };
}
function canonicalResidualNeeds(proposals) {
  const needs = [];
  const descriptions = /* @__PURE__ */ new Set();
  for (const [index, proposal] of proposals.entries()) {
    if (!RESIDUAL_NEED_KINDS.has(proposal.kind)) {
      return {
        ok: false,
        error: {
          code: "invalid-residual-need",
          path: `proposal.residualNeeds[${index}].kind`,
          message: `Unsupported residual Need kind ${proposal.kind}`
        }
      };
    }
    const description = canonicalText14(
      proposal.description,
      "invalid-residual-need",
      `proposal.residualNeeds[${index}].description`
    );
    if (!description.ok) return description;
    if (descriptions.has(description.value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `proposal.residualNeeds[${index}].description`,
          message: "Residual Need duplicates an earlier description"
        }
      };
    }
    const basis = canonicalList4(
      proposal.basis,
      `proposal.residualNeeds[${index}].basis`,
      "invalid-residual-need"
    );
    if (!basis.ok) return basis;
    if (basis.value.length === 0) {
      return {
        ok: false,
        error: {
          code: "invalid-residual-need",
          path: `proposal.residualNeeds[${index}].basis`,
          message: "Residual Need requires explicit basis"
        }
      };
    }
    descriptions.add(description.value);
    needs.push(
      Object.freeze({
        kind: proposal.kind,
        description: description.value,
        basis: basis.value
      })
    );
  }
  return { ok: true, value: Object.freeze(needs) };
}
function canonicalProvenance8(proposal) {
  if (!PROVENANCE_KINDS8.has(proposal.kind)) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.kind",
        message: `Unsupported provenance kind ${proposal.kind}`
      }
    };
  }
  const source = canonicalText14(
    proposal.source,
    "invalid-provenance",
    "proposal.provenance.source"
  );
  if (!source.ok) return source;
  return {
    ok: true,
    value: Object.freeze({ kind: proposal.kind, source: source.value })
  };
}
function identityParts2(input) {
  const parts = [
    input.assignmentId,
    input.sealedContextId,
    input.localStatus,
    input.result,
    "applications",
    String(input.applications.length)
  ];
  for (const application of input.applications) {
    parts.push(application.path, application.status, application.application);
  }
  parts.push(
    "limitations",
    String(input.limitations.length),
    ...input.limitations
  );
  parts.push("residual-needs", String(input.residualNeeds.length));
  for (const need of input.residualNeeds) {
    parts.push(
      need.kind,
      need.description,
      String(need.basis.length),
      ...need.basis
    );
  }
  return parts;
}
function acceptSkillContribution(assignment, context, proposal) {
  const identityFailure = checkIdentity2(assignment, context, proposal);
  if (identityFailure !== void 0) return identityFailure;
  if (!LOCAL_STATUSES.has(proposal.localStatus)) {
    return invalid16(
      "unsupported-local-status",
      "proposal.localStatus",
      `Unsupported local status ${proposal.localStatus}`
    );
  }
  const result = canonicalText14(
    proposal.result,
    "empty-result",
    "proposal.result"
  );
  if (!result.ok) return { status: "invalid", error: result.error };
  const applications = canonicalApplications(
    context.selectedPaths,
    proposal.referenceApplications
  );
  if (!applications.ok) return { status: "invalid", error: applications.error };
  const limitations = canonicalList4(
    proposal.limitations,
    "proposal.limitations",
    "invalid-limitation"
  );
  if (!limitations.ok) return { status: "invalid", error: limitations.error };
  const residualNeeds = canonicalResidualNeeds(proposal.residualNeeds);
  if (!residualNeeds.ok) {
    return { status: "invalid", error: residualNeeds.error };
  }
  const provenance = canonicalProvenance8(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const residual = residualNeeds.value.some((need) => need.kind === "residual");
  const limitedApplication = applications.value.some(
    (application) => application.status === "limited"
  );
  if (proposal.localStatus === "partial" && limitations.value.length === 0 && !residual && !limitedApplication) {
    return invalid16(
      "partial-without-limitation",
      "proposal.localStatus",
      "Partial Contribution requires a limitation or residual Need"
    );
  }
  if (proposal.localStatus === "resolved" && residual) {
    return invalid16(
      "resolved-with-residual",
      "proposal.localStatus",
      "Resolved local status cannot retain a residual local Need"
    );
  }
  const contributionId = hashIdentity(
    "contribution",
    SKILL_CONTRIBUTION_VERSION,
    identityParts2({
      assignmentId: assignment.assignmentId,
      sealedContextId: context.sealedContextId,
      localStatus: proposal.localStatus,
      result: result.value,
      applications: applications.value,
      limitations: limitations.value,
      residualNeeds: residualNeeds.value
    })
  );
  return {
    status: "accepted",
    value: Object.freeze({
      contributionId,
      workCaseId: assignment.workCaseId,
      judgmentId: assignment.judgmentId,
      contributionNeedId: assignment.contributionNeedId,
      assignmentId: assignment.assignmentId,
      capabilityId: assignment.capabilityId,
      capabilityRevisionId: assignment.capabilityRevisionId,
      sealedContextId: context.sealedContextId,
      localStatus: proposal.localStatus,
      result: result.value,
      referenceApplications: applications.value,
      limitations: limitations.value,
      residualNeeds: residualNeeds.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/sdk/contribution-controller.ts
var localStatuses = ["resolved", "partial"];
var applicationStatuses = ["applied", "limited"];
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected6(code, message) {
  return { status: "rejected", code, message };
}
function contributionParameters(context) {
  const fields = {
    local_status: StringEnum6(localStatuses),
    result: Type6.String({ minLength: 1, maxLength: 12e3 }),
    limitations_json: Type6.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of zero or more explicit limitation strings."
    }),
    residual_needs_json: Type6.String({
      minLength: 2,
      maxLength: 32768,
      description: 'JSON array of {"kind":"residual"|"emergent","description":string,"basis":string[]} objects.'
    })
  };
  for (const [index, path] of context.selectedPaths.entries()) {
    fields[`reference_status_${index}`] = StringEnum6(applicationStatuses, {
      description: `Application status for selected Reference ${path}.`
    });
    fields[`reference_application_${index}`] = Type6.String({
      minLength: 1,
      maxLength: 2048,
      description: `How selected Reference ${path} was applied or limited.`
    });
  }
  return Type6.Object(fields, { additionalProperties: false });
}
function decodeResidualNeeds(value) {
  const decoded = decodeSdkProposalJson(value, "residual_needs_json");
  if (!decoded.ok) return decoded;
  if (!Array.isArray(decoded.value) || decoded.value.length > 32) {
    return {
      ok: false,
      message: "residual_needs_json must encode at most 32 objects."
    };
  }
  const residualNeeds = [];
  for (const [index, item] of decoded.value.entries()) {
    if (!isRecord6(item) || item.kind !== "residual" && item.kind !== "emergent" || typeof item.description !== "string" || !Array.isArray(item.basis) || item.basis.length === 0 || item.basis.length > 32 || item.basis.some((basis) => typeof basis !== "string")) {
      return {
        ok: false,
        message: `Residual Need ${index} requires kind, description, and one or more basis strings.`
      };
    }
    residualNeeds.push({
      kind: item.kind,
      description: item.description,
      basis: item.basis
    });
  }
  return { ok: true, value: Object.freeze(residualNeeds) };
}
function decodeReferenceApplications(raw, context) {
  const applications = [];
  for (const [index, path] of context.selectedPaths.entries()) {
    const status = raw[`reference_status_${index}`];
    const application = raw[`reference_application_${index}`];
    if (status !== "applied" && status !== "limited" || typeof application !== "string") {
      return {
        ok: false,
        message: `Selected Reference ${path} requires canonical application status and explanation.`
      };
    }
    applications.push({ path, status, application });
  }
  return { ok: true, value: Object.freeze(applications) };
}
function canonicalProposal2(input) {
  const localStatus = input.raw.local_status;
  if (localStatus !== "resolved" && localStatus !== "partial") {
    return {
      ok: false,
      code: "invalid-local-status",
      message: "local_status must be resolved or partial."
    };
  }
  if (typeof input.raw.result !== "string") {
    return {
      ok: false,
      code: "invalid-result",
      message: "result must be non-empty text."
    };
  }
  const applications = decodeReferenceApplications(input.raw, input.context);
  if (!applications.ok) {
    return {
      ok: false,
      code: "invalid-reference-applications",
      message: applications.message
    };
  }
  const limitations = decodeSdkStringList({
    value: input.raw.limitations_json,
    label: "limitations_json",
    allowEmpty: true,
    maximumItems: 32
  });
  if (!limitations.ok) {
    return {
      ok: false,
      code: "invalid-limitations",
      message: limitations.message
    };
  }
  const residualNeeds = decodeResidualNeeds(input.raw.residual_needs_json);
  if (!residualNeeds.ok) {
    return {
      ok: false,
      code: "invalid-residual-needs",
      message: residualNeeds.message
    };
  }
  return {
    ok: true,
    value: {
      workCaseId: input.assignment.workCaseId,
      judgmentId: input.assignment.judgmentId,
      contributionNeedId: input.assignment.contributionNeedId,
      assignmentId: input.assignment.assignmentId,
      capabilityId: input.assignment.capabilityId,
      capabilityRevisionId: input.assignment.capabilityRevisionId,
      sealedContextId: input.context.sealedContextId,
      localStatus,
      result: input.raw.result,
      referenceApplications: applications.value,
      limitations: limitations.value,
      residualNeeds: residualNeeds.value,
      provenance: { kind: "model", source: "pi:sdk-action-loop" }
    }
  };
}
function contributionTool(input) {
  return {
    name: "submit_skill_contribution",
    label: "Submit one source-bound Skill Contribution",
    description: "Propose one local result from the sealed Skill Context without claiming Need Coverage or a final Conclusion.",
    parameters: contributionParameters(input.context),
    execute: async (raw) => {
      if (!isRecord6(raw)) {
        return rejected6(
          "invalid-arguments",
          "Contribution arguments must be an object."
        );
      }
      const proposal = canonicalProposal2({ ...input, raw });
      if (!proposal.ok) return rejected6(proposal.code, proposal.message);
      const accepted = acceptSkillContribution(
        input.assignment,
        input.context,
        proposal.value
      );
      if (accepted.status === "invalid") {
        return rejected6(accepted.error.code, accepted.error.message);
      }
      return {
        status: "accepted",
        value: {
          proposal: proposal.value,
          contribution: accepted.value
        },
        message: `Skill Contribution accepted as ${accepted.value.localStatus}.`,
        resultStatus: accepted.value.localStatus
      };
    }
  };
}
function contributionPrompt(input) {
  const materials = input.context.materials.map(
    (material) => `--- ${material.kind}: ${material.path} ---
${material.content}`
  ).join("\n\n");
  return [
    `Delegated request:
${input.request}`,
    `Contribution Need:
${input.contributionNeed}`,
    "Exact sealed Skill Context:",
    materials,
    "Produce only the local Contribution. Do not claim cross-Skill Coverage, permission, Effect success, or completion."
  ].join("\n\n");
}
async function contributeSkillWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Produce one source-bound local Skill Contribution.",
      "Call the supplied decision tool exactly once.",
      "Apply every selected Reference explicitly, preserve limitations, and expose residual or emergent Needs.",
      "The SDK controller owns identity, sealed bytes, canonical admission, retries, and stop decisions."
    ].join("\n"),
    prompt: contributionPrompt(input),
    tool: contributionTool(input)
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
  const reproduced = acceptSkillContribution(
    input.assignment,
    input.context,
    decision.value.proposal
  );
  if (reproduced.status === "invalid" || reproduced.value.contributionId !== decision.value.contribution.contributionId) {
    return {
      status: "invariant-failure",
      code: reproduced.status === "invalid" ? reproduced.error.code : "contribution-identity-drift",
      message: reproduced.status === "invalid" ? reproduced.error.message : "Accepted Contribution did not reproduce its canonical identity.",
      decision: decision.metrics
    };
  }
  return {
    status: "accepted",
    contribution: reproduced.value,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/contribution-progress.ts
function invalid17(code, message) {
  return { status: "invalid", code, message };
}
function inspectContributionProgress(input) {
  const contextsByAssignment = /* @__PURE__ */ new Map();
  for (const context of input.contexts) {
    if (context.workCaseId !== input.workCaseId || context.judgmentId !== input.judgmentId) {
      return invalid17(
        "context-mismatch",
        `Sealed Context ${context.sealedContextId} does not belong to the current Work Case and Judgment.`
      );
    }
    if (contextsByAssignment.has(context.assignmentId)) {
      return invalid17(
        "duplicate-context",
        `Assignment ${context.assignmentId} has more than one sealed Context.`
      );
    }
    contextsByAssignment.set(context.assignmentId, context);
  }
  const contributionsByAssignment = /* @__PURE__ */ new Map();
  for (const contribution of input.contributions) {
    const context = contextsByAssignment.get(contribution.assignmentId);
    if (context === void 0 || contribution.workCaseId !== input.workCaseId || contribution.judgmentId !== input.judgmentId || contribution.contributionNeedId !== context.contributionNeedId || contribution.capabilityRevisionId !== context.capabilityRevisionId || contribution.sealedContextId !== context.sealedContextId) {
      return invalid17(
        "contribution-mismatch",
        `Contribution ${contribution.contributionId} has no exact current sealed Context.`
      );
    }
    if (contributionsByAssignment.has(contribution.assignmentId)) {
      return invalid17(
        "duplicate-contribution",
        `Assignment ${contribution.assignmentId} has more than one Contribution.`
      );
    }
    contributionsByAssignment.set(contribution.assignmentId, contribution);
  }
  const completedContributionIds = Object.freeze(
    [...contributionsByAssignment.values()].map((contribution) => contribution.contributionId).sort((left, right) => left.localeCompare(right))
  );
  const pendingContexts = Object.freeze(
    input.contexts.filter((context) => !contributionsByAssignment.has(context.assignmentId)).sort(
      (left, right) => left.assignmentId.localeCompare(right.assignmentId)
    )
  );
  if (pendingContexts.length > 0) {
    return { status: "pending", pendingContexts, completedContributionIds };
  }
  return {
    status: "complete",
    pendingContexts: Object.freeze([]),
    completedContributionIds
  };
}

// src/action-loop/sdk/coverage-controller.ts
import { StringEnum as StringEnum7 } from "@earendil-works/pi-ai";
import { Type as Type7 } from "typebox";

// src/action-loop/need-coverage/assess-need-coverage.ts
var NEED_COVERAGE_VERSION = "developer-need-coverage/v1";
var COVERAGE_STATUSES = /* @__PURE__ */ new Set([
  "covered",
  "partially-covered",
  "conflicted",
  "missing"
]);
var DISPOSITION_STATUSES = /* @__PURE__ */ new Set([
  "supports",
  "limited-support",
  "not-relied-on"
]);
var PROVENANCE_KINDS9 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid18(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId5(id) {
  return id.length > 0 && id === id.trim() && !id.includes("\0");
}
function canonicalList5(values, path) {
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]?.trim() ?? "";
    if (value.length === 0) {
      return {
        ok: false,
        error: {
          code: "empty-basis",
          path: `${path}[${index}]`,
          message: "Expected a nonblank basis"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Basis duplicates an earlier normalized value"
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  return { ok: true, value: Object.freeze(normalized) };
}
function checkTarget2(target, proposal) {
  for (const [path, id] of [
    ["target.workCaseId", target.workCaseId],
    ["target.judgmentId", target.judgmentId],
    ["target.contributionNeedId", target.contributionNeedId]
  ]) {
    if (!validId5(id)) {
      return invalid18(
        "invalid-target-id",
        path,
        "Expected a canonical target ID"
      );
    }
  }
  for (const [path, actual, expected] of [
    ["proposal.workCaseId", proposal.workCaseId, target.workCaseId],
    ["proposal.judgmentId", proposal.judgmentId, target.judgmentId],
    [
      "proposal.contributionNeedId",
      proposal.contributionNeedId,
      target.contributionNeedId
    ]
  ]) {
    if (actual !== expected) {
      return invalid18(
        "identity-mismatch",
        path,
        `Expected ${expected}, received ${actual}`
      );
    }
  }
  return void 0;
}
function buildInventory(target, contributions) {
  const byId = /* @__PURE__ */ new Map();
  for (const [index, contribution] of contributions.entries()) {
    for (const [path, actual, expected] of [
      [
        `contributions[${index}].workCaseId`,
        contribution.workCaseId,
        target.workCaseId
      ],
      [
        `contributions[${index}].judgmentId`,
        contribution.judgmentId,
        target.judgmentId
      ],
      [
        `contributions[${index}].contributionNeedId`,
        contribution.contributionNeedId,
        target.contributionNeedId
      ]
    ]) {
      if (actual !== expected) {
        return {
          ok: false,
          error: {
            code: "identity-mismatch",
            path,
            message: `Expected ${expected}, received ${actual}`
          }
        };
      }
    }
    if (byId.has(contribution.contributionId)) {
      return {
        ok: false,
        error: {
          code: "duplicate-contribution",
          path: `contributions[${index}].contributionId`,
          message: "Current Contribution inventory contains a duplicate ID"
        }
      };
    }
    byId.set(contribution.contributionId, contribution);
  }
  const ordered = Object.freeze(
    [...contributions].sort((left, right) => {
      if (left.contributionId < right.contributionId) return -1;
      if (left.contributionId > right.contributionId) return 1;
      return 0;
    })
  );
  const positions = new Map(
    ordered.map((contribution, index) => [contribution.contributionId, index])
  );
  return { ok: true, value: { ordered, byId, positions } };
}
function canonicalDispositions(inventory, proposals) {
  const byId = /* @__PURE__ */ new Map();
  for (const [index, proposal] of proposals.entries()) {
    const contribution = inventory.byId.get(proposal.contributionId);
    if (contribution === void 0 || byId.has(proposal.contributionId)) {
      return {
        ok: false,
        error: {
          code: "contribution-accounting",
          path: `proposal.dispositions[${index}].contributionId`,
          message: "Contribution must be current and dispositioned exactly once"
        }
      };
    }
    if (!DISPOSITION_STATUSES.has(proposal.status)) {
      return {
        ok: false,
        error: {
          code: "unsupported-disposition-status",
          path: `proposal.dispositions[${index}].status`,
          message: `Unsupported disposition status ${proposal.status}`
        }
      };
    }
    if (contribution.localStatus === "partial" && proposal.status === "supports") {
      return {
        ok: false,
        error: {
          code: "partial-as-full-support",
          path: `proposal.dispositions[${index}].status`,
          message: "A partial Skill result cannot become full support"
        }
      };
    }
    const basis = canonicalList5(
      proposal.basis,
      `proposal.dispositions[${index}].basis`
    );
    if (!basis.ok) return basis;
    if (basis.value.length === 0) {
      return {
        ok: false,
        error: {
          code: "empty-basis",
          path: `proposal.dispositions[${index}].basis`,
          message: "Contribution disposition requires explicit basis"
        }
      };
    }
    byId.set(
      proposal.contributionId,
      Object.freeze({
        contributionId: proposal.contributionId,
        status: proposal.status,
        basis: basis.value
      })
    );
  }
  if (byId.size !== inventory.ordered.length) {
    return {
      ok: false,
      error: {
        code: "contribution-accounting",
        path: "proposal.dispositions",
        message: "Every current Contribution requires one disposition"
      }
    };
  }
  const ordered = [];
  for (const contribution of inventory.ordered) {
    const disposition = byId.get(contribution.contributionId);
    if (disposition === void 0) {
      return {
        ok: false,
        error: {
          code: "contribution-accounting",
          path: "proposal.dispositions",
          message: `Contribution has no disposition: ${contribution.contributionId}`
        }
      };
    }
    ordered.push(disposition);
  }
  return { ok: true, value: Object.freeze(ordered) };
}
function canonicalConflicts(inventory, dispositions, proposals) {
  const dispositionById = new Map(
    dispositions.map((disposition) => [
      disposition.contributionId,
      disposition
    ])
  );
  const conflicts = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, proposal] of proposals.entries()) {
    const leftIndex = inventory.positions.get(proposal.leftContributionId);
    const rightIndex = inventory.positions.get(proposal.rightContributionId);
    if (leftIndex === void 0 || rightIndex === void 0 || leftIndex === rightIndex) {
      return {
        ok: false,
        error: {
          code: "invalid-conflict",
          path: `proposal.conflicts[${index}]`,
          message: "Conflict requires two distinct current Contributions"
        }
      };
    }
    const orderedLeft = Math.min(leftIndex, rightIndex);
    const orderedRight = Math.max(leftIndex, rightIndex);
    const leftContributionId = inventory.ordered[orderedLeft]?.contributionId;
    const rightContributionId = inventory.ordered[orderedRight]?.contributionId;
    if (leftContributionId === void 0 || rightContributionId === void 0) {
      return {
        ok: false,
        error: {
          code: "invalid-conflict",
          path: `proposal.conflicts[${index}]`,
          message: "Conflict cannot resolve its current Contributions"
        }
      };
    }
    const key = `${leftContributionId}\0${rightContributionId}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: {
          code: "invalid-conflict",
          path: `proposal.conflicts[${index}]`,
          message: "Conflict duplicates an earlier relation"
        }
      };
    }
    if (dispositionById.get(leftContributionId)?.status === "not-relied-on" || dispositionById.get(rightContributionId)?.status === "not-relied-on") {
      return {
        ok: false,
        error: {
          code: "invalid-conflict",
          path: `proposal.conflicts[${index}]`,
          message: "Conflict endpoints must both be relied on"
        }
      };
    }
    const basis = canonicalList5(
      proposal.basis,
      `proposal.conflicts[${index}].basis`
    );
    if (!basis.ok) return basis;
    if (basis.value.length === 0) {
      return {
        ok: false,
        error: {
          code: "invalid-conflict",
          path: `proposal.conflicts[${index}].basis`,
          message: "Conflict requires explicit basis"
        }
      };
    }
    seen.add(key);
    conflicts.push(
      Object.freeze({
        leftContributionId,
        rightContributionId,
        basis: basis.value,
        leftIndex: orderedLeft,
        rightIndex: orderedRight
      })
    );
  }
  conflicts.sort(
    (left, right) => left.leftIndex - right.leftIndex || left.rightIndex - right.rightIndex
  );
  return {
    ok: true,
    value: Object.freeze(
      conflicts.map(
        ({ leftContributionId, rightContributionId, basis }) => Object.freeze({ leftContributionId, rightContributionId, basis })
      )
    )
  };
}
function canonicalProvenance9(proposal) {
  if (!PROVENANCE_KINDS9.has(proposal.kind)) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.kind",
        message: `Unsupported provenance kind ${proposal.kind}`
      }
    };
  }
  const source = proposal.source.trim();
  if (source.length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.source",
        message: "Coverage provenance requires a nonblank source"
      }
    };
  }
  return {
    ok: true,
    value: Object.freeze({ kind: proposal.kind, source })
  };
}
function deriveStatus(dispositions, conflicts) {
  if (conflicts.length > 0) return "conflicted";
  if (dispositions.some(({ status }) => status === "limited-support")) {
    return "partially-covered";
  }
  if (dispositions.some(({ status }) => status === "supports")) {
    return "covered";
  }
  return "missing";
}
function identityParts3(input) {
  const parts = [
    input.target.workCaseId,
    input.target.judgmentId,
    input.target.contributionNeedId,
    input.status,
    "dispositions",
    String(input.dispositions.length)
  ];
  for (const disposition of input.dispositions) {
    parts.push(
      disposition.contributionId,
      disposition.status,
      String(disposition.basis.length),
      ...disposition.basis
    );
  }
  parts.push("conflicts", String(input.conflicts.length));
  for (const conflict of input.conflicts) {
    parts.push(
      conflict.leftContributionId,
      conflict.rightContributionId,
      String(conflict.basis.length),
      ...conflict.basis
    );
  }
  parts.push("basis", String(input.basis.length), ...input.basis);
  return parts;
}
function assessNeedCoverage(target, contributions, proposal) {
  const targetFailure = checkTarget2(target, proposal);
  if (targetFailure !== void 0) return targetFailure;
  if (!COVERAGE_STATUSES.has(proposal.status)) {
    return invalid18(
      "unsupported-coverage-status",
      "proposal.status",
      `Unsupported Coverage status ${proposal.status}`
    );
  }
  const inventory = buildInventory(target, contributions);
  if (!inventory.ok) return { status: "invalid", error: inventory.error };
  const dispositions = canonicalDispositions(
    inventory.value,
    proposal.dispositions
  );
  if (!dispositions.ok) {
    return { status: "invalid", error: dispositions.error };
  }
  const conflicts = canonicalConflicts(
    inventory.value,
    dispositions.value,
    proposal.conflicts
  );
  if (!conflicts.ok) return { status: "invalid", error: conflicts.error };
  const basis = canonicalList5(proposal.basis, "proposal.basis");
  if (!basis.ok) return { status: "invalid", error: basis.error };
  if (basis.value.length === 0) {
    return invalid18(
      "empty-basis",
      "proposal.basis",
      "Need Coverage requires explicit basis"
    );
  }
  const provenance = canonicalProvenance9(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const derivedStatus = deriveStatus(dispositions.value, conflicts.value);
  if (proposal.status !== derivedStatus) {
    return invalid18(
      "status-mismatch",
      "proposal.status",
      `Coverage evidence derives ${derivedStatus}, not ${proposal.status}`
    );
  }
  const coverageId = hashIdentity(
    "coverage",
    NEED_COVERAGE_VERSION,
    identityParts3({
      target,
      status: derivedStatus,
      dispositions: dispositions.value,
      conflicts: conflicts.value,
      basis: basis.value
    })
  );
  return {
    status: "accepted",
    value: Object.freeze({
      coverageId,
      workCaseId: target.workCaseId,
      judgmentId: target.judgmentId,
      contributionNeedId: target.contributionNeedId,
      status: derivedStatus,
      dispositions: dispositions.value,
      conflicts: conflicts.value,
      basis: basis.value,
      provenance: provenance.value
    })
  };
}

// src/action-loop/sdk/coverage-controller.ts
var coverageStatuses = [
  "covered",
  "partially-covered",
  "conflicted",
  "missing"
];
var dispositionStatuses = [
  "supports",
  "limited-support",
  "not-relied-on"
];
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected7(code, message) {
  return { status: "rejected", code, message };
}
function coverageParameters(contributions) {
  const fields = {
    status: StringEnum7(coverageStatuses),
    conflicts_json: Type7.String({
      minLength: 2,
      maxLength: 32768,
      description: 'JSON array of {"left_index":integer,"right_index":integer,"basis":string[]} conflicts. Use [] when none.'
    }),
    basis_json: Type7.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of one or more synthesis basis strings."
    })
  };
  for (const [index, contribution] of contributions.entries()) {
    fields[`disposition_status_${index}`] = StringEnum7(dispositionStatuses, {
      description: `Disposition for Contribution ${index} (${contribution.localStatus}).`
    });
    fields[`disposition_basis_${index}`] = Type7.String({
      minLength: 1,
      maxLength: 2048
    });
  }
  return Type7.Object(fields, { additionalProperties: false });
}
function decodeDispositions(raw, contributions) {
  const dispositions = [];
  for (const [index, contribution] of contributions.entries()) {
    const status = raw[`disposition_status_${index}`];
    const basis = raw[`disposition_basis_${index}`];
    if (status !== "supports" && status !== "limited-support" && status !== "not-relied-on" || typeof basis !== "string") {
      return {
        ok: false,
        message: `Contribution ${index} requires a canonical disposition and basis.`
      };
    }
    dispositions.push({
      contributionId: contribution.contributionId,
      status,
      basis: [basis]
    });
  }
  return { ok: true, value: Object.freeze(dispositions) };
}
function decodeConflictItem(input) {
  const { item, index, contributionCount } = input;
  if (!isRecord7(item)) {
    return { ok: false, message: `Conflict ${index} must be an object.` };
  }
  const leftIndex = item.left_index;
  const rightIndex = item.right_index;
  if (typeof leftIndex !== "number" || typeof rightIndex !== "number" || !Number.isInteger(leftIndex) || !Number.isInteger(rightIndex) || leftIndex < 0 || rightIndex < 0 || leftIndex >= contributionCount || rightIndex >= contributionCount) {
    return {
      ok: false,
      message: `Conflict ${index} requires two current Contribution indices.`
    };
  }
  if (!Array.isArray(item.basis) || item.basis.length === 0 || item.basis.length > 32 || item.basis.some((basis) => typeof basis !== "string")) {
    return {
      ok: false,
      message: `Conflict ${index} requires one or more basis strings.`
    };
  }
  return { ok: true, leftIndex, rightIndex, basis: item.basis };
}
function decodeConflicts(value, contributions) {
  const decoded = decodeSdkProposalJson(value, "conflicts_json");
  if (!decoded.ok) return decoded;
  if (!Array.isArray(decoded.value) || decoded.value.length > 32) {
    return {
      ok: false,
      message: "conflicts_json must encode at most 32 conflicts."
    };
  }
  const conflicts = [];
  for (const [index, item] of decoded.value.entries()) {
    const decodedItem = decodeConflictItem({
      item,
      index,
      contributionCount: contributions.length
    });
    if (!decodedItem.ok) return decodedItem;
    const left = contributions[decodedItem.leftIndex];
    const right = contributions[decodedItem.rightIndex];
    if (left === void 0 || right === void 0) {
      return {
        ok: false,
        message: `Conflict ${index} references an unavailable Contribution.`
      };
    }
    conflicts.push({
      leftContributionId: left.contributionId,
      rightContributionId: right.contributionId,
      basis: decodedItem.basis
    });
  }
  return { ok: true, value: Object.freeze(conflicts) };
}
function canonicalProposal3(input) {
  const status = input.raw.status;
  if (status !== "covered" && status !== "partially-covered" && status !== "conflicted" && status !== "missing") {
    return {
      ok: false,
      code: "invalid-coverage-status",
      message: "status must be a canonical Need Coverage status."
    };
  }
  const dispositions = decodeDispositions(input.raw, input.contributions);
  if (!dispositions.ok) {
    return {
      ok: false,
      code: "invalid-dispositions",
      message: dispositions.message
    };
  }
  const conflicts = decodeConflicts(
    input.raw.conflicts_json,
    input.contributions
  );
  if (!conflicts.ok) {
    return {
      ok: false,
      code: "invalid-conflicts",
      message: conflicts.message
    };
  }
  const basis = decodeSdkStringList({
    value: input.raw.basis_json,
    label: "basis_json",
    allowEmpty: false,
    maximumItems: 32
  });
  if (!basis.ok) {
    return { ok: false, code: "invalid-basis", message: basis.message };
  }
  return {
    ok: true,
    value: {
      ...input.target,
      status,
      dispositions: dispositions.value,
      conflicts: conflicts.value,
      basis: basis.value,
      provenance: { kind: "model", source: "pi:sdk-action-loop" }
    }
  };
}
function coverageTool(input) {
  return {
    name: "submit_need_coverage",
    label: "Submit one cross-Contribution Need Coverage assessment",
    description: "Disposition every current Contribution and assess one Need without closing the Judgment.",
    parameters: coverageParameters(input.contributions),
    execute: async (raw) => {
      if (!isRecord7(raw)) {
        return rejected7(
          "invalid-arguments",
          "Coverage arguments must be an object."
        );
      }
      const proposal = canonicalProposal3({ ...input, raw });
      if (!proposal.ok) return rejected7(proposal.code, proposal.message);
      const assessed = assessNeedCoverage(
        input.target,
        input.contributions,
        proposal.value
      );
      if (assessed.status === "invalid") {
        return rejected7(assessed.error.code, assessed.error.message);
      }
      return {
        status: "accepted",
        value: { proposal: proposal.value, coverage: assessed.value },
        message: `Need Coverage accepted as ${assessed.value.status}.`,
        resultStatus: assessed.value.status
      };
    }
  };
}
function coveragePrompt(input) {
  const contributions = input.contributions.map(
    (contribution, index) => [
      `Contribution ${index} (${contribution.localStatus})`,
      `Result: ${contribution.result}`,
      `Limitations: ${contribution.limitations.join(" | ") || "none declared"}`
    ].join("\n")
  ).join("\n\n");
  return [
    `Delegated request:
${input.request}`,
    `Contribution Need:
${input.contributionNeed}`,
    contributions.length > 0 ? `Current Contributions:
${contributions}` : "Current Contributions: none",
    "Disposition every current Contribution. Coverage is cross-Contribution synthesis, not a final Judgment Conclusion."
  ].join("\n\n");
}
async function assessNeedCoverageWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Assess one current Contribution Need comparatively.",
      "Call the supplied decision tool exactly once and disposition every current Contribution.",
      "Expose limitations and conflicts; do not create a final Judgment Conclusion.",
      "The SDK controller owns Contribution identities, complete accounting, canonical admission, retries, and stop decisions."
    ].join("\n"),
    prompt: coveragePrompt(input),
    tool: coverageTool(input)
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
  const reproduced = assessNeedCoverage(
    input.target,
    input.contributions,
    decision.value.proposal
  );
  if (reproduced.status === "invalid" || reproduced.value.coverageId !== decision.value.coverage.coverageId) {
    return {
      status: "invariant-failure",
      code: reproduced.status === "invalid" ? reproduced.error.code : "coverage-identity-drift",
      message: reproduced.status === "invalid" ? reproduced.error.message : "Accepted Coverage did not reproduce its canonical identity.",
      decision: decision.metrics
    };
  }
  return {
    status: "assessed",
    coverage: reproduced.value,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/coverage-progress.ts
function invalid19(code, message) {
  return { status: "invalid", code, message };
}
function inspectCoverageProgress(input) {
  const needsById = /* @__PURE__ */ new Map();
  for (const need of input.contributionNeeds) {
    if (needsById.has(need.contributionNeedId)) {
      return invalid19(
        "duplicate-need",
        `Contribution Need ${need.contributionNeedId} occurs more than once.`
      );
    }
    needsById.set(need.contributionNeedId, need);
  }
  const coveragesByNeed = /* @__PURE__ */ new Map();
  for (const coverage of input.coverages) {
    if (coverage.workCaseId !== input.workCaseId || coverage.judgmentId !== input.judgmentId || !needsById.has(coverage.contributionNeedId)) {
      return invalid19(
        "coverage-mismatch",
        `Need Coverage ${coverage.coverageId} has no exact current Contribution Need.`
      );
    }
    if (coveragesByNeed.has(coverage.contributionNeedId)) {
      return invalid19(
        "duplicate-coverage",
        `Contribution Need ${coverage.contributionNeedId} has more than one current Coverage assessment.`
      );
    }
    coveragesByNeed.set(coverage.contributionNeedId, coverage);
  }
  const completedCoverageIds = Object.freeze(
    input.coverages.map((coverage) => coverage.coverageId).sort((left, right) => left.localeCompare(right))
  );
  const pendingNeeds = Object.freeze(
    input.contributionNeeds.filter((need) => !coveragesByNeed.has(need.contributionNeedId)).sort(
      (left, right) => left.contributionNeedId.localeCompare(right.contributionNeedId)
    )
  );
  if (pendingNeeds.length > 0) {
    return { status: "pending", pendingNeeds, completedCoverageIds };
  }
  return {
    status: "complete",
    pendingNeeds: Object.freeze([]),
    completedCoverageIds
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
function traceDecisionEvent(event, accepted) {
  if (process.env.DEVELOPER_SDK_DECISION_TRACE !== "1") return;
  let message;
  if (event.type === "agent_start" || event.type === "agent_end") {
    message = event.type;
  } else if (event.type === "tool_execution_start") {
    message = `${event.type} tool=${event.toolName}`;
  } else if (event.type === "tool_execution_end") {
    message = `${event.type} tool=${event.toolName} error=${event.isError} accepted=${accepted()}`;
  }
  if (message !== void 0) {
    process.stderr.write(`[developer-sdk-decision] ${message}
`);
  }
}
function subscribeToAttempt(input) {
  return input.session.subscribe((event) => {
    traceDecisionEvent(event, input.accepted);
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
    // One stage exposes one one-use proposal tool. Competing calls must not
    // race to become the accepted proposal; orchestration-level parallelism
    // belongs across independent commands, not inside this admission point.
    executionMode: "sequential",
    description: input.request.tool.description,
    parameters: input.request.tool.parameters,
    execute: async (_toolCallId, raw) => {
      const admission = await input.request.tool.execute(raw);
      if (admission.status === "rejected") {
        throw new Error(`${admission.code}: ${admission.message}`);
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
    const prompt = input.retryFeedback.length === 0 ? input.request.prompt : [
      input.request.prompt,
      "Previous proposal rejection(s) from canonical admission:",
      ...input.retryFeedback.map((feedback) => `- ${feedback}`),
      "Submit a corrected proposal and do not repeat these rejected states."
    ].join("\n");
    await session.prompt(prompt);
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
      retryFeedback: counters.errorMessages.filter((message) => !message.startsWith("runtime:")).slice(-maximumErrors),
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
  const maximumRunMs = positiveInteger(options.maxRunMs ?? 12e4, "maxRunMs");
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

// src/action-loop/sdk/effect-controller.ts
import { StringEnum as StringEnum8 } from "@earendil-works/pi-ai";
import { Type as Type8 } from "typebox";

// src/action-loop/effect/effect-settlement.ts
var EFFECT_SETTLEMENT_VERSION = "developer-effect-settlement/v1";
var EFFECT_ASSESSMENT_VERSION = "developer-effect-assessment/v1";
var OUTCOMES = /* @__PURE__ */ new Set([
  "observed-success",
  "observed-no-effect",
  "failed",
  "partially-applied",
  "pending",
  "unknown"
]);
var OBSERVATION_STATUSES = /* @__PURE__ */ new Set([
  "relied-on",
  "not-relied-on"
]);
var INTENDED_EFFECT_STATUSES = /* @__PURE__ */ new Set([
  "observed",
  "not-observed",
  "failed",
  "partially-observed",
  "unknown"
]);
var PROVENANCE_KINDS10 = /* @__PURE__ */ new Set([
  "model",
  "human",
  "tool",
  "external"
]);
function invalid20(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function canonicalBasis10(values, path) {
  if (!Array.isArray(values) || values.length === 0) {
    return {
      ok: false,
      error: { code: "empty-basis", path, message: "Expected explicit basis" }
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
          code: "invalid-basis",
          path: `${path}[${index}]`,
          message: "Expected a nonblank basis item"
        }
      };
    }
    if (seen.has(value)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Basis duplicates an earlier normalized item"
        }
      };
    }
    seen.add(value);
    normalized.push(value);
  }
  normalized.sort((left, right) => left.localeCompare(right));
  return { ok: true, value: Object.freeze(normalized) };
}
function canonicalProvenance10(provenance) {
  if (typeof provenance !== "object" || provenance === null || !PROVENANCE_KINDS10.has(provenance.kind)) {
    return {
      ok: false,
      error: {
        code: "unsupported-provenance",
        path: "proposal.provenance.kind",
        message: "Unsupported Effect settlement provenance kind"
      }
    };
  }
  if (typeof provenance.source !== "string" || provenance.source.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: "invalid-provenance",
        path: "proposal.provenance.source",
        message: "Expected nonblank provenance source"
      }
    };
  }
  return {
    ok: true,
    value: Object.freeze({
      kind: provenance.kind,
      source: provenance.source.trim()
    })
  };
}
function observationInventory(effect, observations) {
  const inventory = /* @__PURE__ */ new Map();
  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index];
    if (observation === void 0) continue;
    if (observation.workCaseId !== effect.workCaseId || observation.effectId !== effect.effectId || observation.occurrenceId !== effect.occurrenceId) {
      return {
        ok: false,
        error: {
          code: "cross-effect-observation",
          path: `observations[${index}]`,
          message: "Observation belongs to another Effect occurrence"
        }
      };
    }
    if (inventory.has(observation.effectObservationId)) {
      return {
        ok: false,
        error: {
          code: "duplicate-observation",
          path: `observations[${index}].effectObservationId`,
          message: "Observation appears more than once"
        }
      };
    }
    inventory.set(observation.effectObservationId, observation);
  }
  return { ok: true, value: inventory };
}
function canonicalObservationDispositions(inventory, proposals) {
  if (!Array.isArray(proposals)) {
    return {
      ok: false,
      error: {
        code: "observation-accounting",
        path: "proposal.observationDispositions",
        message: "Expected complete Observation accounting"
      }
    };
  }
  const byId = /* @__PURE__ */ new Map();
  for (let index = 0; index < proposals.length; index += 1) {
    const proposal = proposals[index];
    if (proposal === void 0 || !inventory.has(proposal.effectObservationId) || byId.has(proposal.effectObservationId)) {
      return {
        ok: false,
        error: {
          code: "observation-accounting",
          path: `proposal.observationDispositions[${index}].effectObservationId`,
          message: "Observation must be current and accounted exactly once"
        }
      };
    }
    if (!OBSERVATION_STATUSES.has(proposal.status)) {
      return {
        ok: false,
        error: {
          code: "unsupported-observation-status",
          path: `proposal.observationDispositions[${index}].status`,
          message: `Unsupported Observation disposition ${proposal.status}`
        }
      };
    }
    const basis = canonicalBasis10(
      proposal.basis,
      `proposal.observationDispositions[${index}].basis`
    );
    if (!basis.ok) return basis;
    byId.set(
      proposal.effectObservationId,
      Object.freeze({
        effectObservationId: proposal.effectObservationId,
        status: proposal.status,
        basis: basis.value
      })
    );
  }
  if (byId.size !== inventory.size) {
    return {
      ok: false,
      error: {
        code: "observation-accounting",
        path: "proposal.observationDispositions",
        message: "Every current Observation requires one disposition"
      }
    };
  }
  return {
    ok: true,
    value: Object.freeze(
      [...byId.values()].sort(
        (left, right) => left.effectObservationId.localeCompare(right.effectObservationId)
      )
    )
  };
}
function canonicalObservationIds(values, inventory, reliedIds, path) {
  if (!Array.isArray(values)) {
    return {
      ok: false,
      error: {
        code: "undeclared-observation",
        path,
        message: "Expected Observation IDs"
      }
    };
  }
  const ids = /* @__PURE__ */ new Set();
  for (let index = 0; index < values.length; index += 1) {
    const id = values[index];
    if (typeof id !== "string" || !inventory.has(id)) {
      return {
        ok: false,
        error: {
          code: "undeclared-observation",
          path: `${path}[${index}]`,
          message: "Observation is not current"
        }
      };
    }
    if (!reliedIds.has(id)) {
      return {
        ok: false,
        error: {
          code: "unrelied-observation",
          path: `${path}[${index}]`,
          message: "Cited Observation must be relied on"
        }
      };
    }
    if (ids.has(id)) {
      return {
        ok: false,
        error: {
          code: "duplicate-value",
          path: `${path}[${index}]`,
          message: "Observation is cited more than once"
        }
      };
    }
    ids.add(id);
  }
  return {
    ok: true,
    value: Object.freeze(
      [...ids].sort((left, right) => left.localeCompare(right))
    )
  };
}
function canonicalIntendedEffectDisposition(proposal, index, context) {
  const path = `proposal.intendedEffectDispositions[${index}]`;
  if (proposal === void 0 || !context.declared.has(proposal.intendedEffect) || context.alreadyAccounted.has(proposal.intendedEffect)) {
    return {
      ok: false,
      error: {
        code: "intended-effect-accounting",
        path: `${path}.intendedEffect`,
        message: "Intended Effect must be declared and accounted exactly once"
      }
    };
  }
  if (!INTENDED_EFFECT_STATUSES.has(proposal.status)) {
    return {
      ok: false,
      error: {
        code: "unsupported-intended-effect-status",
        path: `${path}.status`,
        message: `Unsupported intended Effect status ${proposal.status}`
      }
    };
  }
  const observationIds = canonicalObservationIds(
    proposal.observationIds,
    context.inventory,
    context.reliedIds,
    `${path}.observationIds`
  );
  if (!observationIds.ok) return observationIds;
  if (proposal.status !== "unknown" && observationIds.value.length === 0) {
    return {
      ok: false,
      error: {
        code: "evidence-required",
        path: `${path}.observationIds`,
        message: "Decisive intended Effect disposition requires evidence"
      }
    };
  }
  const basis = canonicalBasis10(proposal.basis, `${path}.basis`);
  if (!basis.ok) return basis;
  return {
    ok: true,
    value: Object.freeze({
      intendedEffect: proposal.intendedEffect,
      status: proposal.status,
      observationIds: observationIds.value,
      basis: basis.value
    })
  };
}
function orderIntendedEffectDispositions(effect, byEffect) {
  if (byEffect.size !== effect.intendedEffects.length) {
    return {
      ok: false,
      error: {
        code: "intended-effect-accounting",
        path: "proposal.intendedEffectDispositions",
        message: "Every intended Effect requires one disposition"
      }
    };
  }
  const ordered = [];
  for (const intendedEffect of effect.intendedEffects) {
    const disposition = byEffect.get(intendedEffect);
    if (disposition === void 0) {
      return {
        ok: false,
        error: {
          code: "intended-effect-accounting",
          path: "proposal.intendedEffectDispositions",
          message: `Intended Effect has no disposition: ${intendedEffect}`
        }
      };
    }
    ordered.push(disposition);
  }
  return { ok: true, value: Object.freeze(ordered) };
}
function canonicalIntendedEffectDispositions(effect, inventory, observationDispositions, proposals) {
  if (!Array.isArray(proposals)) {
    return {
      ok: false,
      error: {
        code: "intended-effect-accounting",
        path: "proposal.intendedEffectDispositions",
        message: "Expected complete intended Effect accounting"
      }
    };
  }
  const reliedIds = /* @__PURE__ */ new Set();
  for (const disposition of observationDispositions) {
    if (disposition.status === "relied-on") {
      reliedIds.add(disposition.effectObservationId);
    }
  }
  const citedReliedIds = /* @__PURE__ */ new Set();
  const byEffect = /* @__PURE__ */ new Map();
  for (let index = 0; index < proposals.length; index += 1) {
    const canonical = canonicalIntendedEffectDisposition(
      proposals[index],
      index,
      {
        declared: new Set(effect.intendedEffects),
        inventory,
        reliedIds,
        alreadyAccounted: new Set(byEffect.keys())
      }
    );
    if (!canonical.ok) return canonical;
    byEffect.set(canonical.value.intendedEffect, canonical.value);
    for (const id of canonical.value.observationIds) citedReliedIds.add(id);
  }
  for (const reliedId of reliedIds) {
    if (!citedReliedIds.has(reliedId)) {
      return {
        ok: false,
        error: {
          code: "observation-accounting",
          path: "proposal.intendedEffectDispositions",
          message: `Relied-on Observation is not applied: ${reliedId}`
        }
      };
    }
  }
  return orderIntendedEffectDispositions(effect, byEffect);
}
function deriveOutcome(observationDispositions, intended) {
  const reliedCount = observationDispositions.filter(
    ({ status }) => status === "relied-on"
  ).length;
  if (reliedCount === 0) return "pending";
  const statuses = intended.map(({ status }) => status);
  if (statuses.includes("unknown")) return "unknown";
  if (statuses.includes("partially-observed")) return "partially-applied";
  const observedCount = statuses.filter(
    (status) => status === "observed"
  ).length;
  if (observedCount === statuses.length) return "observed-success";
  if (observedCount > 0) return "partially-applied";
  if (statuses.includes("failed")) return "failed";
  return "observed-no-effect";
}
function accountingIdentityParts(input) {
  const parts = [
    input.effect.effectId,
    input.effect.actionClearanceId,
    input.effect.occurrenceId,
    "outcome",
    input.outcome
  ];
  for (const disposition of input.observations) {
    parts.push(
      "observation",
      disposition.effectObservationId,
      disposition.status,
      ...disposition.basis
    );
  }
  for (const disposition of input.intended) {
    parts.push(
      "intended-effect",
      disposition.intendedEffect,
      disposition.status,
      ...disposition.observationIds,
      ...disposition.basis
    );
  }
  parts.push("basis", ...input.basis);
  return parts;
}
function settleEffect(effect, observations, proposal) {
  if (proposal.workCaseId !== effect.workCaseId || proposal.effectId !== effect.effectId) {
    return invalid20(
      "identity-mismatch",
      "proposal",
      "Settlement proposal targets another Work Case or Effect"
    );
  }
  if (!OUTCOMES.has(proposal.outcome)) {
    return invalid20(
      "unsupported-outcome",
      "proposal.outcome",
      `Unsupported Effect outcome ${proposal.outcome}`
    );
  }
  const inventory = observationInventory(effect, observations);
  if (!inventory.ok) return { status: "invalid", error: inventory.error };
  const observationDispositions = canonicalObservationDispositions(
    inventory.value,
    proposal.observationDispositions
  );
  if (!observationDispositions.ok) {
    return { status: "invalid", error: observationDispositions.error };
  }
  const intendedDispositions = canonicalIntendedEffectDispositions(
    effect,
    inventory.value,
    observationDispositions.value,
    proposal.intendedEffectDispositions
  );
  if (!intendedDispositions.ok) {
    return { status: "invalid", error: intendedDispositions.error };
  }
  const basis = canonicalBasis10(proposal.basis, "proposal.basis");
  if (!basis.ok) return { status: "invalid", error: basis.error };
  const provenance = canonicalProvenance10(proposal.provenance);
  if (!provenance.ok) return { status: "invalid", error: provenance.error };
  const derived = deriveOutcome(
    observationDispositions.value,
    intendedDispositions.value
  );
  if (proposal.outcome !== derived) {
    return invalid20(
      "outcome-mismatch",
      "proposal.outcome",
      `Current accounting derives ${derived}, not ${proposal.outcome}`
    );
  }
  const identityParts4 = accountingIdentityParts({
    effect,
    outcome: derived,
    observations: observationDispositions.value,
    intended: intendedDispositions.value,
    basis: basis.value
  });
  const common = {
    workCaseId: effect.workCaseId,
    effectId: effect.effectId,
    actionClearanceId: effect.actionClearanceId,
    occurrenceId: effect.occurrenceId,
    observationDispositions: observationDispositions.value,
    intendedEffectDispositions: intendedDispositions.value,
    basis: basis.value,
    provenance: provenance.value
  };
  if (derived === "pending" || derived === "unknown") {
    return {
      status: "unsettled",
      value: Object.freeze({
        ...common,
        effectAssessmentId: hashIdentity(
          "effect_assessment",
          EFFECT_ASSESSMENT_VERSION,
          identityParts4
        ),
        outcome: derived
      })
    };
  }
  return {
    status: "settled",
    value: Object.freeze({
      ...common,
      effectSettlementId: hashIdentity(
        "effect_settlement",
        EFFECT_SETTLEMENT_VERSION,
        identityParts4
      ),
      outcome: derived
    })
  };
}

// src/action-loop/sdk/effect-controller.ts
var effectOutcomes = [
  "observed-success",
  "observed-no-effect",
  "failed",
  "partially-applied",
  "pending",
  "unknown"
];
var observationStatuses = ["relied-on", "not-relied-on"];
var intendedStatuses = [
  "observed",
  "not-observed",
  "failed",
  "partially-observed",
  "unknown"
];
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isEffectSettlementOutcome(value) {
  return effectOutcomes.some((candidate) => candidate === value);
}
function rejected8(code, message) {
  return { status: "rejected", code, message };
}
function effectParameters(input) {
  const fields = {
    outcome: StringEnum8(effectOutcomes),
    basis_json: Type8.String({
      minLength: 2,
      maxLength: 32768,
      description: "JSON array of one or more Effect accounting basis strings."
    })
  };
  for (const [index, observation] of input.observations.entries()) {
    fields[`observation_status_${index}`] = StringEnum8(observationStatuses, {
      description: observation.statement
    });
    fields[`observation_basis_${index}`] = Type8.String({
      minLength: 1,
      maxLength: 2048
    });
  }
  for (const [
    effectIndex,
    intendedEffect
  ] of input.effect.intendedEffects.entries()) {
    fields[`intended_status_${effectIndex}`] = StringEnum8(intendedStatuses, {
      description: intendedEffect
    });
    fields[`intended_basis_${effectIndex}`] = Type8.String({
      minLength: 1,
      maxLength: 2048
    });
    for (const observationIndex of input.observations.keys()) {
      fields[`intended_${effectIndex}_observation_${observationIndex}`] = Type8.Boolean({
        description: "Whether this exact current Observation supports the intended Effect disposition."
      });
    }
  }
  return Type8.Object(fields, { additionalProperties: false });
}
function decodeObservationDispositions(input) {
  const dispositions = [];
  for (const [index, observation] of input.observations.entries()) {
    const status = input.raw[`observation_status_${index}`];
    const basis = input.raw[`observation_basis_${index}`];
    if (status !== "relied-on" && status !== "not-relied-on" || typeof basis !== "string") {
      return {
        ok: false,
        message: `Effect Observation ${index} requires a canonical disposition and basis.`
      };
    }
    dispositions.push({
      effectObservationId: observation.effectObservationId,
      status,
      basis: [basis]
    });
  }
  return { ok: true, value: Object.freeze(dispositions) };
}
function selectedObservationIds(input) {
  return Object.freeze(
    input.observations.flatMap(
      (observation, observationIndex) => input.raw[`intended_${input.effectIndex}_observation_${observationIndex}`] === true ? [observation.effectObservationId] : []
    )
  );
}
function decodeIntendedDispositions(input) {
  const dispositions = [];
  for (const [
    index,
    intendedEffect
  ] of input.effect.intendedEffects.entries()) {
    const status = input.raw[`intended_status_${index}`];
    const basis = input.raw[`intended_basis_${index}`];
    if (status !== "observed" && status !== "not-observed" && status !== "failed" && status !== "partially-observed" && status !== "unknown" || typeof basis !== "string") {
      return {
        ok: false,
        message: `Intended Effect ${index} requires a canonical disposition and basis.`
      };
    }
    dispositions.push({
      intendedEffect,
      status,
      observationIds: selectedObservationIds({
        raw: input.raw,
        effectIndex: index,
        observations: input.observations
      }),
      basis: [basis]
    });
  }
  return { ok: true, value: Object.freeze(dispositions) };
}
function canonicalProposal4(input) {
  const outcome = input.raw.outcome;
  if (!isEffectSettlementOutcome(outcome)) {
    return {
      ok: false,
      code: "invalid-effect-outcome",
      message: "outcome must be a canonical Effect settlement outcome."
    };
  }
  const observationDispositions = decodeObservationDispositions(input);
  if (!observationDispositions.ok) {
    return {
      ok: false,
      code: "invalid-observation-dispositions",
      message: observationDispositions.message
    };
  }
  const intendedEffectDispositions = decodeIntendedDispositions(input);
  if (!intendedEffectDispositions.ok) {
    return {
      ok: false,
      code: "invalid-intended-effect-dispositions",
      message: intendedEffectDispositions.message
    };
  }
  const basis = decodeSdkStringList({
    value: input.raw.basis_json,
    label: "basis_json",
    allowEmpty: false,
    maximumItems: 32
  });
  if (!basis.ok) {
    return { ok: false, code: "invalid-basis", message: basis.message };
  }
  return {
    ok: true,
    value: {
      workCaseId: input.effect.workCaseId,
      effectId: input.effect.effectId,
      outcome,
      observationDispositions: observationDispositions.value,
      intendedEffectDispositions: intendedEffectDispositions.value,
      basis: basis.value,
      provenance: { kind: "model", source: "pi:sdk-action-loop" }
    }
  };
}
function effectTool(input) {
  return {
    name: "submit_effect_settlement",
    label: "Submit complete current Effect accounting",
    description: "Disposition every current Observation and intended Effect without treating tool return as implicit success.",
    parameters: effectParameters(input),
    execute: async (raw) => {
      if (!isRecord8(raw)) {
        return rejected8(
          "invalid-arguments",
          "Effect settlement arguments must be an object."
        );
      }
      const proposal = canonicalProposal4({ ...input, raw });
      if (!proposal.ok) return rejected8(proposal.code, proposal.message);
      const settled = settleEffect(
        input.effect,
        input.observations,
        proposal.value
      );
      if (settled.status === "invalid") {
        return rejected8(settled.error.code, settled.error.message);
      }
      return {
        status: "accepted",
        value: { proposal: proposal.value, result: settled },
        message: `Effect accounting accepted as ${settled.value.outcome}.`,
        resultStatus: settled.value.outcome
      };
    }
  };
}
function effectPrompt(input) {
  const observations = input.observations.map(
    (observation, index) => `Observation ${index}: ${observation.statement}
Limitations: ${observation.limitations.join(" | ") || "none declared"}`
  ).join("\n\n");
  return [
    `Delegated request:
${input.request}`,
    `Intended Effects:
${input.effect.intendedEffects.map((effect, index) => `${index}: ${effect}`).join("\n")}`,
    observations.length > 0 ? `Exact current Effect Observations:
${observations}` : "Exact current Effect Observations: none",
    "Tool return and exit status are evidence only. Derive settlement from complete explicit accounting."
  ].join("\n\n");
}
async function settleEffectWithSdk(input) {
  const decision = await input.runner.run({
    systemPrompt: [
      "Assess one current Effect from exact host Observations.",
      "Call the supplied decision tool exactly once.",
      "Disposition every Observation and every intended Effect.",
      "A tool return is not implicit success; preserve pending, unknown, failure, and adverse evidence.",
      "The SDK controller owns identities, complete accounting, canonical admission, retries, and stop decisions."
    ].join("\n"),
    prompt: effectPrompt(input),
    tool: effectTool(input)
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
  const reproduced = settleEffect(
    input.effect,
    input.observations,
    decision.value.proposal
  );
  if (reproduced.status === "invalid") {
    return {
      status: "invariant-failure",
      code: reproduced.error.code,
      message: reproduced.error.message,
      decision: decision.metrics
    };
  }
  if (reproduced.status !== decision.value.result.status) {
    return {
      status: "invariant-failure",
      code: "effect-outcome-drift",
      message: "Accepted Effect accounting did not reproduce its outcome.",
      decision: decision.metrics
    };
  }
  if (reproduced.status === "settled") {
    if (decision.value.result.status !== "settled" || reproduced.value.effectSettlementId !== decision.value.result.value.effectSettlementId) {
      return {
        status: "invariant-failure",
        code: "effect-settlement-identity-drift",
        message: "Accepted Effect settlement did not reproduce its identity.",
        decision: decision.metrics
      };
    }
    return {
      status: "settled",
      settlement: reproduced.value,
      decision: decision.metrics
    };
  }
  if (decision.value.result.status !== "unsettled" || reproduced.value.effectAssessmentId !== decision.value.result.value.effectAssessmentId) {
    return {
      status: "invariant-failure",
      code: "effect-assessment-identity-drift",
      message: "Accepted unsettled Effect assessment did not reproduce its identity.",
      decision: decision.metrics
    };
  }
  return {
    status: "unsettled",
    assessment: reproduced.value,
    decision: decision.metrics
  };
}

// src/action-loop/sdk/judgment-controller.ts
import { StringEnum as StringEnum9 } from "@earendil-works/pi-ai";
import { Type as Type9 } from "typebox";

// src/action-loop/judgment/open-judgment.ts
var OPEN_JUDGMENT_VERSION = "developer-open-judgment/v1";
var CATEGORIES = /* @__PURE__ */ new Set([
  "Contextual Adequacy",
  "Proportionate Intervention",
  "Consequence Integrity",
  "Claim Assurance"
]);
var PROVENANCE_KINDS11 = /* @__PURE__ */ new Set(["model", "human", "tool", "external"]);
var MAX_TEXT_LENGTH2 = 4096;
var MAX_REQUIREMENTS = 32;
var MAX_NEEDS_PER_REQUIREMENT = 32;
var MAX_BASIS_ITEMS2 = 16;
function invalid21(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function validId6(value) {
  return typeof value === "string" && value.length > 0 && value === value.trim() && value.length <= MAX_TEXT_LENGTH2 && !value.includes("\0");
}
function canonicalText15(value, path) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH2) {
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
function canonicalStrings2(values, path, maximumItems, allowEmpty = false) {
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
    const text = canonicalText15(values[index], `${path}[${index}]`);
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
    const statement = canonicalText15(
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
    const needs = canonicalStrings2(
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
  if (!validId6(proposal.workCaseId) || !validId6(proposal.contextRevisionId)) {
    return invalid21(
      "invalid-id",
      "proposal",
      "Expected canonical Work Case and Context revision IDs"
    );
  }
  if (!CATEGORIES.has(proposal.category)) {
    return invalid21(
      "unsupported-category",
      "proposal.category",
      "Unsupported Judgment Category"
    );
  }
  const subject = canonicalText15(proposal.subject, "proposal.subject");
  if (!subject.ok) return { status: "invalid", error: subject.error };
  const question = canonicalText15(proposal.question, "proposal.question");
  if (!question.ok) return { status: "invalid", error: question.error };
  const canonical = canonicalRequirements(proposal.requirements);
  if (!canonical.ok) return { status: "invalid", error: canonical.error };
  const basis = canonicalStrings2(
    proposal.basis,
    "proposal.basis",
    MAX_BASIS_ITEMS2
  );
  if (!basis.ok) return { status: "invalid", error: basis.error };
  if (typeof proposal.provenance !== "object" || proposal.provenance === null || !PROVENANCE_KINDS11.has(proposal.provenance.kind) || !validId6(proposal.provenance.source)) {
    return invalid21(
      "invalid-provenance",
      "proposal.provenance",
      "Expected bounded supported proposal provenance"
    );
  }
  const identityParts4 = [
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
    identityParts4
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

// src/action-loop/work/record-work-case-judgment.ts
function invalid22(code, path, message) {
  return { status: "invalid", error: { code, path, message } };
}
function recordWorkCaseJudgment(workCase, judgment) {
  if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
    return invalid22(
      "stale-work-case",
      "workCase.revisionId",
      "Work Case revision does not match its closure inventory"
    );
  }
  if (workCaseInventoryIssue(workCase) !== void 0) {
    return invalid22(
      "invalid-work-case-inventory",
      "workCase",
      "Work Case closure inventory is relationally incoherent"
    );
  }
  if (judgment.workCaseId !== workCase.workCaseId) {
    return invalid22(
      "identity-mismatch",
      "judgment.workCaseId",
      "Judgment belongs to another Work Case"
    );
  }
  if (workCase.conclusions.some(
    ({ judgmentId }) => judgmentId === judgment.judgmentId
  )) {
    return invalid22(
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

// src/action-loop/sdk/judgment-controller.ts
var categories = [
  "Contextual Adequacy",
  "Proportionate Intervention",
  "Consequence Integrity",
  "Claim Assurance"
];
var MAX_REQUIREMENTS2 = 8;
var MAX_NEEDS_PER_REQUIREMENT2 = 8;
var MAX_BASIS_ITEMS3 = 16;
function isRecord9(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected9(code, message) {
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
    if (!isRecord9(item)) {
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
      parameters: Type9.Object(
        {
          category: StringEnum9(categories),
          subject: Type9.String({ minLength: 1, maxLength: 4096 }),
          question: Type9.String({ minLength: 1, maxLength: 4096 }),
          requirements_json: Type9.String({
            minLength: 2,
            maxLength: 32768
          }),
          basis_json: Type9.String({ minLength: 2, maxLength: 32768 })
        },
        { additionalProperties: false }
      ),
      execute: async (raw) => {
        if (!isRecord9(raw) || !isCategory(raw.category) || typeof raw.subject !== "string" || typeof raw.question !== "string") {
          return rejected9(
            "invalid-arguments",
            "Judgment requires category, subject, question, requirements_json, and basis_json."
          );
        }
        const requirements = decodeRequirements(raw.requirements_json);
        if (!requirements.ok) {
          return rejected9("invalid-requirements", requirements.message);
        }
        const basis = decodeSdkStringList({
          value: raw.basis_json,
          label: "basis_json",
          allowEmpty: false,
          maximumItems: MAX_BASIS_ITEMS3
        });
        if (!basis.ok) return rejected9("invalid-basis", basis.message);
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
          return rejected9(opened.error.code, opened.error.message);
        }
        const recorded = recordWorkCaseJudgment(input.workCase, opened.value);
        if (recorded.status === "invalid") {
          return rejected9(recorded.error.code, recorded.error.message);
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
import { Type as Type10 } from "typebox";
var MAX_OUTCOME_ITEMS = 32;
var MAX_BASIS_ITEMS4 = 16;
function isRecord10(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejected10(code, message) {
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
      parameters: Type10.Object(
        {
          statement: Type10.String({ minLength: 1, maxLength: 4096 }),
          acceptance_conditions_json: Type10.String({
            minLength: 2,
            maxLength: 32768
          }),
          constraints_json: Type10.String({
            minLength: 2,
            maxLength: 32768
          }),
          basis_json: Type10.String({ minLength: 2, maxLength: 32768 })
        },
        { additionalProperties: false }
      ),
      execute: async (raw) => {
        if (!isRecord10(raw) || typeof raw.statement !== "string") {
          return rejected10(
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
          return rejected10(
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
          return rejected10("invalid-constraints", constraints.message);
        }
        const basis = decodeSdkStringList({
          value: raw.basis_json,
          label: "basis_json",
          allowEmpty: false,
          maximumItems: MAX_BASIS_ITEMS4
        });
        if (!basis.ok) return rejected10("invalid-basis", basis.message);
        const opened = openWorkCase({
          outcome: {
            statement: raw.statement,
            acceptanceConditions: acceptanceConditions.value,
            constraints: constraints.value
          },
          provenance: { kind: "model", source: "sdk:work-case-opening" }
        });
        if (opened.status === "invalid") {
          return rejected10(opened.error.code, opened.error.message);
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
  EFFECT_OBSERVATION_VERSION,
  EFFECT_REMEDIATION_VERSION,
  EFFECT_VERSION,
  MAX_SDK_PROPOSAL_JSON_CHARS,
  SKILL_TOC_SCHEMA_URI,
  WORK_CASE_BLOCK_VERSION,
  WORK_CASE_PAUSE_VERSION,
  WORK_CASE_RESUME_VERSION,
  WORK_CASE_UNBLOCK_VERSION,
  WORK_CASE_WAIT_RESUME_VERSION,
  WORK_CASE_WAIT_VERSION,
  acceptEffectObservation,
  acceptEffectRemediation,
  assessCapabilityInventoryWithSdk,
  assessNeedCoverageWithSdk,
  beginEffect,
  bindCapability,
  bindPiCapabilityInventory,
  blockWorkCase,
  catalogBeforeAgentStartSkills,
  clearActionWithHostPermission,
  completeWorkCaseWithSdk,
  concludeJudgmentWithSdk,
  contributeSkillWithSdk,
  createPiSdkDecisionRunner,
  decodeSdkProposalJson,
  decodeSdkStringList,
  inspectCapabilityContextProgress,
  inspectContributionProgress,
  inspectCoverageProgress,
  openJudgmentWithSdk,
  openWorkCaseWithSdk,
  parseTocBytes,
  pauseWorkCase,
  proposeActionWithSdk,
  resumeBlockedWorkCase,
  resumePausedWorkCase,
  resumeWaitingWorkCase,
  routeStructuredCapabilityWithSdk,
  sealCapabilityContextWithSdk,
  selectStructuredReferencesWithSdk,
  settleEffectWithSdk,
  waitWorkCase
};
