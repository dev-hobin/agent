# How Learning works

English | [한국어](./ko/how-it-works.md)

Learning is not a central extension that advances a learner through phases. The
package contains one small chooser and five independent `SKILL.md` methods.

## What `/learning` actually does

When Pi loads the package, the extension registers one `/learning` command. The
command only:

1. shows the five Skill names;
2. lets the user select one;
3. preserves the current editor draft;
4. inserts `/skill:<name>` into the editor; and
5. leaves the final message for the user to review and send.

The chooser does not call a model, append a Learning event, or create a phase.

A name can also be supplied directly:

```text
/learning technical-reading
```

This still prepares the editor instead of running the Skill automatically.

## What runs after the Skill command is sent

When the user sends `/skill:technical-reading`, Pi's normal Skill loader places
that `SKILL.md` in model context. No Learning-specific scheduler or runtime sits
between the Skill and Pi.

Every Skill method must contain:

- the requests it owns;
- accepted inputs;
- the work order;
- behavior when evidence is missing; and
- a result and stop condition.

The core method therefore remains complete even if no packaged reference is
opened.

## When a packaged reference is opened

A Skill directory may contain deeper checks or examples under `references/`.
For example, technical reading has material that distinguishes several reading
lenses.

Reading every reference would put the package checklist ahead of the actual
source. The `Context Directions` section in each Skill therefore explains the
condition for each file separately:

```text
the source mixes conceptual argument and runtime semantics
-> lens-library may add a needed distinction
-> skip it if the source already supplies that distinction
-> otherwise read that exact reference
```

The source for these directions is `judgment.json`. A development script renders
the policy into `SKILL.md`. The installed runtime does not start a Judgment
session.

## Why Skills do not share state

Technical reading must remain faithful to source wording and order.
Conceptualization deliberately removes source-specific wording to test transfer.
Putting both in one package lifecycle would encourage an automatic “next phase”
even when the user only wanted to read.

Learning does not share:

- a current learning phase;
- completion percentage;
- one required artifact schema;
- an automatic notebook path; or
- mandatory ordering between Skills.

If another Skill becomes useful, the current Skill completes its own result and
the new question is handed off explicitly.

## When files are written

The default result stays in the conversation. A Skill writes Markdown only after
the user requests saving and supplies or approves a target.

A target configured earlier in the conversation may be reused. Otherwise the
Skill asks the minimum setup question first. Learning never invents a repository
or notebook destination.

## Maintainer checks

After changing a policy or reference:

```sh
node packages/learning/scripts/write-context-directions.mjs
pnpm --filter @hobin/learning check
```

The package check confirms that Pi discovers all five Skills, policy and
reference paths are valid, each packaged reference is governed once, generated
`Context Directions` match `SKILL.md` byte for byte, and no Judgment runtime
extension is packed.
