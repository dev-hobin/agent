# Conditional Skill references

This is a repository-owned convention on top of Agent Skills, not an upstream
reference-policy specification. The canonical method lives in `SKILL.md`;
references refine that method only when materially relevant.

## Selection meaning

1. Read the selected Skill's instructions.
2. Check root applicability: at least one `when` must apply, and any matching
   `unless` excludes the method. Exclusions win.
3. For an applicable method, evaluate each reference's independent `when`
   conditions. Broad topic similarity alone does not justify a read.
4. Read the smallest set that can materially change the current result. Zero,
   one, or several reference bodies may be appropriate.
5. Resolve every reference path relative to the owning Skill directory, not the
   task's working directory.

Conditions are natural-language instructions interpreted by the agent, not an
executable predicate language. Metadata describes candidates; its presence does
not select a reference, grant authority, or enforce access control. No applicable
reference means using the core method, not inventing a prerequisite or reading
all supporting material.

## Developer: runtime-readable metadata

```text
skills/<name>/
├─ SKILL.md
├─ references.json       # when, unless, references[{path, when}]
└─ references/*.md
```

For Skills with prepared references, `SKILL.md` tells the model to inspect the
colocated JSON unless a host has already supplied the bounded metadata for this
invocation. The model then reads the applicable bodies through ordinary file
access. No custom loader is required.

Developer's JSON is checked against
`schemas/skill-references-v0.1.schema.json`. Not every Developer Skill needs this
file. A shipped link or policy target must resolve; malformed or missing
packaged data fails authoring checks.

## Learning: build-time directions

```text
judgment.json
    -> development-time parser and renderer
    -> SKILL.md: Context Directions
    -> model reads only applicable references/*.md
```

`judgment.json` is an authoring source. Its generated section is part of the
standard Markdown body, so no host needs to interpret the JSON or launch a
policy engine. Regenerate it with:

```sh
node packages/learning/scripts/write-context-directions.mjs
```

Keep the existing Learning authoring format and Developer format separate until
a concrete change needs a shared representation. Portability does not require
one new runtime or a schema conversion merely for uniformity.

## Optional Pi disclosure

`packages/developer/adapters/pi/skill-references/index.js` automatically supplies
a selected Skill's sibling `references.json` through Pi lifecycle events. It
supports discovered Skills from any source, not just this package. It does not
choose or read reference bodies.

This adapter preserves its existing bounded behavior: syntactically valid JSON
up to 32 KiB; missing, malformed, oversized, and unreadable files are silent
no-ops; no schema validation is imposed on external Skills. This runtime policy
is distinct from stricter checks on our own shipped artifacts.

Removing the adapter must leave the normal `SKILL.md -> references.json ->
selected reference` path available. Other hosts do not need to recreate Pi's
hidden-message mechanism.

## Verification boundary

Checks establish frontmatter validity, path containment, resource presence,
policy structure, generated-text consistency, and preservation when whole Skill
directories are relocated or packed. They do not establish that a model always
loads the right Skill, obeys an exclusion, reads the minimal set, or preserves
instructions after context compaction. Those claims require separate behavioral
evidence for the actual host and model.
