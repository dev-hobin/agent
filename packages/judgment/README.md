# @hobin/judgment

English | [한국어](./README.ko.md)

A side-effect-free engine for answering one question from an exact, inspectable
set of context.

Judgment is a library for adapter authors. It does not register a Pi command,
Skill, tool, prompt, session, or UI.

## Install

```sh
npm install @hobin/judgment
```

The package also includes a policy-authoring CLI:

```sh
npx judgment check path/to/judgment.json
npx judgment explain path/to/judgment.json
npx judgment compile path/to/judgment.json
```

## What problem it solves

A model can say that it used a file, tool result, or Skill, but that alone does
not tell a host application:

- which exact bytes were used;
- whether the source was applicable to this question;
- what each source contributed;
- whether any selected source was missing or stale; or
- what kind of authority supports the conclusion.

Judgment gives the host immutable values for those checks.

## How one judgment works

An adapter supplies the question and the available sources. Judgment then moves
through five explicit operations:

1. **Open the question.** The question is bound to its owner, optional policy,
   current branch, and known basis.
2. **Record applicability.** A policy-bearing capability is `applicable`,
   `not-applicable`, or `needs-context`.
3. **Select and seal.** Exact nominated sources are resolved and read. Selection
   and content sealing succeed together or not at all.
4. **Assess coverage.** Every usable selected item must have a concrete
   contribution such as evidence, constraint, decision, method, or guidance.
5. **Conclude.** The outcome may cite only contributions, conflicts, and
   limitations from the current coverage.

The result includes stable identities for the question, selection, sealed
content, coverage, and outcome. Those hashes detect drift; they do not prove that
a source or conclusion is true.

See [Judgment operating principles](./docs/how-it-works.md) for the immutable
value pipeline, acquisition boundary, identity chain, and coverage rules.

## Optional policy

A capability may place `judgment.json` next to its method. The policy says:

- when the capability applies;
- which explicit exclusions override that match; and
- when each packaged reference can add a useful distinction.

A missing policy is normal. A malformed policy that exists is an error for that
source.

```ts
import {
  compileJudgmentPolicy,
  parseJudgmentAuthoringPolicyJson,
} from "@hobin/judgment";

const policy = parseJudgmentAuthoringPolicyJson(policyJson);
const compiled = compileJudgmentPolicy({ owner, policy });
console.log(compiled.policySha256);
```

The caller supplies `owner`; policy JSON cannot claim or replace it.

## One question, many context sources

One question can use its owning capability, several nominated external Skills,
current-branch tool results, context files, and explicit user decisions.

External Skills remain context providers. They do not start another Judgment
workflow. Only applicable providers may contribute positive material, and every
provider keeps its own policy identity and contained file root.

## Package exports

| Export | Use |
| --- | --- |
| `@hobin/judgment` | Policy, question, context, coverage, lifecycle, and outcome values |
| `@hobin/judgment/node` | Contained local readers and atomic content sealing |
| `@hobin/judgment/pi-context` | Pi descriptor/observation adapters and `ContextAttempt` |
| `@hobin/judgment/schema` | JSON Schema for `judgment.json` |

## What the caller still owns

Judgment does not choose the domain capability, discover every Skill, render UI,
persist a session, authorize code changes, or verify semantic truth. The adapter
must decide what the outcome permits and how it is shown or stored.

## Documentation

- [Judgment operating principles](./docs/how-it-works.md) — refined values,
  identity chain, atomic sealing, and contribution coverage
- [Policy authoring](./docs/policy-authoring.md) — exact `judgment.json` rules
- [Adapter guide](./docs/adapter-guide.md) — integrating the engine into a host

## Development

```sh
pnpm --filter @hobin/judgment check
pnpm --filter @hobin/judgment pack
```

## License

[MIT](./LICENSE)
