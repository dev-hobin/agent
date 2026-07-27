# @hobin/observer

A spec-first rebuild of Observer for Pi.

Observer is intended to provide a local-first observation mode that follows standing inquiry loops across materials, reconciles developing memos, and promotes mature, source-linked knowledge into Zettelkasten records.

## Status

This package is private and under spec-first implementation. Slice 7 is in progress: the package has a branch-local observation ledger, source-first candidate/read/hydrate/record staging, a deterministic Standing Inquiry index, and one sequential `observer_sidecar` Pi tool. `/observe memo` records and replay-confirms an exact request before sending a recoverable nontruth agent trigger; `memo-scope` returns only that request's read-only context. Strict `memo-prepare` now refines and replay-confirms a complete instruction before delegating to the existing prepared → applied → acknowledged Memo path, with append-free retry across instruction/install/apply/ack gaps and no Markdown write. The Pi ingress schema preserves explicit nulls through Pi 0.80.10 `Value.Convert`, and parser/domain rejection is reported on Pi's actual tool-error channel instead of successful failure content. A request-bound Memo preparation guide projects the same current Hypothesis/Memo coverage required by reconciliation, exact locked pass fields, and only the requested Observation sources. `memo-scope` returns that guide and exact request digest; `memo-prepare` accepts only semantic arrays (Evidence, Hypothesis/Memo outcomes, and dispositions). Model-facing Memo revisions encode their resulting state directly as `revise-incubating` or `revise-promotion-candidate`, which the action boundary lowers into the unchanged domain outcome. The controller reconstructs all locked request/pass fields from a fresh guide before contextual refinement, so the model cannot override basis identities. Prepared-pass installation replays the exact request-related Working Source basis from the current branch before effects. Post-repair model-driven completion and wrap/fresh-session re-entry remain deferred.

## Documentation

- [Observer v0.1 product specification (Korean)](docs/product-spec-v0.1.ko.md)
- [Observer v0.1 implementation plan and status (Korean)](docs/implementation-plan-v0.1.ko.md)

## Historical implementation

The previous implementation and its filtered history are preserved separately on the `archive/observer-v0.1` branch. It is evidence and a behavior oracle, not the baseline for this rebuild.
