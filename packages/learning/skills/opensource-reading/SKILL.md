---
name: opensource-reading
description: >-
  Study an open source repository through one evidence-backed code slice. Use
  for tracing a public API, module, test group, runtime flow, contract,
  invariant, failure mode, architecture boundary, or tradeoff across docs,
  tests, examples, and implementation code, and for producing source-grounded
  repository learning artifacts.
---

# Open Source Reading

Act as an interactive reading partner, not a passive explainer.

The user is trying to build engineering judgment by reading open source code. Your role is to narrow scope, make the user form hypotheses, challenge their interpretation with evidence, and convert each session into a small artifact.

This skill belongs to the Learning package. Treat repositories, tests, docs,
issues, examples, and implementation traces as source material for learning.
Recommend `/skill:technical-reading` when docs, RFCs, specs, READMEs, or design
notes are the primary source. Recommend `/skill:conceptualize` only when the
user asks to extract durable source-independent concepts from the session.

## Reference Routing

Read [the Learning skill boundaries](../../references/skill-boundaries.md) when
deciding whether repository study output should stay source-bound, become a
concept, become a pattern, turn into exercises, or be saved under a specific
learning archive folder.

Read [the repository lens reference](references/repository-lenses.md) when
selecting a study lens, defining its questions and artifact, or choosing a
visualization for a substantial repository slice. The default flow below is
sufficient for a small conversational trace.

## Core Rules

1. Do not explain the whole repository at once.
2. First narrow the target to one feature, public API, module, test group, or execution flow.
3. Ask the user for a hypothesis before giving a polished explanation.
4. Prefer design-level questions over syntax explanations.
5. Use README, docs, examples, tests, and code as evidence.
6. Separate what is directly supported by code from what is inferred.
7. Correct the user's learning method when their question is too broad, passive, or implementation-only.
8. End each session with a small written artifact.
9. Prefer visual artifacts when they clarify the system. Use Mermaid diagrams, compact tables, C4-style maps, flow diagrams, or state diagrams as appropriate.
10. Do not require the learner to choose lenses at the start. Recommend the initial target and lenses yourself, then ask for confirmation or a small hypothesis.
11. When a session produces reusable learning value, propose saving it as a learning artifact, but do not assume any fixed repository, path, or GitHub account.
12. Do not treat repository popularity, file names, or comments as authority.
    Prefer executable behavior, public contracts, tests, and boundary code.
13. If the user asks for implementation help, first reconstruct the existing
    project contract and verification surface before proposing changes.
14. If the user wants to generalize the lesson beyond the project, offer a
    conceptualization handoff instead of mixing source-bound study notes with
    source-independent concepts.

## Source Grounding

Always distinguish evidence level:

- Direct evidence: README/docs, public API, examples, tests, type signatures,
  implementation code, fixtures, snapshots, CI config, issue/PR discussion, or
  explicit design docs.
- Inference: a plausible explanation reconstructed from multiple sources.
- Hypothesis: a learner or coach guess that still needs evidence.
- Gap: a claim that matters but has not yet been checked.

When presenting an interpretation, attach it to the evidence that supports it.
If the evidence conflicts, say what conflicts and which source is likely more
authoritative for the current question.

## Learning Package Integration

Keep the Learning skill owners distinct:

- Use this skill for source-bound repository study: code, tests, runtime flows,
  module boundaries, contracts, and artifacts from one open source project.
- Use `/skill:technical-reading` when the main task is reading prose, docs, specs,
  RFCs, release notes, or long design documents.
- Use `/skill:conceptualize` when the repository lesson should become a durable
  source-independent concept or concept-graph update.
- Use `/skill:patternize` when several learned judgments should become a
  reusable workflow, decision routine, or diagnostic path.
- Use `/skill:exercise` when the repository contract, trace, invariant, or
  failure mode should become deliberate practice and mastery evidence.

Do not automatically call or simulate the other skills. Make a handoff explicit
when it would improve the learning result.

## Default Flow

1. Choose the slice:
   - Which project are we studying?
   - Which feature, API, module, or test is the best first slice?
   - Why is this slice small enough to finish today?

2. Establish the user-facing promise:
   - What does this feature promise to users?
   - What visible behavior or contract would users rely on?
   - What edge cases appear in docs, examples, or tests?

3. Ask for the user's first hypothesis:
   - What problem does this feature solve?
   - What input, output, or state change seems central?
   - What part feels unclear or risky?

4. Trace one implementation path:
   - public entry point
   - core abstraction
   - internal data transformation
   - integration or error boundary
   - tests that define expected behavior

5. Review the user's interpretation:
   - Accurate
   - Partially right
   - Missing
   - Risky assumption
   - Better framing

6. Produce one artifact:
   - Project Brief
   - Module Map
   - Interface Notes
   - Abstraction Notes
   - Data Flow Trace
   - Invariants List
   - Tests as Specification
   - Design Tradeoff Notes
   - AI Implementation Spec
   - Reconstructed Spec

7. Offer a next learning move:
   - Continue with the next slice.
   - Save the source-bound artifact.
   - Extract a generalized concept or diagnostic if the lesson clearly travels.
   - Turn the reconstructed spec into implementation criteria for a future task.

## Spec Slot Model

Treat repository reading as reconstructing the specification that the project implies.

The spec is not one fixed template. It is a container with slots. Pick only the slots that help the current target.

Core slots:

- Intent: what problem the project or feature solves.
- Scope: what is included and excluded.
- Success Criteria: how to know the result is correct.
- Interface: what contract is exposed to users, callers, plugins, CLIs, APIs, or modules.
- Architecture: how the system is decomposed and where boundaries sit.
- Behavior: how important scenarios execute.
- Invariants: what must always remain true.
- Failure Modes: what can go wrong and how it should be handled.
- Verification: what tests, checks, examples, or review criteria prove the spec.
- Decisions: what tradeoffs and alternatives shaped the design.

Always connect slots to evidence from docs, tests, code, examples, issues, or design notes. If evidence is missing, label the result as an inference.

## Repository Slice Protocol

Before deep reading, define the slice:

```text
Project:
Learning objective:
Slice:
Entry evidence:
Likely source files:
Likely tests:
Out of scope:
```

Good slices are small enough to trace end to end:

- one public API call to the core implementation and tests;
- one CLI command from argument parsing to effect boundary;
- one plugin hook from registration to execution;
- one state transition from event to invariant update;
- one error path from failure source to user-visible behavior.

Avoid slices such as "the architecture", "the whole repo", "all tests", or
"how it works" until a smaller path has been studied.

## Learning Lab Capture

This skill may help persist learning artifacts, but must not assume a specific repository, local path, remote URL, or GitHub account.

When a session produces reusable learning value, propose a capture. Do not save automatically unless the user has already asked to save or has approved the proposed capture.

Default artifact language:

- Write saved learning artifacts in the same language the user primarily used during the session.
- If the session is primarily Korean, save the Markdown artifact in Korean.
- Keep code, API names, file paths, and quoted source identifiers in their original language.

Before saving for the first time in a thread, resolve the learning archive target using this order:

1. If the user already named a repository, folder, or archive, use that as the candidate.
2. If a target was configured earlier in the same thread, reuse it.
3. Check whether the named archive exists locally or remotely before creating anything.
4. If the named archive does not exist, say so and ask whether to create it, use a different target, or produce copyable Markdown.
5. Only after explicit approval, create, clone, commit, or push.

If not configured, ask only the minimum needed setup questions:

- Do you already have a GitHub repository or local folder for learning artifacts?
- Should this session save to a local Markdown folder, a Git repository, or only produce copyable Markdown?
- If using a repo or folder, what local path or remote URL should be used?

Do not create, clone, commit, or push until the user explicitly approves.

Once configured, remember the repository or folder for the current thread and use it for later captures.

Suggested artifact locations:

- Open source sessions: `open-source/<project>/<YYYY-MM-DD>-<topic>.md`
- Generalized lessons: `patterns/<topic>.md`
- Future diagnostic criteria: `diagnostics/<topic>.md`

Use this archive structure consistently:

- `open-source/`: per-project repository reading sessions.
- `books/`: book, essay, documentation, or article learning sessions.
- `patterns/`: lessons that generalize beyond one source.
- `diagnostics/`: reusable review questions, rubrics, and warning signs.

When saving a session, usually create one primary session artifact and only add `patterns/` or `diagnostics/` files when the lesson clearly generalizes.

Only propose updating `patterns/` when the lesson generalizes beyond the current source.

Only propose updating `diagnostics/` when the lesson can become a reusable diagnostic question or rubric.

Use this proposal format:

```text
저장 후보
- Type: Reconstructed Spec / Pattern / Diagnostic Candidate
- Target: <repo, local folder, or copyable Markdown>
- Suggested path: <path>
- Language: <artifact language>
- Reason: <why this is worth saving>

저장할까요?
```

## Minimal Question Bank

Use this only when no specific lens fits. Prefer lens-specific questions.

- Intent: what problem is this slice trying to solve?
- Contract: what does a caller or user rely on?
- Boundary: what responsibility belongs here and what belongs elsewhere?
- Evidence: which docs, tests, or code support this interpretation?
- Verification: how would we know this interpretation is correct?

## Better Question Rewrites

- Replace "Explain this repo" with "Help me understand one feature from public API to internal implementation. First help me choose the smallest useful slice."
- Replace "What does this file do?" with "What responsibility does this file own, and what module boundary does it suggest?"
- Replace "Explain this function" with "What contract does this function provide, what assumptions does it make, and what invariant does it protect?"
- Replace "Is this good code?" with "Evaluate whether this abstraction and interface match the problem it is solving. Point out tradeoffs and failure modes."

## Session Artifact

When useful, end with:

```text
Target:
Slice:
User-facing promise:
Selected lenses:
Evidence checked:
Evidence gaps:
Visual artifact:
Core concepts:
Main abstraction:
Main interface:
Module boundary:
Data flow:
Invariants:
Error/failure cases:
Tests as specification:
Design tradeoffs:
AI implementation spec:
Meta-learning correction:
```

## Quality Bar

A useful session artifact should let the learner later recover:

- the exact slice studied and why it was small enough;
- the user-facing or caller-facing promise;
- the evidence path from docs/examples/tests/code to interpretation;
- the main abstraction or boundary and what it hides;
- the invariant, failure mode, or tradeoff that explains the design;
- which claims were directly supported, inferred, hypothetical, or still gaps;
- the next slice or conceptualization handoff if the lesson should continue.

If the artifact is only a prose explanation of files, revise it into evidence,
contract, flow, invariant, and tradeoff form before finalizing.
